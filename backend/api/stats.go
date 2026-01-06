package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq"
)

type StatsHandler struct {
	db *sql.DB
}

func NewStatsHandler(db *sql.DB) *StatsHandler {
	return &StatsHandler{
		db: db,
	}
}

type StatsResponse struct {
	PartiesCreated int `json:"parties_created"`
	PeopleJoined   int `json:"people_joined"`
	PartiesFilled  int `json:"parties_filled"`
}

func (h *StatsHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats := StatsResponse{
		PartiesCreated: 0,
		PeopleJoined:   0,
		PartiesFilled:  0,
	}

	// Get total parties created
	err := h.db.QueryRow(`
		SELECT COUNT(*) FROM parties
	`).Scan(&stats.PartiesCreated)
	if err != nil {
		log.Printf("Error getting parties count: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Get total people joined (sum of all joined counts)
	err = h.db.QueryRow(`
		SELECT COALESCE(SUM(joined), 0) FROM parties
	`).Scan(&stats.PeopleJoined)
	if err != nil {
		log.Printf("Error getting people joined count: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Get filled parties count (where joined >= slots)
	err = h.db.QueryRow(`
		SELECT COUNT(*) FROM parties WHERE joined >= slots
	`).Scan(&stats.PartiesFilled)
	if err != nil {
		log.Printf("Error getting filled parties count: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

