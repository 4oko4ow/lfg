# Docker Setup for LFG MVP

This project is dockerized for deployment on a VPS with Traefik reverse proxy.

## Prerequisites

- Docker and Docker Compose installed
- Traefik network configured (`traefik` external network)
- Environment variables configured (see `.env.example`)

## Services

### PostgreSQL
- **Container**: `lfg-mvp-db`
- **Port**: 5432 (configurable via `POSTGRES_PORT`)
- **Profile**: `local-db` (only starts with `--profile local-db`)
- **Note**: The app uses direct PostgreSQL connections. You can use the included PostgreSQL service or provide your own via `DATABASE_URL`.

### Migrate
- **Container**: `lfg-mvp-migrate`
- Runs database migrations before the API starts
- Only runs if PostgreSQL service is available

### API
- **Container**: `lfg-mvp-api`
- **Port**: 8080 (internal)
- **Health endpoint**: `/healthz`
- **WebSocket endpoint**: `/ws`
- Exposed via Traefik on `findparty.online`

### Frontend
- **Container**: `lfg-mvp-frontend`
- **Port**: 80 (internal)
- Serves the built React/Vite application
- Exposed via Traefik on `findparty.online` and `www.findparty.online`

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database (required)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=lfg_mvp
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:your_secure_password@postgres:5432/lfg_mvp?sslmode=disable

# Frontend Backend URL (required for build)
VITE_BACKEND_URL=https://findparty.online

# Auth Configuration
AUTH_JWT_SECRET=your_long_random_secret
AUTH_DB_PATH=/data/auth.json
AUTH_COOKIE_NAME=lfg_session
AUTH_COOKIE_DOMAIN=.findparty.online
AUTH_COOKIE_SECURE=true
AUTH_SESSION_TTL_DAYS=365

# OAuth
FRONTEND_URL=https://findparty.online
BACKEND_URL=https://findparty.online
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
STEAM_WEB_API_KEY=your_steam_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_ID=your_telegram_bot_id

# CORS
ALLOWED_ORIGINS=https://findparty.online,https://www.findparty.online

# Server
PORT=8080
GIN_MODE=release
```

## Usage

### Start all services (without local PostgreSQL)
```bash
docker-compose up -d
```

### Start with local PostgreSQL
```bash
docker-compose --profile local-db up -d
```

### Rebuild and start
```bash
docker-compose up -d --build
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
```

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes
```bash
docker-compose down -v
```

## Traefik Configuration

The services are configured to work with Traefik reverse proxy. Make sure:

1. Traefik network exists: `docker network create traefik` (if not exists)
2. Update domain names in `docker-compose.yml` labels if your domain differs from `findparty.online`
3. Traefik should have Let's Encrypt certificate resolver configured (`le`)

## Notes

- The app uses **direct PostgreSQL** connections (no Supabase client)
- You can use the included PostgreSQL service (`--profile local-db`) or provide your own database via `DATABASE_URL`
- Migrations are automatically run when using the `local-db` profile
- Frontend environment variables (`VITE_*`) are baked into the build at build time, not runtime
- Auth data is persisted in a Docker volume (`auth_data`)
- Chat messages are polled every 2 seconds (real-time updates via polling)

