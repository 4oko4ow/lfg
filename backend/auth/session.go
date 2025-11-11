package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
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
	return &SessionManager{
		secret:       []byte(secret),
		cookieName:   cookieName,
		cookieDomain: cookieDomain,
		secure:       secure,
		ttl:          30 * 24 * time.Hour,
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

	http.SetCookie(w, &http.Cookie{
		Name:     s.cookieName,
		Value:    token,
		Path:     "/",
		Domain:   s.cookieDomain,
		Expires:  expires,
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
	return nil
}

func (s *SessionManager) Clear(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.cookieDomain,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *SessionManager) Extract(r *http.Request) (string, error) {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil {
		return "", err
	}
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
