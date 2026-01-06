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

type DBStore struct {
	db *sql.DB
}

// Custom unmarshalers for time fields
type dbUser struct {
	ID               string
	DisplayName      string
	PreferredContact *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type dbIdentity struct {
	ID           int
	UserID       string
	Provider     string
	ProviderID   string
	Username     *string
	URL          *string
	AccessToken  *string
	RefreshToken *string
	LinkedAt     time.Time
}

type dbContact struct {
	ID        int
	UserID    string
	Provider  string
	Handle    string
	URL       *string
	UpdatedAt time.Time
}

func NewDBStore() (*DBStore, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, errors.New("DATABASE_URL must be set")
	}

	// Add prefer_simple_protocol=true to prevent prepared statement issues
	// This fixes "pq: unnamed prepared statement does not exist" errors
	// Required for Supabase Transaction mode pooler (port 6543) which doesn't support prepared statements
	dbURL = addConnectionParam(dbURL, "prefer_simple_protocol", "true")

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool for Supabase/PgBouncer compatibility
	// For Transaction mode pooler (port 6543), connections are short-lived
	// Lower limits for free tier (Supabase free tier has connection limits)
	// prefer_simple_protocol=true already set above prevents prepared statement issues
	db.SetMaxOpenConns(10)  // Reduced for Supabase free tier compatibility
	db.SetMaxIdleConns(2)   // Reduced for Supabase free tier compatibility
	// Shorter lifetime for Transaction mode - connections are reused by pooler
	db.SetConnMaxLifetime(2 * time.Minute)
	// Close idle connections faster to avoid stale connections
	db.SetConnMaxIdleTime(30 * time.Second)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &DBStore{db: db}

	// Test connection
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM auth_users").Scan(&count)
	if err != nil {
		log.Printf("[Auth] ⚠️  Warning: Could not access auth_users table: %v", err)
		log.Printf("[Auth] ⚠️  Make sure the table exists. Run the migration: migrations/create_auth_users_table.sql")
		return nil, fmt.Errorf("auth_users table not accessible: %w", err)
	}

	log.Println("[Auth] ✅ Using database-backed user storage (users will persist across restarts)")
	return store, nil
}

func (s *DBStore) UpsertIdentity(linkUserID string, provider Provider, providerID, username, url, accessToken, refreshToken string) (*Profile, error) {
	// Check if identity already exists
	existingIdentity, err := s.findIdentityByProvider(provider, providerID)

	var userID string
	if err == nil && existingIdentity != nil {
		// Identity exists, use its user_id
		userID = existingIdentity.UserID
		log.Printf("[Auth] Found existing identity %s:%s -> user %s", provider, providerID, userID)

		if linkUserID != "" && userID != linkUserID {
			log.Printf("[Auth] ⚠️  CONFLICT: Identity %s:%s already linked to user %s, but trying to link to %s", provider, providerID, userID, linkUserID)
			log.Printf("[Auth] ⚠️  This identity belongs to another account. User must unlink it from the other account first.")
			return nil, ErrIdentityLinked
		}
	} else {
		// New identity
		if linkUserID != "" {
			userID = linkUserID
			log.Printf("[Auth] Creating new identity %s:%s for existing user %s", provider, providerID, userID)
		} else {
			userID = uuid.NewString()
			log.Printf("[Auth] Creating new user ID: %s for identity %s:%s", userID, provider, providerID)
		}
	}

	// Get or create user
	user, err := s.getUser(userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if user == nil {
		// Create new user
		if username == "" {
			username = fmt.Sprintf("%s_%s", provider, providerID)
		}
		err = s.createUser(userID, username, now)
		if err != nil {
			return nil, err
		}
		user = &dbUser{
			ID:          userID,
			DisplayName: username,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
	} else {
		// Update existing user
		if username != "" {
			user.DisplayName = username
		}
		user.UpdatedAt = now
		if err := s.updateUser(user); err != nil {
			return nil, err
		}
	}

	// Upsert identity
	if existingIdentity != nil {
		// Update existing identity
		query := `
			UPDATE auth_identities 
			SET user_id = $1, username = $2, url = $3, access_token = $4, refresh_token = $5, linked_at = $6
			WHERE id = $7
		`
		_, err = s.db.Exec(query, userID, username, url, accessToken, refreshToken, now, existingIdentity.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to update identity: %w", err)
		}
	} else {
		// Insert new identity
		query := `
			INSERT INTO auth_identities (user_id, provider, provider_id, username, url, access_token, refresh_token, linked_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`
		_, err = s.db.Exec(query, userID, string(provider), providerID, username, url, accessToken, refreshToken, now)
		if err != nil {
			return nil, fmt.Errorf("failed to create identity: %w", err)
		}
	}

	// Upsert contact
	// IMPORTANT: For Discord, always use username (never global_name or user ID)
	contactHandle := username
	if contactHandle == "" {
		contactHandle = providerID
	}
	if provider == ProviderDiscord && contactHandle == providerID {
		// If we're using providerID as fallback for Discord, log a warning
		log.Printf("[Auth] WARNING: Discord contact handle is user ID (%s) instead of username", providerID)
	}

	if contactHandle != "" {
		contactURL := url
		err = s.upsertContact(userID, string(provider), contactHandle, contactURL, now)
		if err != nil {
			log.Printf("[Auth] Warning: Failed to upsert contact: %v", err)
		}
	}

	profile, err := s.GetProfile(userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, fmt.Errorf("profile not found after upserting identity")
	}

	return profile, nil
}

func (s *DBStore) GetProfile(userID string) (*Profile, error) {
	user, err := s.getUser(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	identities, err := s.getIdentities(userID)
	if err != nil {
		return nil, err
	}

	contacts, err := s.getContacts(userID)
	if err != nil {
		return nil, err
	}

	var preferredContact *Provider
	if user.PreferredContact != nil {
		pc := Provider(*user.PreferredContact)
		preferredContact = &pc
	}

	profile := &Profile{
		User: User{
			ID:               user.ID,
			DisplayName:      user.DisplayName,
			PreferredContact: preferredContact,
			CreatedAt:        user.CreatedAt,
			UpdatedAt:        user.UpdatedAt,
		},
		Identities: make([]Identity, 0, len(identities)),
		Contacts:   make([]ContactHandle, 0, len(contacts)),
	}

	for _, ident := range identities {
		profile.Identities = append(profile.Identities, Identity{
			Provider:   Provider(ident.Provider),
			ProviderID: ident.ProviderID,
			Username:   getStringPtr(ident.Username),
			URL:        getStringPtr(ident.URL),
			LinkedAt:   ident.LinkedAt,
		})
	}

	for _, contact := range contacts {
		profile.Contacts = append(profile.Contacts, ContactHandle{
			Provider:  Provider(contact.Provider),
			Handle:    contact.Handle,
			URL:       getStringPtr(contact.URL),
			UpdatedAt: contact.UpdatedAt,
		})
	}

	return profile, nil
}

func (s *DBStore) UpdateContact(userID string, provider Provider, handle, url string) (*Profile, error) {
	now := time.Now().UTC()

	if handle == "" {
		// Delete contact
		_, err := s.db.Exec("DELETE FROM auth_contacts WHERE user_id = $1 AND provider = $2", userID, string(provider))
		if err != nil {
			return nil, fmt.Errorf("failed to delete contact: %w", err)
		}
	} else {
		err := s.upsertContact(userID, string(provider), handle, url, now)
		if err != nil {
			return nil, err
		}
	}

	// Update user updated_at
	_, err := s.db.Exec("UPDATE auth_users SET updated_at = $1 WHERE id = $2", now, userID)
	if err != nil {
		log.Printf("[Auth] Warning: Failed to update user updated_at: %v", err)
	}

	return s.GetProfile(userID)
}

func (s *DBStore) SetPreferredContact(userID string, provider *Provider) error {
	now := time.Now().UTC()
	if provider != nil {
		pc := string(*provider)
		_, err := s.db.Exec("UPDATE auth_users SET preferred_contact = $1, updated_at = $2 WHERE id = $3", pc, now, userID)
		return err
	} else {
		_, err := s.db.Exec("UPDATE auth_users SET preferred_contact = NULL, updated_at = $1 WHERE id = $2", now, userID)
		return err
	}
}

func (s *DBStore) Close() error {
	return s.db.Close()
}

// Helper methods

func (s *DBStore) getUser(userID string) (*dbUser, error) {
	var user dbUser
	var preferredContact sql.NullString
	err := s.db.QueryRow(
		"SELECT id, display_name, preferred_contact, created_at, updated_at FROM auth_users WHERE id = $1",
		userID,
	).Scan(&user.ID, &user.DisplayName, &preferredContact, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if preferredContact.Valid {
		user.PreferredContact = &preferredContact.String
	}

	return &user, nil
}

func (s *DBStore) createUser(userID, displayName string, now time.Time) error {
	_, err := s.db.Exec(
		"INSERT INTO auth_users (id, display_name, created_at, updated_at) VALUES ($1, $2, $3, $4)",
		userID, displayName, now, now,
	)
	return err
}

func (s *DBStore) updateUser(user *dbUser) error {
	_, err := s.db.Exec(
		"UPDATE auth_users SET display_name = $1, updated_at = $2 WHERE id = $3",
		user.DisplayName, user.UpdatedAt, user.ID,
	)
	return err
}

func (s *DBStore) findIdentityByProvider(provider Provider, providerID string) (*dbIdentity, error) {
	var ident dbIdentity
	err := s.db.QueryRow(
		"SELECT id, user_id, provider, provider_id, username, url, access_token, refresh_token, linked_at FROM auth_identities WHERE provider = $1 AND provider_id = $2",
		string(provider), providerID,
	).Scan(
		&ident.ID, &ident.UserID, &ident.Provider, &ident.ProviderID,
		&ident.Username, &ident.URL, &ident.AccessToken, &ident.RefreshToken, &ident.LinkedAt,
	)

	if err == sql.ErrNoRows {
		return nil, errors.New("not found")
	}
	if err != nil {
		return nil, err
	}

	return &ident, nil
}

func (s *DBStore) getIdentities(userID string) ([]dbIdentity, error) {
	rows, err := s.db.Query(
		"SELECT id, user_id, provider, provider_id, username, url, access_token, refresh_token, linked_at FROM auth_identities WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var identities []dbIdentity
	for rows.Next() {
		var ident dbIdentity
		err := rows.Scan(
			&ident.ID, &ident.UserID, &ident.Provider, &ident.ProviderID,
			&ident.Username, &ident.URL, &ident.AccessToken, &ident.RefreshToken, &ident.LinkedAt,
		)
		if err != nil {
			return nil, err
		}
		identities = append(identities, ident)
	}

	return identities, rows.Err()
}

func (s *DBStore) getContacts(userID string) ([]dbContact, error) {
	rows, err := s.db.Query(
		"SELECT id, user_id, provider, handle, url, updated_at FROM auth_contacts WHERE user_id = $1",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contacts []dbContact
	for rows.Next() {
		var contact dbContact
		var url sql.NullString
		err := rows.Scan(&contact.ID, &contact.UserID, &contact.Provider, &contact.Handle, &url, &contact.UpdatedAt)
		if err != nil {
			return nil, err
		}
		if url.Valid {
			contact.URL = &url.String
		}
		contacts = append(contacts, contact)
	}

	return contacts, rows.Err()
}

func (s *DBStore) upsertContact(userID, provider, handle, url string, now time.Time) error {
	// Check if contact exists
	var existingID int
	err := s.db.QueryRow(
		"SELECT id FROM auth_contacts WHERE user_id = $1 AND provider = $2",
		userID, provider,
	).Scan(&existingID)

	if err == sql.ErrNoRows {
		// Insert new
		_, err = s.db.Exec(
			"INSERT INTO auth_contacts (user_id, provider, handle, url, updated_at) VALUES ($1, $2, $3, $4, $5)",
			userID, provider, handle, url, now,
		)
		return err
	}
	if err != nil {
		return err
	}

	// Update existing
	_, err = s.db.Exec(
		"UPDATE auth_contacts SET handle = $1, url = $2, updated_at = $3 WHERE id = $4",
		handle, url, now, existingID,
	)
	return err
}

func getStringPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

