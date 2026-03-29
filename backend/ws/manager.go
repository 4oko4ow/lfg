package ws

import (
	"database/sql"
	"log"
	"math/rand"
	"sync"
	"time"
)

var (
	parties   = make(map[string]*Party)
	partyLock sync.Mutex
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func generateID() string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	b := make([]rune, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func GetParties() []*Party {
	partyLock.Lock()
	defer partyLock.Unlock()
	now := time.Now()
	const threeDays = 3 * 24 * time.Hour
	const threeWeeks = 21 * 24 * time.Hour
	
	list := make([]*Party, 0, len(parties))
	for _, p := range parties {
		// Filter out expired parties
		if p.ExpiresAt != nil && now.After(*p.ExpiresAt) {
			continue
		}
		
		// Filter out old parties based on frontend rules
		age := now.Sub(p.CreatedAt)
		isFull := p.Joined >= p.Slots
		
		// Skip old full parties (older than 3 days)
		if isFull && age > threeDays {
			continue
		}
		
		// Skip old unfilled parties (older than 3 weeks)
		if !isFull && age > threeWeeks {
			continue
		}
		
		list = append(list, p)
	}
	return list
}

func AddParty(p *Party, save bool) {
	partyLock.Lock()
	parties[p.ID] = p
	partyLock.Unlock()

	if save {
		// Сохраняем синхронно для новых объявлений, чтобы гарантировать сохранение
		// перед возможной синхронизацией
		maxRetries := 3
		retryDelay := 100 * time.Millisecond
		var lastErr error
		for i := 0; i < maxRetries; i++ {
			if err := SavePartyToDatabase(p); err != nil {
				lastErr = err
				if i < maxRetries-1 {
					time.Sleep(retryDelay)
					retryDelay *= 2 // exponential backoff
					continue
				}
			} else {
				// Increment user stats if user_id is present
				if p.UserID != "" {
					go incrementUserStats(p.UserID)
					// Check night gamer achievement
					go checkNightGamerAchievement(p.UserID, p.CreatedAt)
				}
				return // успешно сохранено
			}
		}
		// Если все попытки не удались, логируем ошибку
		if lastErr != nil {
			log.Printf("❌ Failed to save party %s after %d retries: %v", p.ID, maxRetries, lastErr)
		}
	}
}

func RemoveParty(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	delete(parties, id)
	go RemovePartyFromDatabase(id)
}

// RemovePartyFromMemory удаляет партию только из памяти, не трогая базу данных.
func RemovePartyFromMemory(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	delete(parties, id)
}

func UpdatePartyJoined(id string, userID string) error {
	partyLock.Lock()

	p, ok := parties[id]
	if !ok {
		partyLock.Unlock()
		return nil // Party not found, silently ignore
	}

	// Check if party is full
	if p.Joined >= p.Slots {
		partyLock.Unlock()
		return nil // Party is full, silently ignore
	}

	// Check if user is the creator
	if p.UserID != "" && p.UserID == userID {
		partyLock.Unlock()
		return nil // Creator cannot join their own party, silently ignore
	}

	// Check if user already joined
	if userID != "" {
		if isUserMemberOfParty(id, userID) {
			partyLock.Unlock()
			return nil // User already joined, silently ignore
		}
	}

	// Increment joined count
	p.Joined++
	wasFull := p.Joined >= p.Slots
	creatorID := p.UserID
	createdAt := p.CreatedAt

	partyLock.Unlock()

	// Save membership to database if user is authenticated
	if userID != "" {
		go savePartyMember(id, userID)
		// Increment parties_joined for the user who joined
		go incrementPartiesJoined(userID)
	}

	go UpdatePartyInDatabase(p)
	Broadcast(Message{Type: "party_update", Payload: p})

	// Check achievements for party creator when party becomes full
	if wasFull && creatorID != "" {
		go checkQuickFillAchievement(creatorID, createdAt)
		go checkSniperAchievement(creatorID)
	}

	return nil
}

func StartPartyCleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		now := time.Now()
		partyLock.Lock()
		var expiredIDs []string
		for id, p := range parties {
			// Check if party has expired
			if p.ExpiresAt != nil && now.After(*p.ExpiresAt) {
				expiredIDs = append(expiredIDs, id)
				continue
			}
			// Old cleanup logic (5 hours)
			if now.Sub(p.CreatedAt) > 5*time.Hour {
				expiredIDs = append(expiredIDs, id)
			}
		}
		// Remove expired parties
		for _, id := range expiredIDs {
			delete(parties, id)
			Broadcast(Message{Type: "party_remove", Payload: map[string]string{"id": id}})
		}
		partyLock.Unlock()
	}
}

// incrementUserStats increments user stats when a party is created
func incrementUserStats(userID string) {
	if db == nil {
		return
	}

	// Increment parties_created and add XP
	_, err := db.Exec(`
		INSERT INTO user_stats (user_id, parties_created, total_xp, level, updated_at)
		VALUES ($1, 1, 10, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			parties_created = user_stats.parties_created + 1,
			total_xp = user_stats.total_xp + 10,
			level = GREATEST(1, FLOOR(SQRT(user_stats.total_xp + 10) / 10)::INTEGER),
			updated_at = NOW()
	`, userID)
	if err != nil {
		log.Printf("Error incrementing user stats: %v", err)
		return
	}

	// Update streak
	today := time.Now().Format("2006-01-02")
	var lastActivityDate sql.NullString
	var currentStreak int

	row := db.QueryRow(`
		SELECT last_activity_date, current_streak
		FROM user_stats
		WHERE user_id = $1
	`, userID)

	err = row.Scan(&lastActivityDate, &currentStreak)
	if err == sql.ErrNoRows {
		// First activity
		_, err = db.Exec(`
			INSERT INTO user_stats (user_id, last_activity_date, current_streak, longest_streak, updated_at)
			VALUES ($1, $2, 1, 1, NOW())
			ON CONFLICT (user_id) DO UPDATE SET
				last_activity_date = EXCLUDED.last_activity_date,
				current_streak = EXCLUDED.current_streak,
				longest_streak = EXCLUDED.longest_streak
		`, userID, today)
		if err != nil {
			log.Printf("Error updating streak: %v", err)
		}
		return
	} else if err != nil {
		log.Printf("Error checking streak: %v", err)
		return
	}

	if !lastActivityDate.Valid || lastActivityDate.String != today {
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		if lastActivityDate.Valid && lastActivityDate.String == yesterday {
			// Continue streak
			currentStreak++
		} else {
			// Reset streak
			currentStreak = 1
		}

		_, err = db.Exec(`
			UPDATE user_stats
			SET last_activity_date = $1,
			    current_streak = $2,
			    longest_streak = GREATEST(longest_streak, $2),
			    updated_at = NOW()
			WHERE user_id = $3
		`, today, currentStreak, userID)
		if err != nil {
			log.Printf("Error updating streak: %v", err)
		}

		// Check for achievements
		checkAchievements(userID, currentStreak)
	}
}

// checkAchievements checks and unlocks all achievements
func checkAchievements(userID string, streak int) {
	if db == nil {
		return
	}

	// Get current stats
	var partiesCreated, partiesJoined, longestStreak int
	err := db.QueryRow(`
		SELECT COALESCE(parties_created, 0), COALESCE(parties_joined, 0), COALESCE(longest_streak, 0)
		FROM user_stats
		WHERE user_id = $1
	`, userID).Scan(&partiesCreated, &partiesJoined, &longestStreak)
	if err != nil {
		return
	}

	// Use the maximum of current streak and longest streak
	maxStreak := streak
	if longestStreak > maxStreak {
		maxStreak = longestStreak
	}

	// Party creation achievements
	if partiesCreated >= 1 {
		unlockAchievement(userID, "first_party", "Первая пати")
	}
	if partiesCreated >= 10 {
		unlockAchievement(userID, "activist", "Активист")
	}
	if partiesCreated >= 50 {
		unlockAchievement(userID, "veteran", "Ветеран")
	}
	if partiesCreated >= 100 {
		unlockAchievement(userID, "legend", "Легенда")
	}

	// Join achievements
	if partiesJoined >= 10 {
		unlockAchievement(userID, "teammate", "Тиммейт")
	}
	if partiesJoined >= 50 {
		unlockAchievement(userID, "team_player", "Командный игрок")
	}

	// Streak achievements
	if maxStreak >= 7 {
		unlockAchievement(userID, "week_streak", "Неделя огня")
	}
	if maxStreak >= 30 {
		unlockAchievement(userID, "month_streak", "Месяц огня")
	}
}

// unlockAchievement unlocks an achievement for a user
func unlockAchievement(userID, achievementType, achievementName string) {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		INSERT INTO user_achievements (user_id, achievement_type, achievement_name, unlocked_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, achievement_type) DO NOTHING
	`, userID, achievementType, achievementName)
	if err != nil {
		log.Printf("Error unlocking achievement %s for user %s: %v", achievementType, userID, err)
	}
}

// checkNightGamerAchievement checks if party was created after midnight (00:00 - 05:00)
func checkNightGamerAchievement(userID string, createdAt time.Time) {
	hour := createdAt.Hour()
	if hour >= 0 && hour < 5 {
		unlockAchievement(userID, "night_gamer", "Ночной геймер")
	}
}

// incrementPartiesJoined increments parties_joined counter and checks achievements
func incrementPartiesJoined(userID string) {
	if db == nil || userID == "" {
		return
	}

	// Increment parties_joined and add XP
	_, err := db.Exec(`
		INSERT INTO user_stats (user_id, parties_joined, total_xp, level, updated_at)
		VALUES ($1, 1, 5, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			parties_joined = user_stats.parties_joined + 1,
			total_xp = user_stats.total_xp + 5,
			level = GREATEST(1, FLOOR(SQRT(user_stats.total_xp + 5) / 10)::INTEGER),
			updated_at = NOW()
	`, userID)
	if err != nil {
		log.Printf("Error incrementing parties_joined: %v", err)
		return
	}

	// Check achievements after join
	checkAchievements(userID, 0)
}

// checkQuickFillAchievement checks if party was filled within 5 minutes
func checkQuickFillAchievement(userID string, createdAt time.Time) {
	if time.Since(createdAt) <= 5*time.Minute {
		unlockAchievement(userID, "quick_fill", "Быстрый старт")
	}
}

// checkSniperAchievement checks if user has 100% fill rate on 10+ parties
func checkSniperAchievement(userID string) {
	if db == nil || userID == "" {
		return
	}

	var totalParties, filledParties int
	err := db.QueryRow(`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE joined >= slots)
		FROM parties
		WHERE user_id = $1
	`, userID).Scan(&totalParties, &filledParties)
	if err != nil {
		return
	}

	if totalParties >= 10 && totalParties == filledParties {
		unlockAchievement(userID, "sniper", "Снайпер")
	}
}
