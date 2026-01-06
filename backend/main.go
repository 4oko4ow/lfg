package main

import (
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"lfg/api"
	"lfg/auth"
	"lfg/ws"
)

func getAllowedOrigins() []string {
	// Get from environment variable first
	if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
		origins := strings.Split(envOrigins, ",")
		// Trim whitespace
		for i := range origins {
			origins[i] = strings.TrimSpace(origins[i])
		}
		return origins
	}
	// Default fallback
	return []string{
		"https://findparty.online",
		"https://www.findparty.online",
		"https://lfg.findparty.online", // backend domain
		"http://localhost:5173",        // for local development
		"http://localhost:3000",        // for local development
	}
}

func allowOrigin(o string, allowedOrigins []string) bool {
	o = strings.ToLower(strings.TrimSpace(o))
	for _, a := range allowedOrigins {
		a = strings.ToLower(strings.TrimSpace(a))
		if a == o {
			return true
		}
		// Support wildcard patterns like *.vercel.app
		if strings.HasPrefix(a, "https://*.") && strings.HasSuffix(o, strings.TrimPrefix(a, "https://*")) {
			return true
		}
	}
	return false
}

func cors(allowedOrigins []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			
			// Handle preflight requests
			if r.Method == http.MethodOptions {
				if origin != "" {
					if allowOrigin(origin, allowedOrigins) {
						w.Header().Set("Access-Control-Allow-Origin", origin)
						w.Header().Set("Vary", "Origin")
						w.Header().Set("Access-Control-Allow-Credentials", "true")
						w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
						w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
						w.Header().Set("Access-Control-Max-Age", "86400")
						log.Printf("[CORS] Preflight allowed for origin: %s", origin)
					} else {
						log.Printf("[CORS] Preflight rejected for origin: %s (not in allowed list)", origin)
					}
				} else {
					log.Printf("[CORS] Preflight request with no Origin header")
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}

			// Handle actual requests
			if origin != "" {
				if allowOrigin(origin, allowedOrigins) {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Vary", "Origin")
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				} else {
					log.Printf("[CORS] Request rejected for origin: %s (not in allowed list)", origin)
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}

func main() {

	rand.Seed(time.Now().UnixNano())

	ws.InitDB()

	secret := os.Getenv("AUTH_JWT_SECRET")
	if secret == "" {
		log.Fatal("AUTH_JWT_SECRET must be set")
	}

	// Try to use database store first, fallback to file store
	var store auth.StoreInterface
	dbStore, err := auth.NewDBStore()
	if err != nil {
		log.Printf("[Auth] Database store not available, using file store: %v", err)
		fileStore, err := auth.NewStore(os.Getenv("AUTH_DB_PATH"))
		if err != nil {
			log.Fatalf("failed to init auth store: %v", err)
		}
		store = fileStore
	} else {
		log.Println("[Auth] Using database-backed user store")
		store = dbStore
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

	// Set session manager for WebSocket
	ws.SetSessionManager(sessionManager)
	mux.HandleFunc("/ws", ws.HandleConnections)

	// API endpoints
	db := ws.GetDB()
	if db != nil {
		chatHandler := api.NewChatHandler(db)
		gamesHandler := api.NewGamesHandler(db)
		userStatsHandler := api.NewUserStatsHandler(db, sessionManager)
		partiesHandler := api.NewPartiesHandler(db, sessionManager)
		statsHandler := api.NewStatsHandler(db)
		
		mux.HandleFunc("/api/chat/messages", chatHandler.GetMessages)
		mux.HandleFunc("/api/chat/messages/create", chatHandler.CreateMessage)
		mux.HandleFunc("/api/games/suggest", gamesHandler.SuggestGame)
		mux.HandleFunc("/api/user/stats", userStatsHandler.GetStats)
		mux.HandleFunc("/api/user/parties", partiesHandler.GetUserParties)
		mux.HandleFunc("/api/parties/delete", partiesHandler.DeleteParty)
		mux.HandleFunc("/api/parties/update", partiesHandler.UpdateParty)
		mux.HandleFunc("/api/stats", statsHandler.GetStats)
	}

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// 🧹 Включаем автоочистку старых пати
	//go ws.StartPartyCleanupLoop()

	// Get allowed origins and apply CORS middleware
	allowedOrigins := getAllowedOrigins()
	log.Printf("CORS allowed origins: %v", allowedOrigins)
	
	log.Println("Server started on :8080")
	http.ListenAndServe(":8080", cors(allowedOrigins)(mux))
}
