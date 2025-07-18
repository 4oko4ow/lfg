package utils

import (
	"fmt"
	"log"
	"time"
)

func UpdateCreation() {
	url := "https://YOUR_PROJECT.supabase.co"
	key := "YOUR_SERVICE_ROLE_KEY" // нужен сервис-ключ
	client := supabase.CreateClient(url, key)

	// Получаем все объявления
	var parties []map[string]interface{}
	err := client.DB.From("parties").
		Select("*").
		Execute(&parties)
	if err != nil {
		log.Fatalf("Ошибка при получении: %v", err)
	}

	// Обновляем каждое объявление
	for _, party := range parties {
		id := party["id"]
		now := time.Now().UTC().Format(time.RFC3339)

		// Обновляем поле updated_at
		update := map[string]interface{}{
			"updated_at": now,
		}
		err := client.DB.From("parties").
			Eq("id", id).
			Update(update).
			Execute(nil)

		if err != nil {
			log.Printf("Ошибка при обновлении %v: %v", id, err)
		} else {
			fmt.Printf("Обновлено: %v\n", id)
		}
	}
}
