package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/supabase-community/supabase-go"
)

type DBStore struct {
	client *supabase.Client
}

// Custom unmarshalers for time fields (Supabase returns RFC3339 strings)
type dbUser struct {
	ID               string     `json:"id"`
	DisplayName      string     `json:"display_name"`
	PreferredContact *string    `json:"preferred_contact"`
	CreatedAt        string     `json:"created_at"`
	UpdatedAt        string     `json:"updated_at"`
}

func (u *dbUser) parseTimes() (time.Time, time.Time, error) {
	created, err := time.Parse(time.RFC3339, u.CreatedAt)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	updated, err := time.Parse(time.RFC3339, u.UpdatedAt)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	return created, updated, nil
}

type dbIdentity struct {
	ID           int      `json:"id"`
	UserID       string   `json:"user_id"`
	Provider     string   `json:"provider"`
	ProviderID   string   `json:"provider_id"`
	Username     *string  `json:"username"`
	URL          *string  `json:"url"`
	AccessToken  *string  `json:"access_token"`
	RefreshToken *string  `json:"refresh_token"`
	LinkedAt     string   `json:"linked_at"`
}

func (i *dbIdentity) parseLinkedAt() (time.Time, error) {
	return time.Parse(time.RFC3339, i.LinkedAt)
}

type dbContact struct {
	ID        int     `json:"id"`
	UserID    string  `json:"user_id"`
	Provider  string  `json:"provider"`
	Handle    string  `json:"handle"`
	URL       *string `json:"url"`
	UpdatedAt string  `json:"updated_at"`
}

func (c *dbContact) parseUpdatedAt() (time.Time, error) {
	return time.Parse(time.RFC3339, c.UpdatedAt)
}

func NewDBStore() (*DBStore, error) {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if url == "" || key == "" {
		return nil, errors.New("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
	}

	client, err := supabase.NewClient(url, key, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create Supabase client: %w", err)
	}

	store := &DBStore{client: client}
	
	// Test connection
	_, _, testErr := client.
		From("auth_users").
		Select("id", "", false).
		Execute()
	
	if testErr != nil {
		log.Printf("[Auth] ⚠️  Warning: Could not access auth_users table: %v", testErr)
		log.Printf("[Auth] ⚠️  Make sure the table exists. Run the migration: migrations/create_auth_users_table.sql")
		return nil, fmt.Errorf("auth_users table not accessible: %w", testErr)
	}
	
	log.Println("[Auth] ✅ Using database-backed user storage (users will persist across restarts)")
	return store, nil
}

func (s *DBStore) UpsertIdentity(linkUserID string, provider Provider, providerID, username, url, accessToken, refreshToken string) (*Profile, error) {
	// Check if identity already exists
	key := string(provider) + ":" + providerID
	existingIdentity, err := s.findIdentityByProvider(provider, providerID)
	
	var userID string
	if err == nil && existingIdentity != nil {
		// Identity exists, use its user_id
		userID = existingIdentity.UserID
		log.Printf("[Auth] Found existing identity %s -> user %s", key, userID)
		
		if linkUserID != "" && userID != linkUserID {
			log.Printf("[Auth] ⚠️  CONFLICT: Identity %s already linked to user %s, but trying to link to %s", key, userID, linkUserID)
			log.Printf("[Auth] ⚠️  This identity belongs to another account. User must unlink it from the other account first.")
			return nil, ErrIdentityLinked
		}
		// If linkUserID matches or is empty, we're updating the existing identity
		if linkUserID != "" {
			log.Printf("[Auth] Updating existing identity %s for user %s", key, userID)
		}
	} else {
		// New identity
		if linkUserID != "" {
			userID = linkUserID
			log.Printf("[Auth] Creating new identity %s for existing user %s", key, userID)
		} else {
			userID = uuid.NewString()
			log.Printf("[Auth] Creating new user ID: %s for identity %s", userID, key)
		}
	}

	// Get or create user
	user, err := s.getUser(userID)
	if err != nil {
		return nil, err
	}
	
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	if user == nil {
		// Create new user
		if username == "" {
			username = fmt.Sprintf("%s_%s", provider, providerID)
		}
		user = &dbUser{
			ID:          userID,
			DisplayName: username,
			CreatedAt:   nowStr,
			UpdatedAt:   nowStr,
		}
		if err := s.createUser(user); err != nil {
			return nil, err
		}
	} else {
		// Update existing user
		if username != "" {
			user.DisplayName = username
		}
		user.UpdatedAt = nowStr
		if err := s.updateUser(user); err != nil {
			return nil, err
		}
	}

	// Upsert identity using ON CONFLICT
	// Build the identity data map (excluding id, which is auto-generated)
	identityData := map[string]interface{}{
		"user_id":   userID,
		"provider":  string(provider),
		"provider_id": providerID,
		"linked_at": nowStr,
	}
	if username != "" {
		identityData["username"] = username
	}
	if url != "" {
		identityData["url"] = url
	}
	if accessToken != "" {
		identityData["access_token"] = accessToken
	}
	if refreshToken != "" {
		identityData["refresh_token"] = refreshToken
	}

	if existingIdentity != nil {
		// Update existing identity
		log.Printf("[Auth] Updating existing identity %s for user %s", key, userID)
		_, _, err := s.client.
			From("auth_identities").
			Update(identityData, "", "").
			Eq("id", fmt.Sprintf("%d", existingIdentity.ID)).
			Execute()
		if err != nil {
			return nil, fmt.Errorf("failed to update identity: %w", err)
		}
		log.Printf("[Auth] ✅ Identity updated successfully")
	} else {
		// Insert new identity (id will be auto-generated by SERIAL)
		log.Printf("[Auth] Inserting new identity %s for user %s", key, userID)
		_, _, err := s.client.
			From("auth_identities").
			Insert(identityData, false, "", "representation", "").
			Execute()
		if err != nil {
			log.Printf("[Auth] ❌ Error inserting identity: %v", err)
			return nil, fmt.Errorf("failed to create identity: %w", err)
		}
		log.Printf("[Auth] ✅ Identity inserted successfully")
	}

	// Upsert contact if username provided
	if username != "" {
		contact := &dbContact{
			UserID:    userID,
			Provider:  string(provider),
			Handle:    username,
			UpdatedAt: nowStr,
		}
		if url != "" {
			contact.URL = &url
		}
		if err := s.upsertContact(contact); err != nil {
			log.Printf("[Auth] Warning: Failed to upsert contact: %v", err)
		}
	}

	log.Printf("[Auth] ✅ Identity upserted successfully. Fetching profile for user: %s", userID)
	profile, err := s.GetProfile(userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, fmt.Errorf("profile not found after upserting identity")
	}
	log.Printf("[Auth] ✅ Profile retrieved: user=%s, identities=%d (providers: %v)", 
		profile.User.ID, 
		len(profile.Identities),
		func() []string {
			providers := make([]string, len(profile.Identities))
			for i, ident := range profile.Identities {
				providers[i] = string(ident.Provider)
			}
			return providers
		}())
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

	createdAt, updatedAt, err := user.parseTimes()
	if err != nil {
		return nil, fmt.Errorf("failed to parse user times: %w", err)
	}

	profile := &Profile{
		User: User{
			ID:               user.ID,
			DisplayName:      user.DisplayName,
			PreferredContact: preferredContact,
			CreatedAt:        createdAt,
			UpdatedAt:        updatedAt,
		},
		Identities: make([]Identity, 0, len(identities)),
		Contacts:   make([]ContactHandle, 0, len(contacts)),
	}

	for _, ident := range identities {
		linkedAt, err := ident.parseLinkedAt()
		if err != nil {
			return nil, fmt.Errorf("failed to parse identity linked_at: %w", err)
		}
		profile.Identities = append(profile.Identities, Identity{
			Provider:   Provider(ident.Provider),
			ProviderID: ident.ProviderID,
			Username:   getStringPtr(ident.Username),
			URL:        getStringPtr(ident.URL),
			LinkedAt:   linkedAt,
		})
	}

	for _, contact := range contacts {
		updatedAt, err := contact.parseUpdatedAt()
		if err != nil {
			return nil, fmt.Errorf("failed to parse contact updated_at: %w", err)
		}
		profile.Contacts = append(profile.Contacts, ContactHandle{
			Provider:  Provider(contact.Provider),
			Handle:    contact.Handle,
			URL:       getStringPtr(contact.URL),
			UpdatedAt: updatedAt,
		})
	}

	return profile, nil
}

func (s *DBStore) UpdateContact(userID string, provider Provider, handle, url string) (*Profile, error) {
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)
	
	if handle == "" {
		// Delete contact
		_, _, err := s.client.
			From("auth_contacts").
			Delete("user_id", "eq."+userID).
			Eq("provider", string(provider)).
			Execute()
		if err != nil {
			return nil, fmt.Errorf("failed to delete contact: %w", err)
		}
	} else {
		contact := &dbContact{
			UserID:    userID,
			Provider:  string(provider),
			Handle:    handle,
			UpdatedAt: nowStr,
		}
		if url != "" {
			contact.URL = &url
		}
		if err := s.upsertContact(contact); err != nil {
			return nil, err
		}
	}

	// Update user updated_at
	_, _, err := s.client.
		From("auth_users").
		Update(map[string]interface{}{"updated_at": nowStr}, "", "").
		Eq("id", userID).
		Execute()
	if err != nil {
		log.Printf("[Auth] Warning: Failed to update user updated_at: %v", err)
	}

	return s.GetProfile(userID)
}

func (s *DBStore) SetPreferredContact(userID string, provider *Provider) error {
	update := map[string]interface{}{"updated_at": time.Now().UTC().Format(time.RFC3339)}
	if provider != nil {
		pc := string(*provider)
		update["preferred_contact"] = &pc
	} else {
		update["preferred_contact"] = nil
	}

	_, _, err := s.client.
		From("auth_users").
		Update(update, "", "").
		Eq("id", userID).
		Execute()
	return err
}

func (s *DBStore) Close() error {
	return nil
}

// Helper methods

func (s *DBStore) getUser(userID string) (*dbUser, error) {
	data, _, err := s.client.
		From("auth_users").
		Select("*", "", false).
		Eq("id", userID).
		Execute()
	if err != nil {
		return nil, err
	}

	var users []dbUser
	if err := json.Unmarshal(data, &users); err != nil {
		return nil, err
	}

	if len(users) == 0 {
		return nil, nil
	}
	return &users[0], nil
}

func (s *DBStore) createUser(user *dbUser) error {
	_, _, err := s.client.
		From("auth_users").
		Insert(user, false, "", "representation", "").
		Execute()
	return err
}

func (s *DBStore) updateUser(user *dbUser) error {
	_, _, err := s.client.
		From("auth_users").
		Update(user, "", "").
		Eq("id", user.ID).
		Execute()
	return err
}

func (s *DBStore) findIdentityByProvider(provider Provider, providerID string) (*dbIdentity, error) {
	data, _, err := s.client.
		From("auth_identities").
		Select("*", "", false).
		Eq("provider", string(provider)).
		Eq("provider_id", providerID).
		Execute()
	if err != nil {
		return nil, err
	}

	var identities []dbIdentity
	if err := json.Unmarshal(data, &identities); err != nil {
		return nil, err
	}

	if len(identities) == 0 {
		return nil, errors.New("not found")
	}
	return &identities[0], nil
}

func (s *DBStore) getIdentities(userID string) ([]dbIdentity, error) {
	data, _, err := s.client.
		From("auth_identities").
		Select("*", "", false).
		Eq("user_id", userID).
		Execute()
	if err != nil {
		log.Printf("[Auth] Error fetching identities for user %s: %v", userID, err)
		return nil, err
	}

	var identities []dbIdentity
	if err := json.Unmarshal(data, &identities); err != nil {
		log.Printf("[Auth] Error unmarshalling identities for user %s: %v", userID, err)
		return nil, err
	}
	log.Printf("[Auth] Found %d identities for user %s: %v", len(identities), userID, 
		func() []string {
			providers := make([]string, len(identities))
			for i, ident := range identities {
				providers[i] = ident.Provider
			}
			return providers
		}())
	return identities, nil
}



func (s *DBStore) getContacts(userID string) ([]dbContact, error) {
	data, _, err := s.client.
		From("auth_contacts").
		Select("*", "", false).
		Eq("user_id", userID).
		Execute()
	if err != nil {
		return nil, err
	}

	var contacts []dbContact
	if err := json.Unmarshal(data, &contacts); err != nil {
		return nil, err
	}
	return contacts, nil
}

func (s *DBStore) upsertContact(contact *dbContact) error {
	// Try to find existing contact
	data, _, err := s.client.
		From("auth_contacts").
		Select("id", "", false).
		Eq("user_id", contact.UserID).
		Eq("provider", contact.Provider).
		Execute()
	
	if err == nil {
		var existing []struct{ ID int `json:"id"` }
		if err := json.Unmarshal(data, &existing); err == nil && len(existing) > 0 {
			// Update existing
			_, _, err = s.client.
				From("auth_contacts").
				Update(contact, "", "").
				Eq("id", fmt.Sprintf("%d", existing[0].ID)).
				Execute()
			return err
		}
	}

	// Insert new
	_, _, err = s.client.
		From("auth_contacts").
		Insert(contact, false, "", "representation", "").
		Execute()
	return err
}

func getStringPtr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

