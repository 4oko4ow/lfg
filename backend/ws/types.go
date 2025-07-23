package ws

import "time"

type Party struct {
	ID        string    `json:"id"`
	Game      string    `json:"game"`
	Goal      string    `json:"goal"`
	Slots     int       `json:"slots"`
	Joined    int       `json:"joined"`
	CreatedAt time.Time `json:"created_at"`
	Contact   string    `json:"contact,omitempty"`
	Pinned    bool      `json:"pinned"`
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type CreatePartyPayload struct {
	Game    string `json:"game"`
	Goal    string `json:"goal"`
	Slots   int    `json:"slots"`
	Contact string `json:"contact,omitempty"`
}

type JoinPartyPayload struct {
	ID string `json:"id"`
}
