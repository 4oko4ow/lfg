package ws

import (
	"log"
	"sync"
	"time"
)

var (
	lastSyncTime time.Time
	syncLock     sync.Mutex
)

// ThrottledSync не позволяет синхронизацию чаще, чем раз в минуту
func ThrottledSync() {
	syncLock.Lock()
	defer syncLock.Unlock()

	if time.Since(lastSyncTime) < time.Minute {
		return // 🔒 слишком рано, выходим
	}

	lastSyncTime = time.Now()

	go func() {
		log.Println("[sync] Synchronizing memory with Supabase...")
		SynchronizeMemoryWithSupabase()
	}()
}
