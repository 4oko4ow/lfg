package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"lfg/auth"
	_ "github.com/lib/pq"
)

type PartiesHandler struct {
	db            *sql.DB
	sessionManager *auth.SessionManager
}

func NewPartiesHandler(db *sql.DB, sessionManager *auth.SessionManager) *PartiesHandler {
	return &PartiesHandler{
		db:            db,
		sessionManager: sessionManager,
	}
}

type PartyResponse struct {
	ID          string          `json:"id"`
	Game        string          `json:"game"`
	Goal        string          `json:"goal"`
	Slots       int             `json:"slots"`
	Joined      int             `json:"joined"`
	CreatedAt   time.Time       `json:"created_at"`
	ScheduledAt *time.Time      `json:"scheduled_at,omitempty"`
	Contacts    json.RawMessage `json:"contacts,omitempty"`
	Pinned      bool            `json:"pinned"`
}

func (h *PartiesHandler) GetUserParties(w http.ResponseWriter, r *http.Request) {
	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(`
		SELECT id, game, goal, slots, joined, created_at, scheduled_at, contacts, pinned
		FROM parties
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		log.Printf("Error getting user parties: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var parties []PartyResponse
	for rows.Next() {
		var p PartyResponse
		var contactsJSON sql.NullString
		var pinned sql.NullBool
		var createdAt time.Time
		var scheduledAt sql.NullTime

		err := rows.Scan(
			&p.ID,
			&p.Game,
			&p.Goal,
			&p.Slots,
			&p.Joined,
			&createdAt,
			&scheduledAt,
			&contactsJSON,
			&pinned,
		)
		if err != nil {
			log.Printf("Error scanning party: %v", err)
			continue
		}

		p.CreatedAt = createdAt
		p.Pinned = pinned.Valid && pinned.Bool
		if scheduledAt.Valid {
			p.ScheduledAt = &scheduledAt.Time
		}
		if contactsJSON.Valid && contactsJSON.String != "" {
			p.Contacts = json.RawMessage(contactsJSON.String)
		}

		parties = append(parties, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(parties)
}

func (h *PartiesHandler) DeleteParty(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var ownerID sql.NullString
	err = h.db.QueryRow("SELECT user_id FROM parties WHERE id = $1", req.ID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		http.Error(w, "Party not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("Error checking party ownership: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !ownerID.Valid || ownerID.String != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	_, err = h.db.Exec("DELETE FROM parties WHERE id = $1", req.ID)
	if err != nil {
		log.Printf("Error deleting party: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func (h *PartiesHandler) UpdateParty(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		ID      string          `json:"id"`
		Game    string          `json:"game"`
		Goal    string          `json:"goal"`
		Slots   int             `json:"slots"`
		Contacts json.RawMessage `json:"contacts,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify ownership
	var ownerID sql.NullString
	err = h.db.QueryRow("SELECT user_id FROM parties WHERE id = $1", req.ID).Scan(&ownerID)
	if err == sql.ErrNoRows {
		http.Error(w, "Party not found", http.StatusNotFound)
		return
	} else if err != nil {
		log.Printf("Error checking party ownership: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if !ownerID.Valid || ownerID.String != userID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	_, err = h.db.Exec(`
		UPDATE parties
		SET game = $1, goal = $2, slots = $3, contacts = $4
		WHERE id = $5
	`, req.Game, req.Goal, req.Slots, string(req.Contacts), req.ID)
	if err != nil {
		log.Printf("Error updating party: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

