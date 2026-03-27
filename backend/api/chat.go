package api

import (
	"database/sql"
	"encoding/json"
	"lfg/auth"
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"
)

type ChatHandler struct {
	db             *sql.DB
	sessionManager *auth.SessionManager
}

func NewChatHandler(db *sql.DB, sessionManager *auth.SessionManager) *ChatHandler {
	return &ChatHandler{db: db, sessionManager: sessionManager}
}

type ChatMessage struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	UserDisplayName string    `json:"user_display_name"`
	Message         string    `json:"message"`
	ClientMsgID     string    `json:"client_msg_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type CreateMessageRequest struct {
	UserID          string `json:"user_id"`
	UserDisplayName string `json:"user_display_name"`
	Message         string `json:"message"`
	ClientMsgID     string `json:"client_msg_id"`
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT id, user_id, user_display_name, message, client_msg_id, created_at
		FROM chat_messages
		ORDER BY created_at DESC
		LIMIT 50
	`)
	if err != nil {
		log.Printf("Error fetching chat messages: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []ChatMessage
	for rows.Next() {
		var msg ChatMessage
		var clientMsgID sql.NullString
		var userDisplayName sql.NullString
		err := rows.Scan(
			&msg.ID,
			&msg.UserID,
			&userDisplayName,
			&msg.Message,
			&clientMsgID,
			&msg.CreatedAt,
		)
		if err != nil {
			log.Printf("Error scanning message: %v", err)
			continue
		}
		if userDisplayName.Valid {
			msg.UserDisplayName = userDisplayName.String
		}
		if clientMsgID.Valid {
			msg.ClientMsgID = clientMsgID.String
		}
		messages = append(messages, msg)
	}

	// Reverse to get chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func (h *ChatHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var displayName string
	err = h.db.QueryRow(`SELECT COALESCE(display_name, '') FROM auth_users WHERE id = $1`, userID).Scan(&displayName)
	if err != nil {
		log.Printf("Error fetching display name for user %s: %v", userID, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var req struct {
		Message     string `json:"message"`
		ClientMsgID string `json:"client_msg_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	var id string
	err = h.db.QueryRow(`
		INSERT INTO chat_messages (user_id, user_display_name, message, client_msg_id, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		RETURNING id
	`, userID, displayName, req.Message, req.ClientMsgID).Scan(&id)

	if err != nil {
		log.Printf("Error creating chat message: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var msg ChatMessage
	var clientMsgID sql.NullString
	var userDisplayName sql.NullString
	err = h.db.QueryRow(`
		SELECT id, user_id, user_display_name, message, client_msg_id, created_at
		FROM chat_messages
		WHERE id = $1
	`, id).Scan(
		&msg.ID,
		&msg.UserID,
		&userDisplayName,
		&msg.Message,
		&clientMsgID,
		&msg.CreatedAt,
	)
	if userDisplayName.Valid {
		msg.UserDisplayName = userDisplayName.String
	}
	if clientMsgID.Valid {
		msg.ClientMsgID = clientMsgID.String
	}

	if err != nil {
		log.Printf("Error fetching created message: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

