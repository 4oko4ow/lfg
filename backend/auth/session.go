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
	return &SessionManager{
		secret:       []byte(secret),
		cookieName:   cookieName,
		cookieDomain: cookieDomain,
		secure:       secure,
		ttl:          ttl,
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
	if len(s.secret) == 0 {
		return errors.New("session secret not configured")
	}
	if ttl <= 0 {
		ttl = s.ttl
	}
	expires := time.Now().Add(ttl)
	nonce := fmt.Sprintf("%08x", rand.Uint32())
	payload := s.tokenPayload(userID, expires, nonce)
	signature := s.sign(payload)
	token := base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + signature))

	// For cross-origin requests (frontend and backend on different domains),
	// we need SameSite=None with Secure=true
	sameSite := http.SameSiteLaxMode
	if s.secure {
		// Only use SameSite=None if Secure is true (required by browsers)
		sameSite = http.SameSiteNoneMode
	}
	
	// For cross-domain cookies, don't set Domain if it's empty or if it would restrict the cookie
	// Empty domain means the cookie is set for the exact domain that set it
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
	// Only set Domain if it's explicitly provided and not empty
	// This allows the cookie to work for cross-domain scenarios
	if s.cookieDomain != "" {
		cookie.Domain = s.cookieDomain
	}
	http.SetCookie(w, cookie)
	log.Printf("[Session] Issued session cookie for user %s (Domain: %q, Secure: %v, SameSite: %v)", userID, s.cookieDomain, s.secure, sameSite)
	return nil
}

func (s *SessionManager) Clear(w http.ResponseWriter) {
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
