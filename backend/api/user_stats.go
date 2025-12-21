package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
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

