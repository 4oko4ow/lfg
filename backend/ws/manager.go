package ws

import (
	"log"
	"math/rand"
	"sync"
	"time"
)

var (
	parties   = make(map[string]*Party)
	partyLock sync.Mutex
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func generateID() string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
	b := make([]rune, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func GetParties() []*Party {
	partyLock.Lock()
	defer partyLock.Unlock()
	list := make([]*Party, 0, len(parties))
	for _, p := range parties {
		list = append(list, p)
	}
	return list
}

func AddParty(p *Party, save bool) {
	partyLock.Lock()
	parties[p.ID] = p
	partyLock.Unlock()

	if save {
		// Сохраняем синхронно для новых объявлений, чтобы гарантировать сохранение
		// перед возможной синхронизацией
		maxRetries := 3
		retryDelay := 100 * time.Millisecond
		var lastErr error
		for i := 0; i < maxRetries; i++ {
			if err := SavePartyToDatabase(p); err != nil {
				lastErr = err
				if i < maxRetries-1 {
					time.Sleep(retryDelay)
					retryDelay *= 2 // exponential backoff
					continue
				}
			} else {
				return // успешно сохранено
			}
		}
		// Если все попытки не удались, логируем ошибку
		if lastErr != nil {
			log.Printf("❌ Failed to save party %s after %d retries: %v", p.ID, maxRetries, lastErr)
		}
	}
}

func RemoveParty(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	delete(parties, id)
	go RemovePartyFromDatabase(id)
}

func UpdatePartyJoined(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	if p, ok := parties[id]; ok && p.Joined < p.Slots {
		p.Joined++
		go UpdatePartyInDatabase(p)
		Broadcast(Message{Type: "party_update", Payload: p})
	}
}

func StartPartyCleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		now := time.Now()
		partyLock.Lock()
		for id, p := range parties {
			if now.Sub(p.CreatedAt) > 5*time.Hour {
				delete(parties, id)
				Broadcast(Message{Type: "party_remove", Payload: map[string]string{"id": id}})
			}
		}
		partyLock.Unlock()
	}
}
