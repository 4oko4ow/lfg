package auth

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/supabase-community/supabase-go"
)

type SessionStore struct {
	client *supabase.Client
}

type SessionRecord struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// UnmarshalJSON custom unmarshaler to handle Supabase timestamp format
func (s *SessionRecord) UnmarshalJSON(data []byte) error {
	var aux struct {
		ID        string `json:"id"`
		UserID    string `json:"user_id"`
		ExpiresAt string `json:"expires_at"`
		CreatedAt string `json:"created_at"`
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	s.ID = aux.ID
	s.UserID = aux.UserID
	
	// Parse timestamps (Supabase returns RFC3339 format)
	var err error
	if s.ExpiresAt, err = time.Parse(time.RFC3339, aux.ExpiresAt); err != nil {
		return err
	}
	if s.CreatedAt, err = time.Parse(time.RFC3339, aux.CreatedAt); err != nil {
		return err
	}
	return nil
}

func NewSessionStore() (*SessionStore, error) {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if url == "" || key == "" {
		return nil, errors.New("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
	}

	client, err := supabase.NewClient(url, key, nil)
	if err != nil {
		return nil, err
	}

	store := &SessionStore{client: client}
	
	// Cleanup expired sessions on startup
	go store.cleanupExpiredSessions()

	return store, nil
}

func (s *SessionStore) CreateSession(userID string, ttl time.Duration) (string, error) {
	sessionID := uuid.NewString()
	expiresAt := time.Now().Add(ttl)

	session := SessionRecord{
		ID:        sessionID,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}

	_, _, err := s.client.
		From("auth_sessions").
		Insert(session, false, "", "representation", "").
		Execute()

	if err != nil {
		log.Printf("Error creating session: %v", err)
		return "", err
	}

	return sessionID, nil
}

func (s *SessionStore) GetSession(sessionID string) (*SessionRecord, error) {
	data, _, err := s.client.
		From("auth_sessions").
		Select("*", "", false).
		Eq("id", sessionID).
		Execute()

	if err != nil {
		return nil, err
	}

	var sessions []SessionRecord
	if err := json.Unmarshal(data, &sessions); err != nil {
		return nil, err
	}

	if len(sessions) == 0 {
		return nil, errors.New("session not found")
	}

	session := sessions[0]

	// Check if expired
	if time.Now().After(session.ExpiresAt) {
		// Delete expired session
		s.DeleteSession(sessionID)
		return nil, errors.New("session expired")
	}

	return &session, nil
}

func (s *SessionStore) DeleteSession(sessionID string) error {
	_, _, err := s.client.
		From("auth_sessions").
		Delete("id", "eq."+sessionID).
		Execute()

	if err != nil {
		log.Printf("Error deleting session: %v", err)
		return err
	}

	return nil
}

func (s *SessionStore) DeleteUserSessions(userID string) error {
	_, _, err := s.client.
		From("auth_sessions").
		Delete("user_id", "eq."+userID).
		Execute()

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
		// Get all sessions and check expiration in code (safer than DB query)
		data, _, err := s.client.
			From("auth_sessions").
			Select("*", "", false).
			Execute()

		if err != nil {
			log.Printf("Error loading sessions for cleanup: %v", err)
			continue
		}

		var sessions []SessionRecord
		if err := json.Unmarshal(data, &sessions); err != nil {
			log.Printf("Error unmarshalling sessions: %v", err)
			continue
		}

		now := time.Now()
		deleted := 0
		for _, session := range sessions {
			if now.After(session.ExpiresAt) {
				if err := s.DeleteSession(session.ID); err == nil {
					deleted++
				}
			}
		}

		if deleted > 0 {
			log.Printf("Cleaned up %d expired sessions", deleted)
		}
	}
}

