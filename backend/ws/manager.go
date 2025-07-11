package ws

import (
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

func AddParty(p *Party) {
	partyLock.Lock()
	defer partyLock.Unlock()
	parties[p.ID] = p
	go SavePartyToSupabase(p)
}

func RemoveParty(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	delete(parties, id)
	go RemovePartyFromSupabase(id)
}

func UpdatePartyJoined(id string) {
	partyLock.Lock()
	defer partyLock.Unlock()
	if p, ok := parties[id]; ok && p.Joined < p.Slots {
		p.Joined++
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
