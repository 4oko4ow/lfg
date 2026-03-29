package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"lfg/auth"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var clients = make(map[*websocket.Conn]bool)
var sessionManager *auth.SessionManager

// SetSessionManager sets the session manager for WebSocket connections
func SetSessionManager(sm *auth.SessionManager) {
	sessionManager = sm
}

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

                        // Extract user_id from session if available
                        var userID string
                        if sessionManager != nil {
                                if uid, err := sessionManager.Extract(r); err == nil {
                                        userID = uid
                                }
                        }

                        p := &Party{
                                ID:          generateID(),
                                Game:        payload.Game,
                                Goal:        payload.Goal,
                                Slots:       payload.Slots,
                                Joined:      1,
                                CreatedAt:   time.Now(),
                                ExpiresAt:   payload.ExpiresAt,
                                ScheduledAt: payload.ScheduledAt,
                                Contacts:    payload.Contacts,
                                UserID:      userID,
                                MicRequired: payload.MicRequired,
                                AgeRange:    payload.AgeRange,
                                SkillLevel:  payload.SkillLevel,
                        }

			AddParty(p, true)
			Broadcast(Message{Type: "new_party", Payload: p})

		case "join_party":
			var payload JoinPartyPayload
			if err := parsePayload(message.Payload, &payload); err != nil {
				log.Println("invalid join payload:", err)
				continue
			}
			// Extract user_id from session if available
			var userID string
			if sessionManager != nil {
				if uid, err := sessionManager.Extract(r); err == nil {
					userID = uid
				}
			}
			UpdatePartyJoined(payload.ID, userID)

			// Send system notification when authenticated user joins a party
			if userID != "" {
				db := GetDB()
				if db != nil {
					var displayName string
					db.QueryRow(`SELECT COALESCE(display_name, 'Player') FROM auth_users WHERE id = $1`, userID).Scan(&displayName)

					var game string
					db.QueryRow(`SELECT game FROM parties WHERE id = $1`, payload.ID).Scan(&game)

					sysMsgID := "sys-" + generateID()
					sysText := "🎮 " + displayName + " → " + game

					var msgID string
					var createdAt time.Time
					err := db.QueryRow(`
						INSERT INTO chat_messages (user_id, user_display_name, message, client_msg_id, created_at)
						VALUES (NULL, 'system', $1, $2, NOW())
						RETURNING id, created_at
					`, sysText, sysMsgID).Scan(&msgID, &createdAt)
					if err != nil {
						log.Printf("join_party system msg DB error: %v", err)
					} else {
						Broadcast(Message{
							Type: "chat_message",
							Payload: ChatMessagePayload{
								ID:              msgID,
								UserID:          "",
								UserDisplayName: "system",
								Message:         sysText,
								ClientMsgID:     sysMsgID,
								CreatedAt:       createdAt,
							},
						})
					}
				}
			}

		case "heartbeat":
			// опционально: обработка, если нужна (например, log/пинг)

		case "send_chat":
			var payload SendChatPayload
			if err := parsePayload(message.Payload, &payload); err != nil {
				log.Println("invalid send_chat payload:", err)
				continue
			}
			if payload.Message == "" {
				continue
			}
			// Auth check
			var userID string
			if sessionManager != nil {
				if uid, err := sessionManager.Extract(r); err == nil {
					userID = uid
				}
			}
			if userID == "" {
				log.Println("send_chat: unauthenticated")
				continue
			}

			db := GetDB()
			if db == nil {
				continue
			}

			// Fetch display name
			var displayName string
			db.QueryRow(`SELECT COALESCE(display_name, '') FROM auth_users WHERE id = $1`, userID).Scan(&displayName)

			// Save to DB
			var msgID string
			var createdAt time.Time
			err := db.QueryRow(`
				INSERT INTO chat_messages (user_id, user_display_name, message, client_msg_id, created_at)
				VALUES ($1, $2, $3, $4, NOW())
				RETURNING id, created_at
			`, userID, displayName, payload.Message, payload.ClientMsgID).Scan(&msgID, &createdAt)
			if err != nil {
				log.Printf("send_chat DB error: %v", err)
				continue
			}

			// Broadcast to all clients
			chatMsg := Message{
				Type: "chat_message",
				Payload: ChatMessagePayload{
					ID:              msgID,
					UserID:          userID,
					UserDisplayName: displayName,
					Message:         payload.Message,
					ClientMsgID:     payload.ClientMsgID,
					CreatedAt:       createdAt,
				},
			}
			Broadcast(chatMsg)
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
	parties := GetParties()
	ws.WriteJSON(Message{
		Type:    "initial_state",
		Payload: parties,
	})

	go ThrottledSync()
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
