# Database-Backed Session Storage

Сессии теперь хранятся в Supabase вместо stateless cookies. Это решает проблему сброса логина при редеплое бэкенда.

## Установка

1. Выполните SQL миграцию в Supabase для создания таблицы `auth_sessions`:

```sql
-- См. файл migrations/create_sessions_table.sql
```

Или выполните SQL напрямую в Supabase Dashboard:

```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
```

**Примечание:** RLS (Row Level Security) не обязателен, так как service role key обходит RLS. Если нужна дополнительная безопасность, можно включить RLS и добавить политику.

2. Убедитесь, что переменные окружения настроены:
   - `SUPABASE_URL` - URL вашего Supabase проекта
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key для доступа к БД

## Как это работает

- При логине создается запись в таблице `sessions` с уникальным ID
- ID сессии сохраняется в cookie
- При каждом запросе сессия проверяется в БД
- Истекшие сессии автоматически удаляются каждый час
- При логауте сессия удаляется из БД

## Обратная совместимость

Система автоматически переключается на stateless сессии, если подключение к Supabase не удалось. Это позволяет системе работать даже если БД временно недоступна.

## Миграция существующих пользователей

Существующие пользователи со stateless сессиями продолжат работать до истечения их сессий. Новые логины будут использовать БД-хранилище.

