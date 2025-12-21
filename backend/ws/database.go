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
		INSERT INTO parties (id, game, goal, slots, joined, created_at, contacts, pinned)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET
			game = EXCLUDED.game,
			goal = EXCLUDED.goal,
			slots = EXCLUDED.slots,
			joined = EXCLUDED.joined,
			created_at = EXCLUDED.created_at,
			contacts = EXCLUDED.contacts,
			pinned = EXCLUDED.pinned
	`

	_, err = db.Exec(query,
		p.ID,
		p.Game,
		p.Goal,
		p.Slots,
		p.Joined,
		p.CreatedAt,
		string(contactsJSON),
		p.Pinned,
	)

	if err != nil {
		log.Printf("❌ Error saving party %s to database: %v", p.ID, err)
		return err
	}

	log.Printf("✅ Successfully saved party %s to database", p.ID)
	return nil
}

func LoadPartiesFromDatabase() []*Party {
	query := `SELECT id, game, goal, slots, joined, created_at, contacts, pinned FROM parties ORDER BY created_at DESC`
	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Error loading parties from database: %v", err)
		return nil
	}
	defer rows.Close()

	var parties []*Party
	for rows.Next() {
		var p Party
		var contactsJSON sql.NullString
		var createdAt time.Time

		err := rows.Scan(
			&p.ID,
			&p.Game,
			&p.Goal,
			&p.Slots,
			&p.Joined,
			&createdAt,
			&contactsJSON,
			&p.Pinned,
		)
		if err != nil {
			log.Printf("Error scanning party: %v", err)
			continue
		}

		p.CreatedAt = createdAt

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

	// Clear existing parties
	parties = make(map[string]*Party)

	// Load parties from database
	for _, dbParty := range partiesFromDB {
		parties[dbParty.ID] = dbParty
	}

	log.Printf("[sync] Loaded %d parties from database", len(parties))

	// Save any in-memory parties that aren't in DB
	for id, memParty := range parties {
		found := false
		for _, dbParty := range partiesFromDB {
			if dbParty.ID == id {
				found = true
				break
			}
		}
		if !found {
			log.Printf("[sync] Party %s exists in memory but not in DB, saving...", id)
			if err := SavePartyToDatabase(memParty); err != nil {
				log.Printf("[sync] Error saving party %s: %v", id, err)
			}
		}
	}
}

