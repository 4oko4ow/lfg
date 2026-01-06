package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type DiscordUser struct {
	ID            string `json:"id"`
	Username      string `json:"username"`
	GlobalName    string `json:"global_name"`
	Discriminator string `json:"discriminator"`
}

type Identity struct {
	ID          int
	ProviderID  string
	Username    sql.NullString
	AccessToken sql.NullString
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

	log.Println("Starting Discord identities update...")

	// Get all Discord identities
	identities, err := getDiscordIdentities(db)
	if err != nil {
		log.Fatalf("failed to get identities: %v", err)
	}

	log.Printf("Found %d Discord identities", len(identities))

	updatedCount := 0
	skippedCount := 0
	errorCount := 0

	for _, identity := range identities {
		// Always try to fetch username from Discord API if we have access_token
		// This ensures we use username, not global_name (which might be stored in old records)
		if !identity.AccessToken.Valid || identity.AccessToken.String == "" {
			log.Printf("Skipping identity %d (provider_id: %s) - no access token", 
				identity.ID, identity.ProviderID)
			skippedCount++
			continue
		}

		// Fetch username from Discord API
		username, err := fetchDiscordUsername(identity.AccessToken.String)
		if err != nil {
			log.Printf("Error fetching username for identity %d (provider_id: %s): %v", 
				identity.ID, identity.ProviderID, err)
			errorCount++
			continue
		}

		if username == "" {
			log.Printf("Skipping identity %d (provider_id: %s) - empty username from API", 
				identity.ID, identity.ProviderID)
			skippedCount++
			continue
		}

		// Get current username for logging
		currentUsername := ""
		if identity.Username.Valid {
			currentUsername = identity.Username.String
		}

		// Always update if we got username from API, even if it matches current value
		// This ensures we're using the latest username from Discord (not stale global_name)
		// Only skip if current value is exactly the same AND we're confident it's correct
		// But to be safe, we'll always update when we have fresh data from API
		if currentUsername == username && currentUsername != "" {
			// Double-check: if current username looks like it might be global_name (contains spaces, etc),
			// we should still update. For now, we'll update anyway to be safe.
			log.Printf("Identity %d (provider_id: %s) - username matches API, but updating anyway to ensure correctness: %s", 
				identity.ID, identity.ProviderID, username)
		}

		// Update identity in database
		_, err = db.Exec(`
			UPDATE auth_identities 
			SET username = $1 
			WHERE id = $2
		`, username, identity.ID)

		if err != nil {
			log.Printf("Error updating identity %d (provider_id: %s): %v", 
				identity.ID, identity.ProviderID, err)
			errorCount++
			continue
		}

		// Also update contact if it exists
		_, _ = db.Exec(`
			UPDATE auth_contacts 
			SET handle = $1 
			WHERE user_id = (
				SELECT user_id FROM auth_identities WHERE id = $2
			)
			AND provider = 'discord'
		`, username, identity.ID)

		log.Printf("Updated identity %d (provider_id: %s): '%s' -> '%s'", 
			identity.ID, identity.ProviderID, currentUsername, username)
		updatedCount++
	}

	log.Printf("Update completed: %d updated, %d skipped, %d errors", updatedCount, skippedCount, errorCount)
}

func getDiscordIdentities(db *sql.DB) ([]Identity, error) {
	query := `
		SELECT id, provider_id, username, access_token 
		FROM auth_identities 
		WHERE provider = 'discord'
		ORDER BY id
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var identities []Identity
	for rows.Next() {
		var identity Identity
		var username sql.NullString
		var accessToken sql.NullString

		if err := rows.Scan(&identity.ID, &identity.ProviderID, &username, &accessToken); err != nil {
			continue
		}

		identity.Username = username
		identity.AccessToken = accessToken
		identities = append(identities, identity)
	}

	return identities, rows.Err()
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

