package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"

	_ "github.com/lib/pq"
)

type CommunityLeadsHandler struct {
	db *sql.DB
}

func NewCommunityLeadsHandler(db *sql.DB) *CommunityLeadsHandler {
	return &CommunityLeadsHandler{db: db}
}

type CommunityLeadRequest struct {
	Email         string `json:"email"`
	Platform      string `json:"platform"`       // discord, telegram, both
	CommunitySize string `json:"community_size"` // under_100, 100_500, 500_1000, over_1000
	WillingToPay  string `json:"willing_to_pay"` // yes, maybe, no
	CommunityName string `json:"community_name"` // optional
	Games         string `json:"games"`          // optional
}

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

func (h *CommunityLeadsHandler) CreateLead(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req CommunityLeadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	req.Email = strings.TrimSpace(req.Email)
	req.Platform = strings.TrimSpace(strings.ToLower(req.Platform))
	req.CommunitySize = strings.TrimSpace(strings.ToLower(req.CommunitySize))
	req.WillingToPay = strings.TrimSpace(strings.ToLower(req.WillingToPay))
	req.CommunityName = strings.TrimSpace(req.CommunityName)
	req.Games = strings.TrimSpace(req.Games)

	if req.Email == "" || !emailRegex.MatchString(req.Email) {
		http.Error(w, "Valid email is required", http.StatusBadRequest)
		return
	}

	validPlatforms := map[string]bool{"discord": true, "telegram": true, "both": true}
	if !validPlatforms[req.Platform] {
		http.Error(w, "Platform must be discord, telegram, or both", http.StatusBadRequest)
		return
	}

	validSizes := map[string]bool{"under_100": true, "100_500": true, "500_1000": true, "over_1000": true}
	if !validSizes[req.CommunitySize] {
		http.Error(w, "Invalid community size", http.StatusBadRequest)
		return
	}

	validWilling := map[string]bool{"yes": true, "maybe": true, "no": true}
	if !validWilling[req.WillingToPay] {
		http.Error(w, "willing_to_pay must be yes, maybe, or no", http.StatusBadRequest)
		return
	}

	// Ensure table exists
	_, err := h.db.Exec(`
		CREATE TABLE IF NOT EXISTS community_leads (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			email TEXT NOT NULL,
			platform TEXT NOT NULL,
			community_size TEXT NOT NULL,
			willing_to_pay TEXT NOT NULL,
			community_name TEXT,
			games TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)
	`)
	if err != nil {
		log.Printf("Error ensuring community_leads table exists: %v", err)
	}

	// Insert lead
	_, err = h.db.Exec(`
		INSERT INTO community_leads (email, platform, community_size, willing_to_pay, community_name, games)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, req.Email, req.Platform, req.CommunitySize, req.WillingToPay, nullIfEmpty(req.CommunityName), nullIfEmpty(req.Games))

	if err != nil {
		log.Printf("Error creating community lead: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("[CommunityLead] New lead: email=%s, platform=%s, size=%s, willing=%s",
		req.Email, req.Platform, req.CommunitySize, req.WillingToPay)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
