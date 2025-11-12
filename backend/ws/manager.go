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
			if err := SavePartyToSupabase(p); err != nil {
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
	
	// Объединяем: берем из БД, но сохраняем недавно созданные из памяти
	// которые могут еще не успеть сохраниться в БД
	now := time.Now()
	for id, memParty := range parties {
		age := now.Sub(memParty.CreatedAt)
		// Если объявление в памяти новее 5 минут, сохраняем его (возможно еще не сохранено в БД)
		// Увеличили время с 1 минуты до 5 минут, чтобы дать больше времени на сохранение
		if age < 5*time.Minute {
			if dbParty, exists := dbParties[id]; exists {
				// Если есть в БД, используем данные из БД (более актуальные)
				parties[id] = dbParty
			} else {
				// Если нет в БД, оставляем из памяти и пытаемся сохранить синхронно
				// Используем синхронное сохранение, чтобы убедиться, что оно выполнилось
				if err := SavePartyToSupabase(memParty); err != nil {
					log.Printf("⚠️  Failed to save party %s during sync: %v", id, err)
					// Не удаляем из памяти, если сохранение не удалось - попробуем в следующий раз
				}
			}
		} else {
			// Старые объявления берем из БД
			if dbParty, exists := dbParties[id]; exists {
				parties[id] = dbParty
			} else {
				// Если нет в БД и не новое - удаляем из памяти
				// Только если объявление старше 5 минут и его нет в БД
				delete(parties, id)
				log.Printf("🗑️  Removed party %s from memory (not found in DB, age: %v)", id, age)
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
