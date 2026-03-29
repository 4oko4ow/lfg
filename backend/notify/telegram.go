package notify

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
)

var (
	botToken string
	chatID   string
	client   = &http.Client{}
)

func Init() {
	botToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID = os.Getenv("TELEGRAM_NOTIFY_CHAT_ID")
	if botToken != "" && chatID != "" {
		log.Println("[notify] Telegram notifications enabled")
	}
}

func enabled() bool {
	return botToken != "" && chatID != ""
}

func send(text string) {
	if !enabled() {
		return
	}
	body, _ := json.Marshal(map[string]string{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[notify] Telegram send error: %v", err)
		return
	}
	resp.Body.Close()
}

func NewParty(game, goal string, slots int, userID string) {
	text := fmt.Sprintf("🎮 <b>Новая пати</b>\nИгра: %s\nЦель: %s\nСлоты: %d", game, goal, slots)
	if userID != "" {
		text += fmt.Sprintf("\nАвтор: <code>%s</code>", userID)
	}
	go send(text)
}

func NewUser(displayName, provider string) {
	text := fmt.Sprintf("👤 <b>Новый пользователь</b>\nНик: %s\nВошёл через: %s", displayName, provider)
	go send(text)
}
