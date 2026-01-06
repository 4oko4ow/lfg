# Update Discord Identities Script

Этот скрипт обновляет Discord identities в таблице `auth_identities`, заменяя старые значения (user ID или global_name) на username.

## Что делает скрипт

1. Находит все Discord identities в таблице `auth_identities`
2. Пропускает те, у которых уже есть валидный username (не user ID)
3. Для остальных пытается получить username через Discord API используя `access_token`
4. Обновляет `username` в `auth_identities`
5. Также обновляет `handle` в `auth_contacts` для соответствующих пользователей

## Запуск

```bash
cd backend
DATABASE_URL="postgresql://user:pass@host:5432/db" go run cmd/update_discord_identities/main.go
```

Или скомпилировать и запустить:

```bash
cd backend
go build -o update_discord_identities cmd/update_discord_identities/main.go
DATABASE_URL="postgresql://user:pass@host:5432/db" ./update_discord_identities
```

## Требования

- Переменная окружения `DATABASE_URL` должна быть установлена
- Доступ к базе данных PostgreSQL
- Для обновления через API: валидные `access_token` или `refresh_token` в таблице `auth_identities`
- Для обновления через refresh: переменные окружения `DISCORD_CLIENT_ID` и `DISCORD_CLIENT_SECRET`

## Примечания

- Скрипт безопасен для повторного запуска
- Если `access_token` истек (401 ошибка), скрипт попытается обновить его через `refresh_token`
- Если обновление токена не удалось, скрипт попытается использовать username из `auth_contacts`
- Скрипт логирует все действия для отладки
- Если ни API, ни `auth_contacts` не доступны, identity будет пропущена

