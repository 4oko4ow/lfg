package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Config struct {
	FrontendURL string
	BaseURL     string
	Discord     OAuthConfig
	Steam       SteamConfig
	Telegram    TelegramConfig
}

type OAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectPath string
	Scopes       []string
}

type SteamConfig struct {
	APIKey       string
	RedirectPath string
}

type TelegramConfig struct {
	BotToken    string
	BotID       string
	BotUsername string
}

type Handler struct {
	store    StoreInterface
	sessions *SessionManager

	frontendURL string
	baseURL     string

	discordConfig discordSettings
	steamConfig   SteamConfig
	telegram      TelegramConfig
}

type discordSettings struct {
	clientID     string
	clientSecret string
	redirectURL  string
	scopes       []string
}

func NewHandler(store StoreInterface, sessions *SessionManager, cfg Config) *Handler {
	frontend := cfg.FrontendURL
	if frontend == "" {
		frontend = os.Getenv("FRONTEND_URL")
		if frontend == "" {
			frontend = "http://localhost:5173"
		}
	}
	base := cfg.BaseURL
	if base == "" {
		base = strings.TrimSpace(os.Getenv("BACKEND_URL"))
		if base == "" {
			base = "http://localhost:8080"
		}
	}
	base = strings.TrimSpace(base)

	discordRedirect := cfg.Discord.RedirectPath
	if discordRedirect == "" {
		discordRedirect = "/auth/discord/callback"
	}
	discordRedirectURL := joinURL(base, discordRedirect)
	log.Printf("[Auth] Discord redirect URL configured: %s (base: %s, path: %s)", discordRedirectURL, base, discordRedirect)
	discordConfig := discordSettings{
		clientID:     cfg.Discord.ClientID,
		clientSecret: cfg.Discord.ClientSecret,
		redirectURL:  discordRedirectURL,
		scopes:       append([]string{"identify"}, cfg.Discord.Scopes...),
	}

	if cfg.Steam.RedirectPath == "" {
		cfg.Steam.RedirectPath = "/auth/steam/callback"
	}

	telegramConfig := cfg.Telegram
	if telegramConfig.BotToken != "" {
		if telegramConfig.BotID == "" {
			if botID, err := resolveTelegramBotID(telegramConfig.BotToken); err != nil {
				log.Printf("failed to resolve telegram bot id: %v", err)
			} else {
				telegramConfig.BotID = botID
			}
		}
		if telegramConfig.BotUsername == "" {
			if username, err := resolveTelegramBotUsername(telegramConfig.BotToken); err != nil {
				log.Printf("failed to resolve telegram bot username: %v", err)
			} else {
				telegramConfig.BotUsername = username
				log.Printf("[Auth] Telegram bot username: %s", username)
			}
		}
	}

	return &Handler{
		store:         store,
		sessions:      sessions,
		frontendURL:   frontend,
		baseURL:       base,
		discordConfig: discordConfig,
		steamConfig:   cfg.Steam,
		telegram:      telegramConfig,
	}
}

func joinURL(base, path string) string {
	base = strings.TrimSpace(base)
	path = strings.TrimSpace(path)
	if strings.HasSuffix(base, "/") {
		base = strings.TrimSuffix(base, "/")
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return base + path
}

const stateCookieName = "lfg_auth_state"

type statePayload struct {
	Nonce    string `json:"nonce"`
	Redirect string `json:"redirect"`
	Link     bool   `json:"link"`
}

func sanitizeRedirect(raw string) string {
	if raw == "" {
		return "/"
	}
	if decoded, err := url.QueryUnescape(raw); err == nil && decoded != "" {
		raw = decoded
	}
	if strings.Contains(raw, "://") {
		return "/"
	}
	cleaned := path.Clean(raw)
	if cleaned == "." || cleaned == "" {
		cleaned = "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}
	return cleaned
}

func (h *Handler) writeStateCookie(w http.ResponseWriter, payload statePayload) error {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	sameSite := http.SameSiteLaxMode
	if h.sessions.secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    url.QueryEscape(string(encoded)),
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   h.sessions.secure,
		SameSite: sameSite,
	})
	return nil
}

func (h *Handler) readStateCookie(r *http.Request) (*statePayload, error) {
	cookie, err := r.Cookie(stateCookieName)
	if err != nil {
		return nil, err
	}
	decoded, err := url.QueryUnescape(cookie.Value)
	if err != nil {
		return nil, err
	}
	var payload statePayload
	if err := json.Unmarshal([]byte(decoded), &payload); err != nil {
		return nil, err
	}
	return &payload, nil
}

func (h *Handler) clearStateCookie(w http.ResponseWriter) {
	sameSite := http.SameSiteLaxMode
	if h.sessions.secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.sessions.secure,
		SameSite: sameSite,
	})
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/auth/session", h.handleSession)
	mux.HandleFunc("/auth/logout", h.handleLogout)
	mux.HandleFunc("/auth/config", h.handleConfig)
	mux.HandleFunc("/auth/contact", h.handleContact)
	mux.HandleFunc("/auth/preferred", h.handlePreferred)

	mux.HandleFunc("/auth/discord/login", h.handleDiscordLogin)
	mux.HandleFunc("/auth/discord/callback", h.handleDiscordCallback)

	mux.HandleFunc("/auth/steam/login", h.handleSteamLogin)
	mux.HandleFunc("/auth/steam/callback", h.handleSteamCallback)

	mux.HandleFunc("/auth/telegram/verify", h.handleTelegramVerify)
	mux.HandleFunc("/auth/telegram/callback", h.handleTelegramCallback)
}

func (h *Handler) getCurrentProfile(r *http.Request) (*Profile, error) {
	userID, err := h.sessions.Extract(r)
	if err != nil {
		return nil, nil
	}
	profile, err := h.store.GetProfile(userID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		log.Printf("[Auth] WARNING: session valid for user %s but profile not found", userID)
		return nil, nil
	}
	return profile, nil
}

func (h *Handler) handleSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	profile, err := h.getCurrentProfile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if profile == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	w.WriteHeader(http.StatusOK)
	writeJSON(w, profile)
}

func (h *Handler) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, map[string]any{
		"telegram_bot_id":       h.telegram.BotID,
		"telegram_bot_username": h.telegram.BotUsername,
	})
}

func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	h.sessions.Clear(w, r)
	w.WriteHeader(http.StatusNoContent)
}

type updateContactRequest struct {
	Provider Provider `json:"provider"`
	Handle   string   `json:"handle"`
	URL      string   `json:"url"`
}

func (h *Handler) handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	profile, err := h.getCurrentProfile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if profile == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body updateContactRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	updated, err := h.store.UpdateContact(profile.User.ID, body.Provider, strings.TrimSpace(body.Handle), strings.TrimSpace(body.URL))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, updated)
}

type preferredRequest struct {
	Provider *Provider `json:"provider"`
}

func (h *Handler) handlePreferred(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	profile, err := h.getCurrentProfile(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if profile == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body preferredRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Provider != nil {
		if *body.Provider != ProviderDiscord && *body.Provider != ProviderSteam && *body.Provider != ProviderTelegram {
			http.Error(w, "invalid provider", http.StatusBadRequest)
			return
		}
	}
	if err := h.store.SetPreferredContact(profile.User.ID, body.Provider); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	updated, err := h.store.GetProfile(profile.User.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, updated)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	// Note: If WriteHeader hasn't been called yet, writing will auto-set 200 OK
	json.NewEncoder(w).Encode(v)
}

func (h *Handler) handleDiscordLogin(w http.ResponseWriter, r *http.Request) {
	if h.discordConfig.clientID == "" || h.discordConfig.clientSecret == "" {
		http.Error(w, "discord login not configured", http.StatusServiceUnavailable)
		return
	}
	redirect := sanitizeRedirect(r.URL.Query().Get("redirect"))
	link := r.URL.Query().Get("link") == "1"
	state := uuid.NewString()
	if err := h.writeStateCookie(w, statePayload{Nonce: state, Redirect: redirect, Link: link}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	params := url.Values{
		"client_id":     {h.discordConfig.clientID},
		"redirect_uri":  {h.discordConfig.redirectURL},
		"response_type": {"code"},
		"scope":         {strings.Join(h.discordConfig.scopes, " ")},
		"prompt":        {"consent"},
		"state":         {state},
	}
	authURL := "https://discord.com/oauth2/authorize?" + params.Encode()
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (h *Handler) handleDiscordCallback(w http.ResponseWriter, r *http.Request) {
	if h.discordConfig.clientID == "" || h.discordConfig.clientSecret == "" {
		http.Error(w, "discord login not configured", http.StatusServiceUnavailable)
		return
	}
	payload, err := h.readStateCookie(r)
	if err != nil {
		log.Printf("[Auth] Failed to read state cookie: %v", err)
		http.Error(w, "missing state", http.StatusBadRequest)
		return
	}
	h.clearStateCookie(w)

	if payload.Nonce != r.URL.Query().Get("state") {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "discord_error"), http.StatusFound)
		return
	}

	token, err := h.exchangeDiscordCode(r.Context(), code)
	if err != nil {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "discord_error"), http.StatusFound)
		return
	}

	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://discord.com/api/users/@me", nil)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))
	resp, err := http.DefaultClient.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "discord_error"), http.StatusFound)
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var discordUser struct {
		ID            string `json:"id"`
		Username      string `json:"username"`
		GlobalName    string `json:"global_name"`
		Discriminator string `json:"discriminator"`
	}
	if err := json.Unmarshal(body, &discordUser); err != nil {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "discord_error"), http.StatusFound)
		return
	}

	// IMPORTANT: Always use username, never global_name
	handle := discordUser.Username
	if handle == "" {
		handle = discordUser.GlobalName
		if handle == "" {
			handle = discordUser.ID
		}
	}
	if discordUser.Discriminator != "0" && discordUser.Discriminator != "" {
		handle = fmt.Sprintf("%s#%s", handle, discordUser.Discriminator)
	}

	var linkUserID string
	if payload.Link {
		if current, err := h.sessions.Extract(r); err == nil {
			linkUserID = current
		}
	}

	profile, err := h.store.UpsertIdentity(linkUserID, ProviderDiscord, discordUser.ID, handle, "https://discord.com/channels/@me/"+discordUser.ID, token.AccessToken, token.RefreshToken)
	if err != nil {
		log.Printf("[Auth] Discord upsert failed: %v", err)
		status := "discord_error"
		if errors.Is(err, ErrIdentityLinked) {
			status = "discord_conflict"
		}
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, status), http.StatusFound)
		return
	}

	if !payload.Link {
		if err := h.sessions.Issue(w, profile.User.ID, 0); err != nil {
			log.Printf("[Auth] Failed to issue session: %v", err)
			http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "session_error"), http.StatusFound)
			return
		}
	}

	http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "success", "discord"), http.StatusFound)
}

type discordToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Scope        string `json:"scope"`
}

func (h *Handler) exchangeDiscordCode(ctx context.Context, code string) (*discordToken, error) {
	form := url.Values{
		"client_id":     {h.discordConfig.clientID},
		"client_secret": {h.discordConfig.clientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {h.discordConfig.redirectURL},
	}
	log.Printf("[Auth] Exchanging Discord code, redirect_uri=%s", h.discordConfig.redirectURL)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://discord.com/api/oauth2/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[Auth] Discord token exchange request failed: %v", err)
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		log.Printf("[Auth] Discord token exchange failed: status=%d, body=%s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("discord token exchange failed: %s, body: %s", resp.Status, string(body))
	}
	var token discordToken
	if err := json.Unmarshal(body, &token); err != nil {
		log.Printf("[Auth] Failed to decode Discord token response: %v, body: %s", err, string(body))
		return nil, err
	}
	log.Printf("[Auth] Discord token exchange successful")
	return &token, nil
}

func (h *Handler) frontendRedirect(redirectPath, status string, provider ...string) string {
	target := sanitizeRedirect(redirectPath)
	u := fmt.Sprintf("%s/auth/callback?status=%s&redirect=%s",
		strings.TrimRight(h.frontendURL, "/"),
		url.QueryEscape(status),
		url.QueryEscape(target),
	)
	if len(provider) > 0 && provider[0] != "" {
		u += "&provider=" + url.QueryEscape(provider[0])
	}
	return u
}

func (h *Handler) handleSteamLogin(w http.ResponseWriter, r *http.Request) {
	redirect := sanitizeRedirect(r.URL.Query().Get("redirect"))
	link := r.URL.Query().Get("link") == "1"
	nonce := uuid.NewString()
	if err := h.writeStateCookie(w, statePayload{Nonce: nonce, Redirect: redirect, Link: link}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	params := url.Values{
		"openid.ns":         {"http://specs.openid.net/auth/2.0"},
		"openid.mode":       {"checkid_setup"},
		"openid.identity":   {"http://specs.openid.net/auth/2.0/identifier_select"},
		"openid.claimed_id": {"http://specs.openid.net/auth/2.0/identifier_select"},
		"openid.return_to":  {joinURL(h.baseURL, h.steamConfig.RedirectPath) + "?state=" + nonce},
		"openid.realm":      {h.baseURL},
	}
	openidURL := "https://steamcommunity.com/openid/login?" + params.Encode()
	http.Redirect(w, r, openidURL, http.StatusFound)
}

func (h *Handler) handleSteamCallback(w http.ResponseWriter, r *http.Request) {
	payload, err := h.readStateCookie(r)
	if err != nil {
		http.Error(w, "missing state", http.StatusBadRequest)
		return
	}
	h.clearStateCookie(w)
	if payload.Nonce != r.URL.Query().Get("state") {
		http.Error(w, "state mismatch", http.StatusBadRequest)
		return
	}

	if err := h.verifySteamResponse(r); err != nil {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "steam_error"), http.StatusFound)
		return
	}
	claimed := r.URL.Query().Get("openid.claimed_id")
	if claimed == "" {
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "steam_error"), http.StatusFound)
		return
	}
	segments := strings.Split(strings.TrimRight(claimed, "/"), "/")
	steamID := segments[len(segments)-1]

	persona := steamID
	profileURL := "https://steamcommunity.com/profiles/" + steamID
	if h.steamConfig.APIKey != "" {
		persona = h.fetchSteamPersona(r.Context(), steamID)
	}

	var linkUserID string
	if payload.Link {
		if current, err := h.sessions.Extract(r); err == nil {
			linkUserID = current
		}
	}

	profile, err := h.store.UpsertIdentity(linkUserID, ProviderSteam, steamID, persona, profileURL, "", "")
	if err != nil {
		status := "steam_error"
		if errors.Is(err, ErrIdentityLinked) {
			status = "steam_conflict"
		}
		log.Printf("[Auth] Steam identity upsert failed: %v", err)
		http.Redirect(w, r, h.frontendRedirect(payload.Redirect, status), http.StatusFound)
		return
	}

	if !payload.Link {
		if err := h.sessions.Issue(w, profile.User.ID, 0); err != nil {
			log.Printf("[Auth] Failed to issue session: %v", err)
			http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "session_error"), http.StatusFound)
			return
		}
	}

	http.Redirect(w, r, h.frontendRedirect(payload.Redirect, "success", "steam"), http.StatusFound)
}

func (h *Handler) verifySteamResponse(r *http.Request) error {
	values := url.Values{}
	for key, vals := range r.URL.Query() {
		if strings.HasPrefix(key, "openid.") {
			for _, v := range vals {
				values.Add(key, v)
			}
		}
	}
	values.Set("openid.mode", "check_authentication")
	resp, err := http.PostForm("https://steamcommunity.com/openid/login", values)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "is_valid:true") {
		return errors.New("invalid steam response")
	}
	return nil
}

func (h *Handler) fetchSteamPersona(ctx context.Context, steamID string) string {
	type steamResponse struct {
		Response struct {
			Players []struct {
				PersonaName string `json:"personaname"`
			} `json:"players"`
		} `json:"response"`
	}
	apiURL := fmt.Sprintf("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=%s&steamids=%s", h.steamConfig.APIKey, steamID)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return steamID
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return steamID
	}
	var payload steamResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return steamID
	}
	if len(payload.Response.Players) > 0 && payload.Response.Players[0].PersonaName != "" {
		return payload.Response.Players[0].PersonaName
	}
	return steamID
}

func resolveTelegramBotUsername(token string) (string, error) {
	resp, err := http.Get("https://api.telegram.org/bot" + token + "/getMe")
	if err != nil {
		return "", fmt.Errorf("getMe request failed: %w", err)
	}
	defer resp.Body.Close()
	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("getMe decode failed: %w", err)
	}
	if !result.OK || result.Result.Username == "" {
		return "", errors.New("getMe returned no username")
	}
	return result.Result.Username, nil
}

func resolveTelegramBotID(token string) (string, error) {
	// Bot token format is: {bot_id}:{secret_hash}
	// Extract the bot ID (the part before the colon)
	parts := strings.Split(token, ":")
	if len(parts) < 2 {
		return "", errors.New("invalid telegram bot token format")
	}
	botID := parts[0]
	if botID == "" {
		return "", errors.New("telegram bot ID missing from token")
	}
	return botID, nil
}

type telegramVerifyRequest struct {
	AuthDate  string `json:"auth_date"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Username  string `json:"username"`
	PhotoURL  string `json:"photo_url"`
	Hash      string `json:"hash"`
	ID        string `json:"id"`
}

func (h *Handler) handleTelegramVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.telegram.BotToken == "" {
		http.Error(w, "telegram login disabled", http.StatusServiceUnavailable)
		return
	}
	var body telegramVerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("[Telegram] Failed to decode body: %v", err)
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	log.Printf("[Telegram] Verify request: id=%s username=%s auth_date=%s hash_len=%d", body.ID, body.Username, body.AuthDate, len(body.Hash))
	if !h.verifyTelegram(body) {
		log.Printf("[Telegram] Signature invalid for id=%s", body.ID)
		http.Error(w, "invalid telegram signature", http.StatusUnauthorized)
		return
	}
	if err := h.checkTelegramAuthDate(body.AuthDate); err != nil {
		log.Printf("[Auth] Telegram auth_date rejected: %v", err)
		http.Error(w, "auth data expired", http.StatusUnauthorized)
		return
	}

	var linkUserID string
	hasSession := false
	if current, err := h.sessions.Extract(r); err == nil {
		linkUserID = current
		hasSession = true
	}

	handle := body.Username
	if handle == "" {
		handle = strings.TrimSpace(body.FirstName + " " + body.LastName)
	}

	profile, err := h.store.UpsertIdentity(linkUserID, ProviderTelegram, body.ID, handle, "https://t.me/"+body.Username, "", "")
	if err != nil {
		log.Printf("[Auth] Telegram upsert failed: %v", err)
		status := http.StatusInternalServerError
		if errors.Is(err, ErrIdentityLinked) {
			status = http.StatusConflict
		}
		http.Error(w, err.Error(), status)
		return
	}

	// Issue session for new users or if identity belonged to a different user
	if !hasSession || (linkUserID != "" && linkUserID != profile.User.ID) {
		if err := h.sessions.Issue(w, profile.User.ID, 0); err != nil {
			log.Printf("[Auth] Failed to issue session: %v", err)
			http.Error(w, "failed to issue session", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, profile)
}

// handleTelegramCallback handles the GET redirect from the Telegram Login Widget.
// The widget redirects to this URL with auth params in the query string.
func (h *Handler) handleTelegramCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.telegram.BotToken == "" {
		http.Error(w, "telegram login disabled", http.StatusServiceUnavailable)
		return
	}
	q := r.URL.Query()
	redirect := sanitizeRedirect(q.Get("redirect"))
	link := q.Get("link") == "1"

	body := telegramVerifyRequest{
		ID:        q.Get("id"),
		FirstName: q.Get("first_name"),
		LastName:  q.Get("last_name"),
		Username:  q.Get("username"),
		PhotoURL:  q.Get("photo_url"),
		AuthDate:  q.Get("auth_date"),
		Hash:      q.Get("hash"),
	}

	if body.ID == "" || body.Hash == "" {
		log.Printf("[Telegram] Callback missing required params")
		http.Redirect(w, r, h.frontendRedirect(redirect, "telegram_error", "telegram"), http.StatusFound)
		return
	}

	log.Printf("[Telegram] Callback: id=%s username=%s auth_date=%s", body.ID, body.Username, body.AuthDate)

	if !h.verifyTelegram(body) {
		log.Printf("[Telegram] Signature invalid for id=%s", body.ID)
		http.Redirect(w, r, h.frontendRedirect(redirect, "telegram_error", "telegram"), http.StatusFound)
		return
	}
	if err := h.checkTelegramAuthDate(body.AuthDate); err != nil {
		log.Printf("[Auth] Telegram auth_date rejected: %v", err)
		http.Redirect(w, r, h.frontendRedirect(redirect, "telegram_error", "telegram"), http.StatusFound)
		return
	}

	var linkUserID string
	if link {
		if current, err := h.sessions.Extract(r); err == nil {
			linkUserID = current
		}
	}

	handle := body.Username
	if handle == "" {
		handle = strings.TrimSpace(body.FirstName + " " + body.LastName)
	}

	profile, err := h.store.UpsertIdentity(linkUserID, ProviderTelegram, body.ID, handle, "https://t.me/"+body.Username, "", "")
	if err != nil {
		log.Printf("[Auth] Telegram upsert failed: %v", err)
		status := "telegram_error"
		if errors.Is(err, ErrIdentityLinked) {
			status = "telegram_conflict"
		}
		http.Redirect(w, r, h.frontendRedirect(redirect, status, "telegram"), http.StatusFound)
		return
	}

	if err := h.sessions.Issue(w, profile.User.ID, 0); err != nil {
		log.Printf("[Auth] Failed to issue session: %v", err)
		http.Redirect(w, r, h.frontendRedirect(redirect, "session_error", "telegram"), http.StatusFound)
		return
	}

	http.Redirect(w, r, h.frontendRedirect(redirect, "success", "telegram"), http.StatusFound)
}

const telegramAuthMaxAge = 86400 // 24 hours in seconds

func (h *Handler) checkTelegramAuthDate(authDateStr string) error {
	ts, err := strconv.ParseInt(authDateStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid auth_date format: %w", err)
	}
	age := time.Now().Unix() - ts
	if age > telegramAuthMaxAge {
		return fmt.Errorf("auth_date too old: %d seconds ago", age)
	}
	if age < -60 {
		return fmt.Errorf("auth_date is in the future: %d seconds", -age)
	}
	return nil
}

func (h *Handler) verifyTelegram(data telegramVerifyRequest) bool {
	hash := data.Hash
	if hash == "" {
		return false
	}
	kv := []string{}
	if data.AuthDate != "" {
		kv = append(kv, "auth_date="+data.AuthDate)
	}
	if data.FirstName != "" {
		kv = append(kv, "first_name="+data.FirstName)
	}
	if data.LastName != "" {
		kv = append(kv, "last_name="+data.LastName)
	}
	if data.ID != "" {
		kv = append(kv, "id="+data.ID)
	}
	if data.PhotoURL != "" {
		kv = append(kv, "photo_url="+data.PhotoURL)
	}
	if data.Username != "" {
		kv = append(kv, "username="+data.Username)
	}
	sort.Strings(kv)
	checkString := strings.Join(kv, "\n")
	secretKey := sha256.Sum256([]byte(h.telegram.BotToken))
	mac := hmac.New(sha256.New, secretKey[:])
	mac.Write([]byte(checkString))
	expected := mac.Sum(nil)
	provided, err := hex.DecodeString(hash)
	if err != nil {
		return false
	}
	return hmac.Equal(expected, provided)
}
