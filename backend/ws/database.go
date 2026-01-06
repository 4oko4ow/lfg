package ws

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"
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

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Configure connection pool to prevent prepared statement issues
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

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
		INSERT INTO parties (id, game, goal, slots, joined, created_at, expires_at, contacts, pinned, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (id) DO UPDATE SET
			game = EXCLUDED.game,
			goal = EXCLUDED.goal,
			slots = EXCLUDED.slots,
			joined = EXCLUDED.joined,
			created_at = EXCLUDED.created_at,
			expires_at = EXCLUDED.expires_at,
			contacts = EXCLUDED.contacts,
			pinned = EXCLUDED.pinned,
			user_id = EXCLUDED.user_id
	`

	_, err = db.Exec(query,
		p.ID,
		p.Game,
		p.Goal,
		p.Slots,
		p.Joined,
		p.CreatedAt,
		p.ExpiresAt,
		string(contactsJSON),
		p.Pinned,
		p.UserID,
	)

	if err != nil {
		log.Printf("❌ Error saving party %s to database: %v", p.ID, err)
		return err
	}

	log.Printf("✅ Successfully saved party %s to database", p.ID)
	return nil
}

func LoadPartiesFromDatabase() []*Party {
	query := `SELECT id, game, goal, slots, joined, created_at, expires_at, contacts, pinned, user_id FROM parties ORDER BY created_at DESC`
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error loading parties from database: %v", err)
		return nil
	}
	defer rows.Close()

	var parties []*Party
	now := time.Now()
	for rows.Next() {
		var p Party
		var contactsJSON sql.NullString
		var pinned sql.NullBool
		var createdAt time.Time
		var expiresAt sql.NullTime
		var userID sql.NullString

		err := rows.Scan(
			&p.ID,
			&p.Game,
			&p.Goal,
			&p.Slots,
			&p.Joined,
			&createdAt,
			&expiresAt,
			&contactsJSON,
			&pinned,
			&userID,
		)
		if err != nil {
			log.Printf("Error scanning party: %v", err)
			continue
		}

		p.CreatedAt = createdAt
		if expiresAt.Valid {
			// Only include party if it hasn't expired
			if expiresAt.Time.After(now) {
				p.ExpiresAt = &expiresAt.Time
			} else {
				// Skip expired parties
				continue
			}
		}
		p.Pinned = pinned.Valid && pinned.Bool
		if userID.Valid {
			p.UserID = userID.String
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
