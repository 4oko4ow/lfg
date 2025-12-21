package auth

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

type SessionStore struct {
	db *sql.DB
}

type SessionRecord struct {
	ID        string
	UserID    string
	ExpiresAt time.Time
	CreatedAt time.Time
}

func NewSessionStore() (*SessionStore, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, errors.New("DATABASE_URL must be set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &SessionStore{db: db}

	// Test connection
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM auth_sessions").Scan(&count)
	if err != nil {
		log.Printf("[Session] ⚠️  Warning: Could not access auth_sessions table: %v", err)
		log.Printf("[Session] ⚠️  Make sure the table exists. Run the migration: migrations/create_sessions_table.sql")
		// Don't fail completely - table might be created later
	} else {
		log.Println("[Session] ✅ Successfully connected to auth_sessions table")
	}

	// Cleanup expired sessions on startup
	go store.cleanupExpiredSessions()

	return store, nil
}

func (s *SessionStore) CreateSession(userID string, ttl time.Duration) (string, error) {
	sessionID := uuid.NewString()
	expiresAt := time.Now().Add(ttl)
	createdAt := time.Now()

	_, err := s.db.Exec(
		"INSERT INTO auth_sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)",
		sessionID, userID, expiresAt, createdAt,
	)

	if err != nil {
		log.Printf("Error creating session: %v", err)
		return "", err
	}

	return sessionID, nil
}

func (s *SessionStore) GetSession(sessionID string) (*SessionRecord, error) {
	var session SessionRecord
	err := s.db.QueryRow(
		"SELECT id, user_id, expires_at, created_at FROM auth_sessions WHERE id = $1",
		sessionID,
	).Scan(&session.ID, &session.UserID, &session.ExpiresAt, &session.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, errors.New("session not found")
	}
	if err != nil {
		return nil, err
	}

	// Check if expired
	if time.Now().After(session.ExpiresAt) {
		// Delete expired session
		s.DeleteSession(sessionID)
		return nil, errors.New("session expired")
	}

	return &session, nil
}

func (s *SessionStore) DeleteSession(sessionID string) error {
	_, err := s.db.Exec("DELETE FROM auth_sessions WHERE id = $1", sessionID)
	if err != nil {
		log.Printf("Error deleting session: %v", err)
		return err
	}
	return nil
}

func (s *SessionStore) DeleteUserSessions(userID string) error {
	_, err := s.db.Exec("DELETE FROM auth_sessions WHERE user_id = $1", userID)
	if err != nil {
		log.Printf("Error deleting user sessions: %v", err)
		return err
	}
	return nil
}

func (s *SessionStore) cleanupExpiredSessions() {
	// Wait a bit before first cleanup to ensure table exists
	time.Sleep(5 * time.Second)

	ticker := time.NewTicker(1 * time.Hour)
	for range ticker.C {
		// Delete expired sessions
		result, err := s.db.Exec("DELETE FROM auth_sessions WHERE expires_at < NOW()")
		if err != nil {
			log.Printf("Error cleaning up expired sessions: %v", err)
			continue
		}

		deleted, _ := result.RowsAffected()
		if deleted > 0 {
			log.Printf("Cleaned up %d expired sessions", deleted)
		}
	}
}

