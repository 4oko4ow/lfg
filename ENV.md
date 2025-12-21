# Environment Variables Documentation

This document describes all environment variables used by the LFG MVP application.

## Quick Start

1. Copy `.env.example` to `.env`
2. Fill in the required variables (marked with ⚠️)
3. For Docker Compose, place `.env` in the project root

## Variable Categories

- [Database](#database)
- [Frontend](#frontend)
- [Authentication](#authentication)
- [OAuth Providers](#oauth-providers)
- [Server](#server)

---

## Database

### `DATABASE_URL` ⚠️ **Required**

PostgreSQL connection string.

**Format:**
```
postgresql://username:password@host:port/database?sslmode=disable
```

**Examples:**
- Local: `postgresql://postgres:postgres@localhost:5432/lfg_mvp?sslmode=disable`
- Docker: `postgresql://postgres:password@postgres:5432/lfg_mvp?sslmode=disable`
- Remote: `postgresql://user:pass@db.example.com:5432/lfg_mvp?sslmode=require`

**Notes:**
- Used by backend for all database operations
- If not set, the application will fail to start
- For production, use `sslmode=require` or `sslmode=verify-full`

### `POSTGRES_USER` (Optional)

PostgreSQL username. Only needed if using docker-compose with `local-db` profile.

**Default:** `postgres`

### `POSTGRES_PASSWORD` (Optional)

PostgreSQL password. Only needed if using docker-compose with `local-db` profile.

**Default:** `postgres`

### `POSTGRES_DB` (Optional)

PostgreSQL database name. Only needed if using docker-compose with `local-db` profile.

**Default:** `lfg_mvp`

### `POSTGRES_PORT` (Optional)

PostgreSQL port. Only needed if using docker-compose with `local-db` profile.

**Default:** `5432`

---

## Frontend

### `VITE_BACKEND_URL` ⚠️ **Required**

Backend API URL for frontend build. This is **baked into the frontend at build time**, not runtime.

**Examples:**
- Production: `https://findparty.online`
- Local dev: `http://localhost:8080`
- Staging: `https://staging.findparty.online`

**Notes:**
- Must include protocol (`http://` or `https://`)
- No trailing slash
- Used for all API calls from frontend
- If not set, frontend will use relative paths (may cause CORS issues)

---

## Authentication

### `AUTH_JWT_SECRET` ⚠️ **Required**

Secret key for signing session cookies. Must be a long random string.

**Recommended length:** At least 32 characters

**Generate:**
```bash
# Using OpenSSL
openssl rand -hex 32

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Security:**
- Never commit this to version control
- Use different values for development and production
- Keep it secret and secure

### `AUTH_DB_PATH` (Optional)

Path for file-based auth store. Used as fallback if `DATABASE_URL` is not available.

**Default:** `data/auth.json`

**Docker:** `/data/auth.json` (persisted in volume)

**Notes:**
- Only used if database connection fails
- For production, always use database-backed storage

### `AUTH_COOKIE_NAME` (Optional)

Name of the session cookie.

**Default:** `lfg_session`

**Example:** `fp_session`, `lfg_auth`

### `AUTH_COOKIE_DOMAIN` (Optional)

Cookie domain for cross-subdomain support.

**Format:**
- With leading dot: `.findparty.online` (supports `findparty.online` and `www.findparty.online`)
- Without dot: `findparty.online` (only that exact domain)
- Empty: Current domain only (for localhost)

**Examples:**
- Production: `.findparty.online`
- Local: (leave empty)

### `AUTH_COOKIE_SECURE` (Optional)

Enable Secure flag for cookies (HTTPS only).

**Values:**
- `true` - Cookie only sent over HTTPS (production)
- `false` - Cookie sent over HTTP (local development)

**Default:** `false`

**Recommendation:** Always use `true` in production

### `AUTH_SESSION_TTL_DAYS` (Optional)

Session duration in days. How long users stay logged in.

**Default:** `365` (1 year)

**Examples:**
- `30` - 30 days
- `90` - 3 months
- `365` - 1 year

---

## OAuth Providers

### `FRONTEND_URL` ⚠️ **Required**

Frontend URL for OAuth redirects after authentication.

**Examples:**
- Production: `https://findparty.online`
- Local: `http://localhost:5173`

**Notes:**
- Must match the actual frontend URL
- Used in OAuth callback redirects

### `BACKEND_URL` ⚠️ **Required**

Backend URL for OAuth callbacks.

**Examples:**
- Production: `https://findparty.online`
- Local: `http://localhost:8080`

**Notes:**
- Must be publicly accessible for OAuth callbacks
- Used as callback URL in OAuth provider settings

### `DISCORD_CLIENT_ID` ⚠️ **Required** (if using Discord)

Discord OAuth application client ID.

**Get from:** https://discord.com/developers/applications

**Steps:**
1. Create a new application
2. Go to OAuth2 section
3. Copy Client ID
4. Add redirect URI: `{BACKEND_URL}/auth/discord/callback`

### `DISCORD_CLIENT_SECRET` ⚠️ **Required** (if using Discord)

Discord OAuth application client secret.

**Get from:** https://discord.com/developers/applications

**Security:** Keep this secret! Never commit to version control.

### `STEAM_WEB_API_KEY` ⚠️ **Required** (if using Steam)

Steam Web API key for persona lookups.

**Get from:** https://steamcommunity.com/dev/apikey

**Notes:**
- Free to obtain
- Used for Steam profile lookups

### `TELEGRAM_BOT_TOKEN` ⚠️ **Required** (if using Telegram)

Telegram bot token for verifying Telegram login payloads.

**Get from:** @BotFather on Telegram

**Steps:**
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow instructions
4. Copy the token

**Security:** Keep this secret! Never commit to version control.

### `TELEGRAM_BOT_ID` (Optional)

Telegram bot username/ID override.

**Default:** Backend queries `getMe` using the token

**Example:** `findparty_bot`

---

## Server

### `PORT` (Optional)

Server port for the backend API.

**Default:** `8080`

**Examples:**
- `8080` - Default
- `3000` - Alternative
- `80` - HTTP (not recommended, use reverse proxy)

**Notes:**
- In Docker, this is the internal port
- External access is handled by Traefik/reverse proxy

### `ALLOWED_ORIGINS` (Optional)

Comma-separated list of allowed CORS origins.

**Format:** `https://example.com,https://www.example.com`

**Default:** Hardcoded in `main.go`:
- `https://findparty.online`
- `https://www.findparty.online`
- `http://localhost:5173` (dev)
- `http://localhost:3000` (dev)

**Notes:**
- Currently not used (hardcoded in main.go)
- Reserved for future use

### `GIN_MODE` (Optional)

Gin framework mode.

**Values:**
- `debug` - Development mode (verbose logging)
- `release` - Production mode (optimized)

**Default:** `release`

**Recommendation:** Always use `release` in production

---

## Environment-Specific Examples

### Local Development

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lfg_mvp?sslmode=disable
VITE_BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8080
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=
GIN_MODE=debug
```

### Production

```bash
DATABASE_URL=postgresql://user:pass@db.example.com:5432/lfg_mvp?sslmode=require
VITE_BACKEND_URL=https://findparty.online
FRONTEND_URL=https://findparty.online
BACKEND_URL=https://findparty.online
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_DOMAIN=.findparty.online
GIN_MODE=release
```

### Docker Compose

```bash
# Use the .env.example template
# DATABASE_URL will be auto-generated if using local-db profile
DATABASE_URL=postgresql://postgres:password@postgres:5432/lfg_mvp?sslmode=disable
VITE_BACKEND_URL=https://findparty.online
# ... rest of variables
```

---

## Security Checklist

- [ ] `AUTH_JWT_SECRET` is at least 32 characters and randomly generated
- [ ] `AUTH_COOKIE_SECURE=true` in production
- [ ] `DATABASE_URL` uses strong password
- [ ] OAuth secrets are kept secure and not committed
- [ ] `.env` file is in `.gitignore`
- [ ] Production uses `sslmode=require` or `sslmode=verify-full` for database
- [ ] `GIN_MODE=release` in production

---

## Troubleshooting

### Database Connection Issues

**Error:** `DATABASE_URL must be set`

**Solution:** Set `DATABASE_URL` environment variable with valid PostgreSQL connection string.

**Error:** `failed to connect to database`

**Solution:** 
- Check database is running
- Verify connection string format
- Check network connectivity
- Verify credentials

### Frontend API Calls Failing

**Error:** CORS errors or 404s

**Solution:**
- Verify `VITE_BACKEND_URL` matches actual backend URL
- Rebuild frontend after changing `VITE_BACKEND_URL`
- Check backend is running and accessible

### OAuth Not Working

**Error:** Redirect URI mismatch

**Solution:**
- Verify `BACKEND_URL` matches OAuth provider callback URL
- Check OAuth provider settings match exactly
- Ensure `FRONTEND_URL` is correct for redirects

### Session Issues

**Error:** Users logged out after restart

**Solution:**
- Ensure `DATABASE_URL` is set (uses database-backed sessions)
- Check `auth_sessions` table exists (run migrations)
- Verify `AUTH_JWT_SECRET` is consistent across restarts

---

## Additional Resources

- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Steam Web API Documentation](https://steamcommunity.com/dev)
- [Telegram Bot API](https://core.telegram.org/bots/api)

