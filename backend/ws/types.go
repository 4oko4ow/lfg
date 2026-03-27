package ws

import "time"

type Party struct {
	ID        string          `json:"id"`
	Game      string          `json:"game"`
	Goal      string          `json:"goal"`
	Slots     int             `json:"slots"`
	Joined    int             `json:"joined"`
	CreatedAt time.Time       `json:"created_at"`
	ExpiresAt *time.Time      `json:"expires_at,omitempty"`
	Contacts  []ContactMethod `json:"contacts,omitempty"`
	Pinned    bool            `json:"pinned"`
	UserID    string          `json:"user_id,omitempty"`
}

type ContactMethod struct {
	Type      string `json:"type"`
	Handle    string `json:"handle"`
	URL       string `json:"url,omitempty"`
	Preferred bool   `json:"preferred,omitempty"`
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type CreatePartyPayload struct {
	Game      string          `json:"game"`
	Goal      string          `json:"goal"`
	Slots     int             `json:"slots"`
	ExpiresAt *time.Time      `json:"expires_at,omitempty"`
	Contacts  []ContactMethod `json:"contacts,omitempty"`
}

type JoinPartyPayload struct {
	ID string `json:"id"`
}

type SendChatPayload struct {
	Message     string `json:"message"`
	ClientMsgID string `json:"client_msg_id"`
}

type ChatMessagePayload struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	UserDisplayName string    `json:"user_display_name"`
	Message         string    `json:"message"`
	ClientMsgID     string    `json:"client_msg_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
