package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"time"

	_ "github.com/lib/pq"
)

type ContactMethod struct {
	Type      string `json:"type"`
	Handle    string `json:"handle"`
	URL       string `json:"url,omitempty"`
	Preferred bool   `json:"preferred,omitempty"`
}

type DiscordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Discriminator string `json:"discriminator"`
}

type PartyContact struct {
	PartyID  string
	Contacts []ContactMethod
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("failed to ping database: %v", err)
	}

	log.Println("Starting Discord contacts update...")

	// Get all parties with Discord contacts
	parties, err := getPartiesWithDiscordContacts(db)
	if err != nil {
		log.Fatalf("failed to get parties: %v", err)
	}

	log.Printf("Found %d parties with Discord contacts", len(parties))

	updatedCount := 0
	skippedCount := 0
	errorCount := 0

	for _, party := range parties {
		updated, err := updatePartyDiscordContacts(db, party)
		if err != nil {
			log.Printf("Error updating party %s: %v", party.PartyID, err)
			errorCount++
			continue
		}
		if updated {
			updatedCount++
		} else {
			skippedCount++
		}
	}

	log.Printf("Update completed: %d updated, %d skipped, %d errors", updatedCount, skippedCount, errorCount)
}

func getPartiesWithDiscordContacts(db *sql.DB) ([]PartyContact, error) {
	query := `
		SELECT id, contacts 
		FROM parties 
		WHERE contacts IS NOT NULL 
		AND jsonb_array_length(contacts) > 0
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var parties []PartyContact
	discordIDRegex := regexp.MustCompile(`^\d{17,19}$`)

	for rows.Next() {
		var partyID string
		var contactsJSON sql.NullString

		if err := rows.Scan(&partyID, &contactsJSON); err != nil {
			continue
		}

		if !contactsJSON.Valid || contactsJSON.String == "" {
			continue
		}

		var contacts []ContactMethod
		if err := json.Unmarshal([]byte(contactsJSON.String), &contacts); err != nil {
			continue
		}

		// Check if this party has Discord contacts with user IDs
		hasDiscordID := false
		for _, contact := range contacts {
			if contact.Type == "discord" && discordIDRegex.MatchString(contact.Handle) {
				hasDiscordID = true
				break
			}
		}

		if hasDiscordID {
			parties = append(parties, PartyContact{
				PartyID:  partyID,
				Contacts: contacts,
			})
		}
	}

	return parties, rows.Err()
}

func updatePartyDiscordContacts(db *sql.DB, party PartyContact) (bool, error) {
	discordIDRegex := regexp.MustCompile(`^\d{17,19}$`)
	updated := false
	updatedContacts := make([]ContactMethod, len(party.Contacts))

	for i, contact := range party.Contacts {
		updatedContacts[i] = contact

		if contact.Type != "discord" {
			continue
		}

		// Extract Discord user ID from URL or handle
		discordUserID := ""
		
		// Try to extract from URL first (format: https://discord.com/channels/@me/{user_id})
		if contact.URL != "" {
			urlRegex := regexp.MustCompile(`discord\.com/channels/@me/(\d{17,19})`)
			matches := urlRegex.FindStringSubmatch(contact.URL)
			if len(matches) > 1 {
				discordUserID = matches[1]
			}
		}
		
		// If not found in URL, check if handle is a user ID
		if discordUserID == "" && discordIDRegex.MatchString(contact.Handle) {
			discordUserID = contact.Handle
		}
		
		// If we still don't have user_id, skip this contact
		if discordUserID == "" {
			log.Printf("Party %s: Skipped Discord contact (no user_id found): handle=%s, url=%s", 
				party.PartyID, contact.Handle, contact.URL)
			continue
		}

		// First, try to get username from auth_identities
		var username string
		err := db.QueryRow(`
			SELECT username 
			FROM auth_identities 
			WHERE provider = 'discord' 
			AND provider_id = $1 
			AND username IS NOT NULL 
			AND username != ''
		`, discordUserID).Scan(&username)

		if err == nil && username != "" {
			// Found username in database - update only if different from current handle
			if username != contact.Handle {
				updatedContacts[i].Handle = username
				updated = true
				log.Printf("Party %s: Updated Discord contact '%s' -> '%s' (from DB, user_id: %s)", 
					party.PartyID, contact.Handle, username, discordUserID)
			} else {
				log.Printf("Party %s: Discord contact already correct: %s", 
					party.PartyID, username)
			}
			continue
		}

		// If not found in DB, try to get from Discord API using access_token
		var accessToken sql.NullString
		err = db.QueryRow(`
			SELECT access_token 
			FROM auth_identities 
			WHERE provider = 'discord' 
			AND provider_id = $1 
			AND access_token IS NOT NULL 
			AND access_token != ''
		`, discordUserID).Scan(&accessToken)

		if err == nil && accessToken.Valid && accessToken.String != "" {
			// Try to fetch username from Discord API
			username, err := fetchDiscordUsername(accessToken.String)
			if err == nil && username != "" {
				// Update only if different from current handle
				if username != contact.Handle {
					updatedContacts[i].Handle = username
					updated = true
					log.Printf("Party %s: Updated Discord contact '%s' -> '%s' (from API, user_id: %s)", 
						party.PartyID, contact.Handle, username, discordUserID)
				} else {
					log.Printf("Party %s: Discord contact already correct: %s", 
						party.PartyID, username)
				}
				
				// Also update auth_identities with the fetched username
				_, _ = db.Exec(`
					UPDATE auth_identities 
					SET username = $1 
					WHERE provider = 'discord' 
					AND provider_id = $2
				`, username, discordUserID)
				continue
			} else {
				log.Printf("Party %s: Failed to fetch username from Discord API for %s: %v", 
					party.PartyID, discordUserID, err)
			}
		}

		log.Printf("Party %s: Skipped Discord contact (no username found): handle='%s', user_id=%s", 
			party.PartyID, contact.Handle, discordUserID)
	}

	if !updated {
		return false, nil
	}

	// Update party contacts in database
	contactsJSON, err := json.Marshal(updatedContacts)
	if err != nil {
		return false, fmt.Errorf("failed to marshal contacts: %w", err)
	}

	_, err = db.Exec(`
		UPDATE parties 
		SET contacts = $1::jsonb 
		WHERE id = $2
	`, string(contactsJSON), party.PartyID)

	if err != nil {
		return false, fmt.Errorf("failed to update party: %w", err)
	}

	return true, nil
}

func fetchDiscordUsername(accessToken string) (string, error) {
	req, err := http.NewRequest("GET", "https://discord.com/api/users/@me", nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Discord API error: %d - %s", resp.StatusCode, string(body))
	}

	var discordUser DiscordUser
	if err := json.NewDecoder(resp.Body).Decode(&discordUser); err != nil {
		return "", err
	}

	// Use username instead of global_name
	username := discordUser.Username
	if discordUser.Discriminator != "0" && discordUser.Discriminator != "" {
		username = fmt.Sprintf("%s#%s", username, discordUser.Discriminator)
	}

	return username, nil
}

