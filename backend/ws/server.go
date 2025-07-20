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

// HandleConnections управляет новым WebSocket-соединением
func HandleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}
	defer func() {
		ws.Close()
		delete(clients, ws)
		broadcastOnlineCount()
	}()

	clients[ws] = true
	broadcastOnlineCount()

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

		case "heartbeat":
			// опционально: обработка, если нужна (например, log/пинг)
		}
	}
}

// parsePayload извлекает payload в нужную структуру
func parsePayload(payload interface{}, v interface{}) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// sendInitialState отправляет клиенту актуальные пати
func sendInitialState(ws *websocket.Conn) {
	parties := LoadPartiesFromSupabase()
	ws.WriteJSON(Message{
		Type:    "initial_state",
		Payload: parties,
	})
}

// Broadcast рассылает сообщение всем клиентам
func Broadcast(msg Message) {
	for client := range clients {
		if err := client.WriteJSON(msg); err != nil {
			log.Println("broadcast error:", err)
			client.Close()
			delete(clients, client)
			broadcastOnlineCount() // обновить при дисконнекте
		}
	}
}

// broadcastOnlineCount отправляет актуальное число онлайн
func broadcastOnlineCount() {
	msg := Message{
		Type:    "online_count",
		Payload: len(clients),
	}
	for client := range clients {
		_ = client.WriteJSON(msg) // игнорировать ошибки здесь, они обрабатываются в Broadcast
	}
}
