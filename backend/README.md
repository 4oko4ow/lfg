# Backend Configuration

The Go backend service relies on environment variables for database connection, OAuth credentials, cookie settings, and redirect targets.

## Quick Reference

| Variable                    | Required?                         | Purpose                                                                                                                         | Example                                     |
| --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `DATABASE_URL`              | Yes                               | PostgreSQL connection string for all database operations.                                                                      | `postgresql://user:pass@host:5432/db?sslmode=disable` |
| `AUTH_JWT_SECRET`           | Yes                               | Secret used to sign session cookies. Use a long random string (min 32 chars).                                                  | `p7iS3wX4...`                               |
| `AUTH_DB_PATH`              | No (defaults to `data/auth.json`) | File path for the JSON store (fallback if DATABASE_URL fails). **For Docker, set to `/data/auth.json` to use persistent volume.** | `data/auth.json` or `/data/auth.json` (Docker) |
| `AUTH_COOKIE_NAME`          | No (defaults to `lfg_session`)    | Overrides the session cookie name if you need a custom value.                                                                   | `fp_session`                                |
| `AUTH_COOKIE_DOMAIN`        | No                                | Cookie domain for production deployments. Leave empty for localhost. Set to `.findparty.online` (with leading dot) to support both www and non-www subdomains. | `.findparty.online`                         |
| `AUTH_COOKIE_SECURE`        | No (defaults to `false`)          | Set to `true` to mark the cookie as `Secure` when serving over HTTPS.                                                           | `true`                                      |
| `AUTH_SESSION_TTL_DAYS`     | No (defaults to `365`)            | Session duration in days. Users stay logged in for this duration. Default is 1 year (365 days).                               | `365`                                       |
| `FRONTEND_URL`              | Yes                               | Base URL of the SPA used when redirecting back after OAuth flows.                                                               | `https://findparty.online`                  |
| `BACKEND_URL`               | Yes                               | Public URL of the Go service, used for OAuth callbacks.                                                                         | `https://lfg.findparty.online`             |
| `DISCORD_CLIENT_ID`         | Yes                               | Discord OAuth client ID.                                                                                                        | `123456789012345678`                        |
| `DISCORD_CLIENT_SECRET`     | Yes                               | Discord OAuth client secret.                                                                                                    | `abcdef0123456789abcdef0123456789`          |
| `STEAM_WEB_API_KEY`         | Yes                               | Steam Web API key for persona lookups.                                                                                          | `0123456789ABCDEFFEDCBA9876543210`          |
| `TELEGRAM_BOT_TOKEN`        | Yes (for Telegram login)          | Bot token used to verify Telegram login payloads.                                                                               | `123456789:AAAbbbCCCdddEEEfff`              |
| `TELEGRAM_BOT_ID`           | No                                | Optional override for the Telegram bot username shown in the client. If omitted the backend will query `getMe` using the token. | `findparty_bot`                             |
| `PORT`                      | No (defaults to `8080`)           | Server port for the backend API.                                                                                                | `8080`                                      |
| `GIN_MODE`                  | No (defaults to `release`)        | Gin framework mode: `debug` or `release`.                                                                                      | `release`                                   |

## Database

The backend uses **direct PostgreSQL connections** (no Supabase client). All database operations require a valid `DATABASE_URL`.

**Connection String Format:**
```
postgresql://username:password@host:port/database?sslmode=disable
```

**Examples:**
- Local: `postgresql://postgres:postgres@localhost:5432/lfg_mvp?sslmode=disable`
- Docker: `postgresql://postgres:password@postgres:5432/lfg_mvp?sslmode=disable`
- Production: `postgresql://user:pass@db.example.com:5432/lfg_mvp?sslmode=require`

## Migrations

Database migrations are located in `backend/migrations/`. Run them before starting the server:

1. Using Docker Compose: Migrations run automatically with `--profile local-db`
2. Manually: Use `psql` or your preferred PostgreSQL client

**Migration files:**
- `create_parties_table.sql` - Party listings
- `create_auth_users_table.sql` - User authentication
- `create_sessions_table.sql` - Session storage
- `create_chat_messages_table.sql` - Chat messages
- `add_contacts_column_to_parties.sql` - Party contacts

## API Endpoints

- `GET /api/chat/messages` - Get chat messages
- `POST /api/chat/messages/create` - Create chat message
- `POST /api/games/suggest` - Suggest a game
- `GET /healthz` - Health check
- `WS /ws` - WebSocket for party updates

## OAuth Setup

### Discord
1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to OAuth2 section
4. Add redirect URI: `{BACKEND_URL}/auth/discord/callback`
5. Copy Client ID and Client Secret

### Steam
1. Go to https://steamcommunity.com/dev/apikey
2. Register for a Steam Web API Key
3. Copy the API key

### Telegram
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow instructions to create bot
4. Copy the bot token

## Configuration Files

- Copy `.env.example` to `.env` in project root
- For Docker Compose, place `.env` in project root
- See `ENV.md` for detailed documentation

## Security Notes

- Never commit `.env` files to version control
- Use strong, randomly generated `AUTH_JWT_SECRET` (min 32 chars)
- Set `AUTH_COOKIE_SECURE=true` in production
- Use `sslmode=require` or `sslmode=verify-full` for production database connections
- Keep OAuth secrets secure
