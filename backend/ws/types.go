package ws

import "time"

type Party struct {
	ID        string          `json:"id"`
	Game      string          `json:"game"`
	Goal      string          `json:"goal"`
	Slots     int             `json:"slots"`
	Joined    int             `json:"joined"`
	CreatedAt time.Time       `json:"created_at"`
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
	Game     string          `json:"game"`
	Goal     string          `json:"goal"`
	Slots    int             `json:"slots"`
	Contacts []ContactMethod `json:"contacts,omitempty"`
}

type JoinPartyPayload struct {
	ID string `json:"id"`
}
