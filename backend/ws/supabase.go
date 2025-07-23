package ws

import (
	"encoding/json"
	"github.com/supabase-community/supabase-go"
	"log"
	"math/rand"
	"time"
)

var supabaseClient *supabase.Client

func InitDB() {
	url := "https://wvwoqhzkggzelffqpxii.supabase.co"
	key := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2d29xaHprZ2d6ZWxmZnFweGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMjk3MDIsImV4cCI6MjA2NzgwNTcwMn0.JPaQczjXAJ60wr_lmtVSuBGfb7Oig8lYeCIo07WLidg"

	client, err := supabase.NewClient(url, key, nil)
	if err != nil {
		log.Fatalf("failed to connect to Supabase: %v", err)
	}
	supabaseClient = client

	//go RandomizePartyTimestamps()
	SynchronizeMemoryWithSupabase()
}

func SavePartyToSupabase(p *Party) {
	_, _, err := supabaseClient.
		From("parties").
		Insert(p, false, "", "representation", "").
		Execute()
	if err != nil {
		log.Println("Error saving party to Supabase:", err)
	}
}

func LoadPartiesFromSupabase() []*Party {
	var parties []*Party
	data, _, err := supabaseClient.
		From("parties").
		Select("*", "", false).
		Execute()
	if err != nil {
		log.Println("Error loading parties from Supabase:", err)
		return nil
	}

	// Unmarshal manually into []*Party
	if err := json.Unmarshal(data, &parties); err != nil {
		log.Println("Error unmarshalling Supabase response:", err)
		return nil
	}
	return parties
}

func RemovePartyFromSupabase(id string) {
	_, _, err := supabaseClient.
		From("parties").
		Delete("id", "eq."+id).
		Execute()
	if err != nil {
		log.Println("Error deleting party from Supabase:", err)
	}
}

func RandomizePartyTimestamps() {
	var parties []*Party
	data, _, err := supabaseClient.
		From("parties").
		Select("*", "", false).
		Execute()
	if err != nil {
		log.Println("Error loading parties for timestamp randomization:", err)
		return
	}

	if err := json.Unmarshal(data, &parties); err != nil {
		log.Println("Error unmarshalling parties:", err)
		return
	}

	for _, p := range parties {
		randomOffset := time.Duration(rand.Intn(115)+5) * time.Minute // от 5 до 120 минут назад
		randomTime := time.Now().Add(-randomOffset).UTC().Format(time.RFC3339)

		update := map[string]interface{}{
			"created_at": randomTime,
		}

		_, _, err := supabaseClient.
			From("parties").
			Update(update, "", "").
			Eq("id", p.ID).
			Execute()

		if err != nil {
			log.Printf("Error updating party %s: %v\n", p.ID, err)
		} else {
			log.Printf("Updated party %s with time %s\n", p.ID, randomTime)
		}
	}
}

func UpdatePartyInSupabase(p *Party) {
	update := map[string]interface{}{
		"joined": p.Joined,
	}

	_, _, err := supabaseClient.
		From("parties").
		Update(update, "", "").
		Eq("id", p.ID).
		Execute()

	if err != nil {
		log.Println("Error updating party in Supabase:", err)
	}
}
