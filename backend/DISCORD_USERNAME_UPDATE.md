# Обновление Discord контактов на username

## Проблема
В базе данных могут быть старые записи, где Discord контакты используют `global_name` или `user_id` вместо `username`.

## Решение

### 1. Обновить Discord identities в auth_identities

Запустите скрипт для обновления всех Discord identities через Discord API:

```bash
cd backend
DATABASE_URL="your_database_url" go run cmd/update_discord_identities/main.go
```

Этот скрипт:
- Найдет все Discord identities
- Получит username через Discord API используя access_token
- Обновит username в `auth_identities`
- Обновит handle в `auth_contacts`

### 2. Обновить контакты в parties.contacts

Запустите SQL миграцию:

```bash
psql $DATABASE_URL -f backend/migrations/update_discord_contacts_username.sql
```

Или запустите Go скрипт для обновления через API (если нужно):

```bash
cd backend
DATABASE_URL="your_database_url" go run cmd/update_discord_contacts/main.go
```

### 3. Проверить логи

После запуска скриптов проверьте логи бэкенда. При следующем логине пользователя через Discord вы должны увидеть:

```
[Auth] Discord handle: username#1234 (username: username, global_name: Global Name)
```

Если видите предупреждение о том, что используется user ID вместо username, значит access_token истек и нужно обновить его.

## Важно

- Новые логины автоматически используют `username` (код в `backend/auth/http.go` строка 468)
- Старые записи нужно обновить вручную с помощью скриптов выше
- Если `access_token` истек, скрипт не сможет обновить username через API - нужно будет дождаться следующего логина пользователя

