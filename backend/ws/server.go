package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var clients = make(map[*websocket.Conn]bool)

func HandleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}
	defer ws.Close()

	clients[ws] = true
	defer delete(clients, ws)

	sendInitialState(ws)

	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Println("read error:", err)
			break
		}

		var message Message
		if err := json.Unmarshal(msg, &message); err != nil {
			log.Println("invalid message format:", err)
			continue
		}

		switch message.Type {
		case "create_party":
			var payload CreatePartyPayload
			if err := parsePayload(message.Payload, &payload); err != nil {
				log.Println("invalid create payload:", err)
				continue
			}

			p := &Party{
				ID:        generateID(),
				Game:      payload.Game,
				Goal:      payload.Goal,
				Slots:     payload.Slots,
				Joined:    1,
				CreatedAt: time.Now(),
				Contact:   payload.Contact,
			}

			AddParty(p, true)
			Broadcast(Message{Type: "new_party", Payload: p})

		case "join_party":
			var payload JoinPartyPayload
			if err := parsePayload(message.Payload, &payload); err != nil {
				log.Println("invalid join payload:", err)
				continue
			}
			UpdatePartyJoined(payload.ID)
		}
	}
}

func parsePayload(payload interface{}, v interface{}) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func sendInitialState(ws *websocket.Conn) {
	initial := GetParties()

	ws.WriteJSON(Message{
		Type:    "initial_state",
		Payload: initial,
	})
}

func Broadcast(msg Message) {
	for client := range clients {
		if err := client.WriteJSON(msg); err != nil {
			log.Println("broadcast error:", err)
			client.Close()
			delete(clients, client)
		}
	}
}
