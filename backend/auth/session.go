package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type SessionManager struct {
	secret       []byte
	cookieName   string
	cookieDomain string
	secure       bool
	ttl          time.Duration
	sessionStore *SessionStore // Optional: if set, use DB storage
}

func NewSessionManager(secret, cookieName, cookieDomain string, secure bool) *SessionManager {
	if cookieName == "" {
		cookieName = "lfg_session"
	}
	// Default to 1 year (365 days) for long-lived sessions
	// Users can stay logged in for a very long time
	defaultTTL := 365 * 24 * time.Hour
	return &SessionManager{
		secret:       []byte(secret),
		cookieName:   cookieName,
		cookieDomain: cookieDomain,
		secure:       secure,
		ttl:          defaultTTL,
	}
}

// NewSessionManagerWithTTL creates a session manager with a custom TTL
func NewSessionManagerWithTTL(secret, cookieName, cookieDomain string, secure bool, ttl time.Duration) *SessionManager {
	if cookieName == "" {
		cookieName = "lfg_session"
	}
	if ttl <= 0 {
		// Default to 1 year if invalid TTL provided
		ttl = 365 * 24 * time.Hour
	}

	// Try to initialize DB session store (optional, falls back to stateless if fails)
	sessionStore, err := NewSessionStore()
	if err != nil {
		log.Printf("[Session] ⚠️  WARNING: Failed to initialize DB session store, using stateless sessions: %v", err)
		log.Printf("[Session] ⚠️  Sessions will NOT persist across server restarts!")
		log.Printf("[Session] ⚠️  To enable persistent sessions, ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set")
		sessionStore = nil
	} else {
		log.Println("[Session] ✅ Using database-backed session storage (sessions will persist across restarts)")
	}

	return &SessionManager{
		secret:       []byte(secret),
		cookieName:   cookieName,
		cookieDomain: cookieDomain,
		secure:       secure,
		ttl:          ttl,
		sessionStore: sessionStore,
	}
}

func (s *SessionManager) tokenPayload(userID string, expires time.Time, nonce string) string {
	return strings.Join([]string{userID, strconv.FormatInt(expires.Unix(), 10), nonce}, "|")
}

func (s *SessionManager) sign(payload string) string {
	mac := hmac.New(sha256.New, s.secret)
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *SessionManager) Issue(w http.ResponseWriter, userID string, ttl time.Duration) error {
	if ttl <= 0 {
		ttl = s.ttl
	}

	var sessionID string
	var err error

	// Use DB storage if available
	if s.sessionStore != nil {
		sessionID, err = s.sessionStore.CreateSession(userID, ttl)
		if err != nil {
			log.Printf("[Session] Failed to create DB session, falling back to stateless: %v", err)
			// Fall through to stateless mode
		} else {
			// Use session ID as token
			token := sessionID
			expires := time.Now().Add(ttl)

			sameSite := http.SameSiteLaxMode
			if s.secure {
				sameSite = http.SameSiteNoneMode
			}

			cookie := &http.Cookie{
				Name:     s.cookieName,
				Value:    token,
				Path:     "/",
				Expires:  expires,
				MaxAge:   int(ttl.Seconds()),
				HttpOnly: true,
				Secure:   s.secure,
				SameSite: sameSite,
			}
			// For cross-domain cookies, don't set Domain if it's empty
			// Setting Domain to empty allows the cookie to be set for the current domain
			// and will be sent with requests to that domain from other origins
			if s.cookieDomain != "" {
				cookie.Domain = s.cookieDomain
			}
			http.SetCookie(w, cookie)
			log.Printf("[Session] Issued DB-backed session cookie for user %s (Domain: %q, Secure: %v, SameSite: %v, CookieString: %s)", userID, s.cookieDomain, s.secure, sameSite, cookie.String())
			return nil
		}
	}

	// Fallback to stateless sessions
	if len(s.secret) == 0 {
		return errors.New("session secret not configured")
	}
	expires := time.Now().Add(ttl)
	nonce := fmt.Sprintf("%08x", rand.Uint32())
	payload := s.tokenPayload(userID, expires, nonce)
	signature := s.sign(payload)
	token := base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + signature))

	sameSite := http.SameSiteLaxMode
	if s.secure {
		sameSite = http.SameSiteNoneMode
	}

	cookie := &http.Cookie{
		Name:     s.cookieName,
		Value:    token,
		Path:     "/",
		Expires:  expires,
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: sameSite,
	}
	// For cross-domain cookies, don't set Domain if it's empty
	// Setting Domain to empty allows the cookie to be set for the current domain
	// and will be sent with requests to that domain from other origins
	if s.cookieDomain != "" {
		cookie.Domain = s.cookieDomain
	}
	http.SetCookie(w, cookie)
	log.Printf("[Session] Issued stateless session cookie for user %s (Domain: %q, Secure: %v, SameSite: %v, CookieString: %s)", userID, s.cookieDomain, s.secure, sameSite, cookie.String())
	return nil
}

func (s *SessionManager) Clear(w http.ResponseWriter, r *http.Request) {
	// Try to get session ID from cookie to delete from DB
	if cookie, err := r.Cookie(s.cookieName); err == nil && s.sessionStore != nil {
		s.sessionStore.DeleteSession(cookie.Value)
	}

	sameSite := http.SameSiteLaxMode
	if s.secure {
		sameSite = http.SameSiteNoneMode
	}
	cookie := &http.Cookie{
		Name:     s.cookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: sameSite,
	}
	// Only set Domain if it's explicitly provided
	if s.cookieDomain != "" {
		cookie.Domain = s.cookieDomain
	}
	http.SetCookie(w, cookie)
}

func (s *SessionManager) Extract(r *http.Request) (string, error) {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil {
		log.Printf("[Session] Cookie %s not found in request: %v", s.cookieName, err)
		return "", err
	}
	log.Printf("[Session] Found cookie %s, attempting to extract session", s.cookieName)

	// Try DB storage first if available
	if s.sessionStore != nil {
		session, err := s.sessionStore.GetSession(cookie.Value)
		if err == nil {
			log.Printf("[Session] Validated DB session for user %s", session.UserID)
			return session.UserID, nil
		}
		// If DB lookup fails, try stateless as fallback (for migration period)
		log.Printf("[Session] DB session lookup failed, trying stateless: %v", err)
	}

	// Fallback to stateless session validation
	decoded, err := base64.RawURLEncoding.DecodeString(cookie.Value)
	if err != nil {
		return "", err
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 4 {
		return "", errors.New("invalid token")
	}
	payload := strings.Join(parts[:3], "|")
	if s.sign(payload) != parts[3] {
		return "", errors.New("signature mismatch")
	}
	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return "", err
	}
	if time.Now().After(time.Unix(expiry, 0)) {
		return "", errors.New("session expired")
	}
	return parts[0], nil
}
