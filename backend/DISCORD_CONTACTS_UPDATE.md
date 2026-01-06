# Обновление Discord контактов в parties.contacts

## Проблема
В таблице `parties.contacts` могут храниться старые данные:
- Discord User ID вместо username
- Global name вместо username

## Решение

### Быстрый способ (рекомендуется)

Используйте оптимизированную SQL миграцию - она обновляет все записи одним запросом:

```bash
psql $DATABASE_URL -f backend/migrations/update_discord_contacts_username_optimized.sql
```

Эта миграция:
- ✅ Обновляет все партии одним запросом (быстро)
- ✅ Использует JSONB функции PostgreSQL (эффективно)
- ✅ Обновляет contacts, где handle отличается от username в auth_identities
- ✅ Работает для всех случаев: user ID, global_name, или другой username

### Альтернативный способ

Если нужна более детальная обработка через Discord API:

```bash
cd backend
DATABASE_URL="..." go run cmd/update_discord_contacts/main.go
```

Этот скрипт:
- Получает username через Discord API (если токены валидны)
- Обновляет contacts в parties
- Более медленный, но может обновить данные через API

## Что обновляется

Миграция обновляет Discord контакты в `parties.contacts`, где:
1. Handle является User ID (17-19 цифр) → заменяется на username из `auth_identities`
2. Handle отличается от username в `auth_identities` → заменяется на правильный username
3. Handle может быть global_name → заменяется на username

## Важно

- Новые партии автоматически используют правильный username (код в `backend/auth/http.go`)
- Старые партии нужно обновить один раз с помощью миграции выше
- После обновления все контакты будут использовать username вместо global_name

