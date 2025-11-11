package main

import (
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"lfg/auth"
	"lfg/ws"
)

var allowedOrigins = []string{
	"https://findpaty.online",
	"https://www.findpaty.online",
	"http://localhost:5173", // for local development
	"http://localhost:3000", // for local development
	// при необходимости: превью Vercel
	// "https://*.vercel.app", // для wildcard сделай проверку вручную ниже
}

func allowOrigin(o string) bool {
	o = strings.ToLower(o)
	for _, a := range allowedOrigins {
		if a == o {
			return true
		}
		// прим.: простая поддержка *.vercel.app
		if strings.HasPrefix(a, "https://*.") && strings.HasSuffix(o, strings.TrimPrefix(a, "https://*")) {
			return true
		}
	}
	return false
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			// Если используешь cookie/Authorization — держи обе строки:
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
			// опционально: сколько кэшировать preflight
			w.Header().Set("Access-Control-Max-Age", "86400")
		}

		// Preflight
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

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
	
	// Parse session TTL from environment variable (in days, default: 365 days = 1 year)
	sessionTTLDays := 365
	if ttlStr := os.Getenv("AUTH_SESSION_TTL_DAYS"); ttlStr != "" {
		if parsed, err := strconv.Atoi(ttlStr); err == nil && parsed > 0 {
			sessionTTLDays = parsed
		}
	}
	sessionTTL := time.Duration(sessionTTLDays) * 24 * time.Hour
	log.Printf("Session TTL set to %d days (%v)", sessionTTLDays, sessionTTL)
	
	sessionManager := auth.NewSessionManagerWithTTL(secret, os.Getenv("AUTH_COOKIE_NAME"), os.Getenv("AUTH_COOKIE_DOMAIN"), secureCookie, sessionTTL)

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
	http.ListenAndServe(":8080", cors(mux))
}
