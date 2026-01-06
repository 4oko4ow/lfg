# Update Discord Contacts Script

Этот скрипт обновляет Discord контакты в таблице `parties.contacts`, заменяя Discord User ID на username.

## Что делает скрипт

1. Находит все партии с Discord контактами, где `handle` является User ID (17-19 цифр)
2. Пытается найти username в таблице `auth_identities`
3. Если username не найден в БД, пытается получить его через Discord API используя `access_token`
4. Обновляет `handle` в `parties.contacts` на username
5. Также обновляет `username` в `auth_identities`, если он был получен через API

## Запуск

```bash
cd backend
DATABASE_URL="postgresql://user:pass@host:5432/db" go run cmd/update_discord_contacts/main.go
```

Или скомпилировать и запустить:

```bash
cd backend
go build -o update_discord_contacts cmd/update_discord_contacts/main.go
DATABASE_URL="postgresql://user:pass@host:5432/db" ./update_discord_contacts
```

## Требования

- Переменная окружения `DATABASE_URL` должна быть установлена
- Доступ к базе данных PostgreSQL
- Для получения username через API нужны валидные `access_token` в таблице `auth_identities`

## Примечания

- Скрипт безопасен для повторного запуска - он обновляет только те контакты, где `handle` является User ID
- Если username не найден ни в БД, ни через API, контакт пропускается
- Скрипт логирует все действия для отладки

