package main

import (
	"lfg/ws"
	"log"
	"net/http"
)

func main() {

	ws.InitDB()
	for _, p := range ws.LoadPartiesFromSupabase() {
		ws.AddParty(p)
	}

	http.HandleFunc("/ws", ws.HandleConnections)

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// 🧹 Включаем автоочистку старых пати
	go ws.StartPartyCleanupLoop()

	log.Println("Server started on :8080")
	http.ListenAndServe(":8080", nil)
}
