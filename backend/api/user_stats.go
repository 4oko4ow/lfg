package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"lfg/auth"
	_ "github.com/lib/pq"
)

type UserStatsHandler struct {
	db            *sql.DB
	sessionManager *auth.SessionManager
}

func NewUserStatsHandler(db *sql.DB, sessionManager *auth.SessionManager) *UserStatsHandler {
	return &UserStatsHandler{
		db:            db,
		sessionManager: sessionManager,
	}
}

type UserStats struct {
	PartiesCreated int       `json:"parties_created"`
	PartiesJoined  int       `json:"parties_joined"`
	TotalXP        int       `json:"total_xp"`
	Level          int       `json:"level"`
	CurrentStreak  int       `json:"current_streak"`
	LongestStreak  int       `json:"longest_streak"`
	Achievements   []Achievement `json:"achievements"`
}

type Achievement struct {
	Type      string    `json:"type"`
	Name      string    `json:"name"`
	UnlockedAt time.Time `json:"unlocked_at"`
}

// PublicProfile is the public profile data returned for any user
type PublicProfile struct {
	UserID         string   `json:"user_id"`
	DisplayName    string   `json:"display_name"`
	AvatarURL      string   `json:"avatar_url,omitempty"`
	Level          int      `json:"level"`
	TotalXP        int      `json:"total_xp"`
	PartiesCreated int      `json:"parties_created"`
	PartiesJoined  int      `json:"parties_joined"`
	CurrentStreak  int      `json:"current_streak"`
	Achievements   []string `json:"achievements"` // just the types
}

func (h *UserStatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	stats, err := h.getUserStats(userID)
	if err != nil {
		log.Printf("Error getting user stats: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func (h *UserStatsHandler) getUserStats(userID string) (*UserStats, error) {
	stats := &UserStats{
		PartiesCreated: 0,
		PartiesJoined:  0,
		TotalXP:        0,
		Level:          1,
		CurrentStreak:  0,
		LongestStreak:  0,
		Achievements:   []Achievement{},
	}

	// Get stats from database
	row := h.db.QueryRow(`
		SELECT parties_created, parties_joined, total_xp, level, 
		       current_streak, longest_streak
		FROM user_stats
		WHERE user_id = $1
	`, userID)

	err := row.Scan(
		&stats.PartiesCreated,
		&stats.PartiesJoined,
		&stats.TotalXP,
		&stats.Level,
		&stats.CurrentStreak,
		&stats.LongestStreak,
	)

	if err == sql.ErrNoRows {
		// User has no stats yet, initialize
		_, err = h.db.Exec(`
			INSERT INTO user_stats (user_id, parties_created, parties_joined, 
			                        total_xp, level, current_streak, longest_streak)
			VALUES ($1, 0, 0, 0, 1, 0, 0)
		`, userID)
		if err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	// Get achievements
	rows, err := h.db.Query(`
		SELECT achievement_type, achievement_name, unlocked_at
		FROM user_achievements
		WHERE user_id = $1
		ORDER BY unlocked_at DESC
	`, userID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var ach Achievement
		if err := rows.Scan(&ach.Type, &ach.Name, &ach.UnlockedAt); err != nil {
			continue
		}
		stats.Achievements = append(stats.Achievements, ach)
	}

	return stats, nil
}

func (h *UserStatsHandler) IncrementPartiesCreated(userID string) error {
	_, err := h.db.Exec(`
		INSERT INTO user_stats (user_id, parties_created, total_xp, level, updated_at)
		VALUES ($1, 1, 10, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			parties_created = user_stats.parties_created + 1,
			total_xp = user_stats.total_xp + 10,
			level = GREATEST(1, FLOOR(SQRT(user_stats.total_xp + 10) / 10)::INTEGER),
			updated_at = NOW()
	`, userID)
	return err
}

func (h *UserStatsHandler) IncrementPartiesJoined(userID string) error {
	_, err := h.db.Exec(`
		INSERT INTO user_stats (user_id, parties_joined, total_xp, level, updated_at)
		VALUES ($1, 1, 5, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			parties_joined = user_stats.parties_joined + 1,
			total_xp = user_stats.total_xp + 5,
			level = GREATEST(1, FLOOR(SQRT(user_stats.total_xp + 5) / 10)::INTEGER),
			updated_at = NOW()
	`, userID)
	return err
}

func (h *UserStatsHandler) UpdateStreak(userID string) error {
	today := time.Now().Format("2006-01-02")
	
	var lastActivityDate sql.NullString
	var currentStreak int
	
	row := h.db.QueryRow(`
		SELECT last_activity_date, current_streak
		FROM user_stats
		WHERE user_id = $1
	`, userID)
	
	err := row.Scan(&lastActivityDate, &currentStreak)
	if err == sql.ErrNoRows {
		// First activity
		_, err = h.db.Exec(`
			INSERT INTO user_stats (user_id, last_activity_date, current_streak, longest_streak, updated_at)
			VALUES ($1, $2, 1, 1, NOW())
		`, userID, today)
		return err
	} else if err != nil {
		return err
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
		
		_, err = h.db.Exec(`
			UPDATE user_stats
			SET last_activity_date = $1,
			    current_streak = $2,
			    longest_streak = GREATEST(longest_streak, $2),
			    updated_at = NOW()
			WHERE user_id = $3
		`, today, currentStreak, userID)
		return err
	}
	
	return nil
}

func (h *UserStatsHandler) UnlockAchievement(userID, achievementType, achievementName string) error {
	_, err := h.db.Exec(`
		INSERT INTO user_achievements (user_id, achievement_type, achievement_name, unlocked_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id, achievement_type) DO NOTHING
	`, userID, achievementType, achievementName)
	return err
}

// GetPublicProfile returns the public profile for any user by ID
func (h *UserStatsHandler) GetPublicProfile(w http.ResponseWriter, r *http.Request) {
	// Extract user_id from URL path: /api/users/{user_id}/profile
	path := r.URL.Path
	// Expected format: /api/users/USER_ID/profile
	var userID string
	_, err := fmt.Sscanf(path, "/api/users/%s/profile", &userID)
	if err != nil || userID == "" {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}
	// Remove trailing "/profile" if it got included
	userID = strings.TrimSuffix(userID, "/profile")

	profile, err := h.getPublicProfile(userID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		log.Printf("Error getting public profile: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func (h *UserStatsHandler) getPublicProfile(userID string) (*PublicProfile, error) {
	profile := &PublicProfile{
		UserID:       userID,
		Level:        1,
		Achievements: []string{},
	}

	// Get user info from auth_users
	row := h.db.QueryRow(`
		SELECT COALESCE(display_name, ''), COALESCE(avatar_url, '')
		FROM auth_users
		WHERE id = $1
	`, userID)
	err := row.Scan(&profile.DisplayName, &profile.AvatarURL)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Get stats
	row = h.db.QueryRow(`
		SELECT COALESCE(parties_created, 0), COALESCE(parties_joined, 0),
		       COALESCE(total_xp, 0), COALESCE(level, 1), COALESCE(current_streak, 0)
		FROM user_stats
		WHERE user_id = $1
	`, userID)
	err = row.Scan(&profile.PartiesCreated, &profile.PartiesJoined,
		&profile.TotalXP, &profile.Level, &profile.CurrentStreak)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Get achievement types
	rows, err := h.db.Query(`
		SELECT achievement_type
		FROM user_achievements
		WHERE user_id = $1
	`, userID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var achType string
			if err := rows.Scan(&achType); err == nil {
				profile.Achievements = append(profile.Achievements, achType)
			}
		}
	}

	return profile, nil
}

// CheckAndUnlockAchievements checks all achievement conditions and unlocks them
func (h *UserStatsHandler) CheckAndUnlockAchievements(userID string, isNightTime bool) {
	stats, err := h.getUserStats(userID)
	if err != nil {
		log.Printf("Error getting stats for achievements: %v", err)
		return
	}

	// Party creation achievements
	if stats.PartiesCreated >= 1 {
		h.UnlockAchievement(userID, "first_party", "Первая пати")
	}
	if stats.PartiesCreated >= 10 {
		h.UnlockAchievement(userID, "activist", "Активист")
	}
	if stats.PartiesCreated >= 50 {
		h.UnlockAchievement(userID, "veteran", "Ветеран")
	}
	if stats.PartiesCreated >= 100 {
		h.UnlockAchievement(userID, "legend", "Легенда")
	}

	// Join achievements
	if stats.PartiesJoined >= 10 {
		h.UnlockAchievement(userID, "teammate", "Тиммейт")
	}
	if stats.PartiesJoined >= 50 {
		h.UnlockAchievement(userID, "team_player", "Командный игрок")
	}

	// Streak achievements
	if stats.CurrentStreak >= 7 || stats.LongestStreak >= 7 {
		h.UnlockAchievement(userID, "week_streak", "Неделя огня")
	}
	if stats.CurrentStreak >= 30 || stats.LongestStreak >= 30 {
		h.UnlockAchievement(userID, "month_streak", "Месяц огня")
	}

	// Night gamer (checked when party is created)
	if isNightTime {
		h.UnlockAchievement(userID, "night_gamer", "Ночной геймер")
	}
}

// CheckQuickFillAchievement checks if party was filled within 5 minutes
func (h *UserStatsHandler) CheckQuickFillAchievement(userID string, partyCreatedAt time.Time) {
	if time.Since(partyCreatedAt) <= 5*time.Minute {
		h.UnlockAchievement(userID, "quick_fill", "Быстрый старт")
	}
}

// CheckSniperAchievement checks if user has 100% fill rate on 10+ parties
func (h *UserStatsHandler) CheckSniperAchievement(userID string) {
	var totalParties, filledParties int
	row := h.db.QueryRow(`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE joined >= slots)
		FROM parties
		WHERE user_id = $1
	`, userID)
	if err := row.Scan(&totalParties, &filledParties); err != nil {
		return
	}

	if totalParties >= 10 && totalParties == filledParties {
		h.UnlockAchievement(userID, "sniper", "Снайпер")
	}
}

