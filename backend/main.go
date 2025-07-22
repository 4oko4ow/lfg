package main

import (
	"lfg/ws"
	"log"
	"math/rand"
	"net/http"
	"time"
)

func main() {

	rand.Seed(time.Now().UnixNano())

	ws.InitDB()

	http.HandleFunc("/ws", ws.HandleConnections)

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// 🧹 Включаем автоочистку старых пати
	//go ws.StartPartyCleanupLoop()

	log.Println("Server started on :8080")
	http.ListenAndServe(":8080", nil)
}
