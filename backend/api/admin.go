package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"lfg/auth"
	"lfg/ws"
)

type AdminHandler struct {
	db             *sql.DB
	sessionManager *auth.SessionManager
}

func NewAdminHandler(db *sql.DB, sessionManager *auth.SessionManager) *AdminHandler {
	return &AdminHandler{db: db, sessionManager: sessionManager}
}

func (h *AdminHandler) isAdmin(r *http.Request) bool {
	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		return false
	}
	var isAdmin bool
	err = h.db.QueryRow("SELECT is_admin FROM auth_users WHERE id = $1", userID).Scan(&isAdmin)
	return err == nil && isAdmin
}

func (h *AdminHandler) DeleteParty(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.isAdmin(r) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, err := h.db.Exec("DELETE FROM parties WHERE id = $1", req.ID)
	if err != nil {
		log.Printf("Error deleting party (admin): %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	ws.RemovePartyFromMemory(req.ID)
	ws.Broadcast(ws.Message{Type: "party_remove", Payload: map[string]string{"id": req.ID}})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *AdminHandler) HideParty(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !h.isAdmin(r) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	_, err := h.db.Exec("UPDATE parties SET hidden = TRUE WHERE id = $1", req.ID)
	if err != nil {
		log.Printf("Error hiding party (admin): %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	ws.RemovePartyFromMemory(req.ID)
	ws.Broadcast(ws.Message{Type: "party_remove", Payload: map[string]string{"id": req.ID}})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
