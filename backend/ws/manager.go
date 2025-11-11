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

func AddParty(p *Party, save bool) {
	partyLock.Lock()
	defer partyLock.Unlock()
	parties[p.ID] = p
	if save {
		// Сохраняем синхронно для новых объявлений, чтобы гарантировать сохранение
		// перед возможной синхронизацией
		SavePartyToSupabase(p)
	}
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
		go UpdatePartyInSupabase(p)
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

func SynchronizeMemoryWithSupabase() {
	partiesFromDB := LoadPartiesFromSupabase()
	partyLock.Lock()
	defer partyLock.Unlock()
	
	// Создаем map из БД для быстрого поиска
	dbParties := make(map[string]*Party)
	for _, p := range partiesFromDB {
		dbParties[p.ID] = p
	}
	
	// Объединяем: берем из БД, но сохраняем недавно созданные из памяти (младше 1 минуты)
	// которые могут еще не успеть сохраниться в БД
	now := time.Now()
	for id, memParty := range parties {
		age := now.Sub(memParty.CreatedAt)
		// Если объявление в памяти новее 1 минуты, сохраняем его (возможно еще не сохранено в БД)
		if age < 1*time.Minute {
			if dbParty, exists := dbParties[id]; exists {
				// Если есть в БД, используем данные из БД (более актуальные)
				parties[id] = dbParty
			} else {
				// Если нет в БД, оставляем из памяти и пытаемся сохранить
				go SavePartyToSupabase(memParty)
			}
		} else {
			// Старые объявления берем из БД
			if dbParty, exists := dbParties[id]; exists {
				parties[id] = dbParty
			} else {
				// Если нет в БД и не новое - удаляем из памяти
				delete(parties, id)
			}
		}
	}
	
	// Добавляем объявления из БД, которых нет в памяти
	for id, dbParty := range dbParties {
		if _, exists := parties[id]; !exists {
			parties[id] = dbParty
		}
	}
}
