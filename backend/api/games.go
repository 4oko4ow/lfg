package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	_ "github.com/lib/pq"
)

type GamesHandler struct {
	db *sql.DB
}

func NewGamesHandler(db *sql.DB) *GamesHandler {
	return &GamesHandler{db: db}
}

type SuggestGameRequest struct {
	Game string `json:"game"`
}

func (h *GamesHandler) SuggestGame(w http.ResponseWriter, r *http.Request) {
	var req SuggestGameRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Game == "" {
		http.Error(w, "Game name is required", http.StatusBadRequest)
		return
	}

	// Check if suggested_games table exists, create if not
	_, err := h.db.Exec(`
		CREATE TABLE IF NOT EXISTS suggested_games (
			id SERIAL PRIMARY KEY,
			game TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			added BOOLEAN NOT NULL DEFAULT FALSE
		)
	`)
	if err != nil {
		log.Printf("Error ensuring suggested_games table exists: %v", err)
	}

	_, err = h.db.Exec(`
		INSERT INTO suggested_games (game, created_at, added)
		VALUES ($1, NOW(), FALSE)
	`, req.Game)

	if err != nil {
		log.Printf("Error creating game suggestion: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

