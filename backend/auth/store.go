package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Provider string

const (
	ProviderDiscord  Provider = "discord"
	ProviderSteam    Provider = "steam"
	ProviderTelegram Provider = "telegram"
)

type User struct {
	ID               string    `json:"id"`
	DisplayName      string    `json:"display_name"`
	PreferredContact *Provider `json:"preferred_contact,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type Identity struct {
	Provider   Provider  `json:"provider"`
	ProviderID string    `json:"provider_id"`
	Username   string    `json:"username"`
	URL        string    `json:"url"`
	LinkedAt   time.Time `json:"linked_at"`
}

type ContactHandle struct {
	Provider  Provider  `json:"provider"`
	Handle    string    `json:"handle"`
	URL       string    `json:"url"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Profile struct {
	User       User            `json:"user"`
	Identities []Identity      `json:"identities"`
	Contacts   []ContactHandle `json:"contacts"`
}

type userRecord struct {
	User       User                        `json:"user"`
	Identities map[Provider]identityRecord `json:"identities"`
	Contacts   map[Provider]contactRecord  `json:"contacts"`
}

type identityRecord struct {
	ProviderID   string    `json:"provider_id"`
	Username     string    `json:"username"`
	URL          string    `json:"url"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	LinkedAt     time.Time `json:"linked_at"`
}

type contactRecord struct {
	Handle    string    `json:"handle"`
	URL       string    `json:"url"`
	UpdatedAt time.Time `json:"updated_at"`
}

type persistedState struct {
	Users         map[string]*userRecord `json:"users"`
	IdentityIndex map[string]string      `json:"identity_index"`
}

// StoreInterface defines the interface for user/identity storage
type StoreInterface interface {
	UpsertIdentity(linkUserID string, provider Provider, providerID, username, url, accessToken, refreshToken string) (*Profile, error)
	GetProfile(userID string) (*Profile, error)
	UpdateContact(userID string, provider Provider, handle, url string) (*Profile, error)
	SetPreferredContact(userID string, provider *Provider) error
	Close() error
}

type Store struct {
	path  string
	mu    sync.RWMutex
	state persistedState
}

var ErrIdentityLinked = errors.New("identity already linked to another user")

func NewStore(path string) (*Store, error) {
	if path == "" {
		path = "data/auth.json"
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create auth dir: %w", err)
	}
	store := &Store{
		path: path,
		state: persistedState{
			Users:         make(map[string]*userRecord),
			IdentityIndex: make(map[string]string),
		},
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("[Auth] Auth store file does not exist, starting fresh: %s", s.path)
			return nil
		}
		return err
	}
	if len(data) == 0 {
		log.Printf("[Auth] Auth store file is empty, starting fresh")
		return nil
	}
	if err := json.Unmarshal(data, &s.state); err != nil {
		return fmt.Errorf("decode auth store: %w", err)
	}
	if s.state.Users == nil {
		s.state.Users = make(map[string]*userRecord)
	}
	if s.state.IdentityIndex == nil {
		s.state.IdentityIndex = make(map[string]string)
	}
	log.Printf("[Auth] Loaded auth store: %d users, %d identity mappings", len(s.state.Users), len(s.state.IdentityIndex))
	return nil
}

func (s *Store) saveLocked() error {
	tmp := s.path + ".tmp"
	data, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func identityKey(provider Provider, providerID string) string {
	return string(provider) + ":" + providerID
}

func (s *Store) UpsertIdentity(linkUserID string, provider Provider, providerID, username, url, accessToken, refreshToken string) (*Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state.Users == nil {
		s.state.Users = make(map[string]*userRecord)
	}
	if s.state.IdentityIndex == nil {
		s.state.IdentityIndex = make(map[string]string)
	}

	key := identityKey(provider, providerID)
	if existingUserID, ok := s.state.IdentityIndex[key]; ok {
		log.Printf("[Auth] Found existing identity %s -> user %s", key, existingUserID)
		if linkUserID != "" && existingUserID != linkUserID {
			log.Printf("[Auth] Identity %s already linked to user %s, but trying to link to %s", key, existingUserID, linkUserID)
			return nil, ErrIdentityLinked
		}
		linkUserID = existingUserID
		log.Printf("[Auth] Using existing user ID: %s", linkUserID)
	} else {
		log.Printf("[Auth] No existing identity found for %s", key)
	}

	userID := linkUserID
	now := time.Now().UTC()
	if userID == "" {
		userID = uuid.NewString()
		log.Printf("[Auth] Creating new user ID: %s for identity %s", userID, key)
	} else {
		log.Printf("[Auth] Using provided/linked user ID: %s", userID)
	}

	record, ok := s.state.Users[userID]
	if !ok {
		if username == "" {
			username = fmt.Sprintf("%s_%s", provider, providerID)
		}
		record = &userRecord{
			User: User{
				ID:          userID,
				DisplayName: username,
				CreatedAt:   now,
				UpdatedAt:   now,
			},
			Identities: make(map[Provider]identityRecord),
			Contacts:   make(map[Provider]contactRecord),
		}
		s.state.Users[userID] = record
	}

	if username != "" {
		record.User.DisplayName = username
	}
	record.User.UpdatedAt = now

	record.Identities[provider] = identityRecord{
		ProviderID:   providerID,
		Username:     username,
		URL:          url,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		LinkedAt:     now,
	}
	s.state.IdentityIndex[key] = userID
	log.Printf("[Auth] Updated identity index: %s -> %s (total mappings: %d)", key, userID, len(s.state.IdentityIndex))

	if username != "" {
		if record.Contacts == nil {
			record.Contacts = make(map[Provider]contactRecord)
		}
		record.Contacts[provider] = contactRecord{
			Handle:    username,
			URL:       url,
			UpdatedAt: now,
		}
	}

	if err := s.saveLocked(); err != nil {
		log.Printf("[Auth] Error saving auth store: %v", err)
		return nil, err
	}
	log.Printf("[Auth] Successfully saved auth store with %d users, %d identity mappings", len(s.state.Users), len(s.state.IdentityIndex))
	return buildProfile(record), nil
}

func buildProfile(rec *userRecord) *Profile {
	profile := &Profile{
		User: rec.User,
	}
	if rec.User.PreferredContact != nil {
		profile.User.PreferredContact = rec.User.PreferredContact
	}
	for provider, ident := range rec.Identities {
		profile.Identities = append(profile.Identities, Identity{
			Provider:   provider,
			ProviderID: ident.ProviderID,
			Username:   ident.Username,
			URL:        ident.URL,
			LinkedAt:   ident.LinkedAt,
		})
	}
	for provider, contact := range rec.Contacts {
		profile.Contacts = append(profile.Contacts, ContactHandle{
			Provider:  provider,
			Handle:    contact.Handle,
			URL:       contact.URL,
			UpdatedAt: contact.UpdatedAt,
		})
	}
	return profile
}

func (s *Store) GetProfile(userID string) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rec, ok := s.state.Users[userID]
	if !ok {
		return nil, nil
	}
	return buildProfile(rec), nil
}

func (s *Store) UpdateContact(userID string, provider Provider, handle, url string) (*Profile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.state.Users[userID]
	if !ok {
		return nil, errors.New("user not found")
	}
	if rec.Contacts == nil {
		rec.Contacts = make(map[Provider]contactRecord)
	}
	if handle == "" {
		delete(rec.Contacts, provider)
	} else {
		rec.Contacts[provider] = contactRecord{
			Handle:    handle,
			URL:       url,
			UpdatedAt: time.Now().UTC(),
		}
	}
	rec.User.UpdatedAt = time.Now().UTC()
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return buildProfile(rec), nil
}

func (s *Store) SetPreferredContact(userID string, provider *Provider) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.state.Users[userID]
	if !ok {
		return errors.New("user not found")
	}
	rec.User.PreferredContact = provider
	rec.User.UpdatedAt = time.Now().UTC()
	return s.saveLocked()
}

func (s *Store) Close() error {
	return nil
}
