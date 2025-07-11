package ws

import (
	"encoding/json"
	"github.com/supabase-community/supabase-go"
	"log"
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
