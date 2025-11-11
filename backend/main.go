package main

import (
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"lfg/auth"
	"lfg/ws"
)

func main() {

	rand.Seed(time.Now().UnixNano())

	ws.InitDB()

	secret := os.Getenv("AUTH_JWT_SECRET")
	if secret == "" {
		log.Fatal("AUTH_JWT_SECRET must be set")
	}

	store, err := auth.NewStore(os.Getenv("AUTH_DB_PATH"))
	if err != nil {
		log.Fatalf("failed to init auth store: %v", err)
	}
	defer store.Close()

	secureCookie := os.Getenv("AUTH_COOKIE_SECURE") == "true"
	sessionManager := auth.NewSessionManager(secret, os.Getenv("AUTH_COOKIE_NAME"), os.Getenv("AUTH_COOKIE_DOMAIN"), secureCookie)

	handler := auth.NewHandler(store, sessionManager, auth.Config{
		FrontendURL: os.Getenv("FRONTEND_URL"),
		BaseURL:     os.Getenv("BACKEND_URL"),
		Discord: auth.OAuthConfig{
			ClientID:     os.Getenv("DISCORD_CLIENT_ID"),
			ClientSecret: os.Getenv("DISCORD_CLIENT_SECRET"),
		},
		Steam: auth.SteamConfig{
			APIKey: os.Getenv("STEAM_WEB_API_KEY"),
		},
		Telegram: auth.TelegramConfig{
			BotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
		},
	})

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	mux.HandleFunc("/ws", ws.HandleConnections)

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// 🧹 Включаем автоочистку старых пати
	//go ws.StartPartyCleanupLoop()

	log.Println("Server started on :8080")
	http.ListenAndServe(":8080", mux)
}
