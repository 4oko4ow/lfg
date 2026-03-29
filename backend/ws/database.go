package ws

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

var db *sql.DB

func GetDB() *sql.DB {
	return db
}

func InitDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL must be set")
	}

	// Add prefer_simple_protocol=true to prevent prepared statement issues
	// This fixes "pq: unnamed prepared statement does not exist" errors
	// Required for Supabase Transaction mode pooler (port 6543) which doesn't support prepared statements
	dbURL = addConnectionParam(dbURL, "prefer_simple_protocol", "true")

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
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
		log.Fatalf("failed to ping database: %v", err)
	}

	log.Println("🔄 Initial sync from database...")
	SynchronizeMemoryWithDatabase()
	log.Println("✅ Initial sync done. Server ready.")
}

func SavePartyToDatabase(p *Party) error {
	// Serialize contacts to JSON
	var contactsJSON []byte
	var err error
	if p.Contacts != nil && len(p.Contacts) > 0 {
		contactsJSON, err = json.Marshal(p.Contacts)
		if err != nil {
			log.Printf("Error marshalling contacts for party %s: %v", p.ID, err)
			return err
		}
	}

	// Try INSERT first, then UPDATE on conflict
	query := `
		INSERT INTO parties (id, game, goal, slots, joined, created_at, expires_at, scheduled_at, contacts, pinned, user_id, mic_required, age_range, skill_level)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (id) DO UPDATE SET
			game = EXCLUDED.game,
			goal = EXCLUDED.goal,
			slots = EXCLUDED.slots,
			joined = EXCLUDED.joined,
			created_at = EXCLUDED.created_at,
			expires_at = EXCLUDED.expires_at,
			scheduled_at = EXCLUDED.scheduled_at,
			contacts = EXCLUDED.contacts,
			pinned = EXCLUDED.pinned,
			user_id = EXCLUDED.user_id,
			mic_required = EXCLUDED.mic_required,
			age_range = EXCLUDED.age_range,
			skill_level = EXCLUDED.skill_level
	`

	_, err = db.Exec(query,
		p.ID,
		p.Game,
		p.Goal,
		p.Slots,
		p.Joined,
		p.CreatedAt,
		p.ExpiresAt,
		p.ScheduledAt,
		string(contactsJSON),
		p.Pinned,
		p.UserID,
		p.MicRequired,
		p.AgeRange,
		p.SkillLevel,
	)

	if err != nil {
		log.Printf("❌ Error saving party %s to database: %v", p.ID, err)
		return err
	}

	log.Printf("✅ Successfully saved party %s to database", p.ID)
	return nil
}

func LoadPartiesFromDatabase() []*Party {
	query := `SELECT id, game, goal, slots, joined, created_at, expires_at, scheduled_at, contacts, pinned, user_id, mic_required, age_range, skill_level FROM parties WHERE hidden = FALSE ORDER BY created_at DESC`
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error loading parties from database: %v", err)
		return nil
	}
	defer rows.Close()

	var parties []*Party
	now := time.Now()
	const threeDays = 3 * 24 * time.Hour
	const threeWeeks = 21 * 24 * time.Hour

	for rows.Next() {
		var p Party
		var contactsJSON sql.NullString
		var pinned sql.NullBool
		var createdAt time.Time
		var expiresAt sql.NullTime
		var scheduledAt sql.NullTime
		var userID sql.NullString
		var micRequired sql.NullBool
		var ageRange sql.NullString
		var skillLevel sql.NullString

		err := rows.Scan(
			&p.ID,
			&p.Game,
			&p.Goal,
			&p.Slots,
			&p.Joined,
			&createdAt,
			&expiresAt,
			&scheduledAt,
			&contactsJSON,
			&pinned,
			&userID,
			&micRequired,
			&ageRange,
			&skillLevel,
		)
		if err != nil {
			log.Printf("Error scanning party: %v", err)
			continue
		}

		p.CreatedAt = createdAt

		// Check if party has expired
		if expiresAt.Valid {
			if expiresAt.Time.After(now) {
				p.ExpiresAt = &expiresAt.Time
			} else {
				// Skip expired parties
				continue
			}
		}

		if scheduledAt.Valid {
			p.ScheduledAt = &scheduledAt.Time
		}

		// Filter out old parties based on frontend rules
		age := now.Sub(createdAt)
		isFull := p.Joined >= p.Slots
		
		// Skip old full parties (older than 3 days)
		if isFull && age > threeDays {
			continue
		}
		
		// Skip old unfilled parties (older than 3 weeks)
		if !isFull && age > threeWeeks {
			continue
		}

		p.Pinned = pinned.Valid && pinned.Bool
		if userID.Valid {
			p.UserID = userID.String
		}

		if micRequired.Valid {
			p.MicRequired = &micRequired.Bool
		}
		if ageRange.Valid {
			p.AgeRange = &ageRange.String
		}
		if skillLevel.Valid {
			p.SkillLevel = &skillLevel.String
		}

		// Parse contacts JSON if present
		if contactsJSON.Valid && contactsJSON.String != "" {
			if err := json.Unmarshal([]byte(contactsJSON.String), &p.Contacts); err != nil {
				log.Printf("Error unmarshalling contacts for party %s: %v", p.ID, err)
			}
		}

		parties = append(parties, &p)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating parties: %v", err)
		return nil
	}

	return parties
}

func RemovePartyFromDatabase(id string) {
	_, err := db.Exec("DELETE FROM parties WHERE id = $1", id)
	if err != nil {
		log.Printf("Error deleting party from database: %v", err)
	}
}

func UpdatePartyInDatabase(p *Party) {
	_, err := db.Exec("UPDATE parties SET joined = $1 WHERE id = $2", p.Joined, p.ID)
	if err != nil {
		log.Printf("Error updating party in database: %v", err)
	}
}

// savePartyMember saves a party membership to the database
func savePartyMember(partyID, userID string) {
	if db == nil {
		return
	}
	_, err := db.Exec(`
		INSERT INTO party_members (party_id, user_id, joined_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (party_id, user_id) DO NOTHING
	`, partyID, userID)
	if err != nil {
		log.Printf("Error saving party member: %v", err)
	}
}

// isUserMemberOfParty checks if a user is already a member of a party
func isUserMemberOfParty(partyID, userID string) bool {
	if db == nil || userID == "" {
		return false
	}
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM party_members
		WHERE party_id = $1 AND user_id = $2
	`, partyID, userID).Scan(&count)
	if err != nil {
		log.Printf("Error checking party membership: %v", err)
		return false
	}
	return count > 0
}

func SynchronizeMemoryWithDatabase() {
	partiesFromDB := LoadPartiesFromDatabase()

	partyLock.Lock()
	defer partyLock.Unlock()

	// Create map from DB for quick lookup
	dbParties := make(map[string]*Party)
	for _, p := range partiesFromDB {
		dbParties[p.ID] = p
	}

	// Merge: take from DB, but preserve recently created in-memory parties
	// that may not have been saved to DB yet
	now := time.Now()
	for id, memParty := range parties {
		age := now.Sub(memParty.CreatedAt)
		// If party in memory is newer than 5 minutes, preserve it (may not be saved to DB yet)
		if age < 5*time.Minute {
			if dbParty, exists := dbParties[id]; exists {
				// If exists in DB, use DB data (more up-to-date)
				parties[id] = dbParty
			} else {
				// If not in DB, keep in memory and try to save synchronously
				if err := SavePartyToDatabase(memParty); err != nil {
					log.Printf("⚠️  Failed to save party %s during sync: %v", id, err)
					// Don't remove from memory if save failed - try again next time
				}
			}
		} else {
			// Older parties: take from DB
			if dbParty, exists := dbParties[id]; exists {
				parties[id] = dbParty
			} else {
				// If not in DB and older than 5 minutes, remove from memory
				delete(parties, id)
				log.Printf("🗑️  Removed party %s from memory (not found in DB, age: %v)", id, age)
			}
		}
	}

	// Add parties from DB that aren't in memory
	for id, dbParty := range dbParties {
		if _, exists := parties[id]; !exists {
			parties[id] = dbParty
		}
	}

	log.Printf("[sync] Synchronized: %d parties in memory, %d from database", len(parties), len(partiesFromDB))
}

// addConnectionParam adds a parameter to a database connection string
// Handles both postgres:// and postgresql:// URLs, and existing query parameters
// Works with Supabase URLs which may have multiple parameters like:
// postgresql://user:pass@host:5432/db?sslmode=require&options=project%3Dxxx
func addConnectionParam(dbURL, key, value string) string {
	// Parse URL to check if parameter already exists
	// Check for both key= and &key= patterns to avoid duplicates
	if strings.Contains(dbURL, key+"=") {
		// Parameter might already exist, but check if it's a complete parameter
		// (not part of another parameter name)
		idx := strings.Index(dbURL, key+"=")
		if idx > 0 {
			// Check character before key - should be ? or &
			before := dbURL[idx-1]
			if before == '?' || before == '&' {
				return dbURL // Parameter already exists
			}
		} else if idx == 0 {
			// Key at start (unlikely but possible)
			return dbURL
		}
	}

	separator := "?"
	if strings.Contains(dbURL, "?") {
		separator = "&"
	}
	return dbURL + separator + key + "=" + value
}
