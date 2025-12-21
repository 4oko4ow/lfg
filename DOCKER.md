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
- Exposed via Traefik on `lfg.findparty.online`

### Frontend
- **Container**: `lfg-mvp-frontend`
- **Port**: 80 (internal)
- Serves the built React/Vite application
- Exposed via Traefik on `findparty.online` and `www.findparty.online`

## Environment Variables

1. Copy `.env.example` to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```

2. Fill in all required variables (marked with ⚠️ in `.env.example`)

3. For detailed documentation, see:
   - **[ENV.md](./ENV.md)** - Complete environment variable reference
   - **[backend/README.md](./backend/README.md)** - Backend-specific configuration

**Quick Start - Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_BACKEND_URL` - Backend URL for frontend build
- `AUTH_JWT_SECRET` - Secret key for sessions (generate with `openssl rand -hex 32`)
- `FRONTEND_URL` - Frontend URL for OAuth redirects
- `BACKEND_URL` - Backend URL for OAuth callbacks
- OAuth credentials (Discord, Steam, Telegram)

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
2. Update domain names in `docker-compose.yml` labels:
   - Frontend: `findparty.online`
   - Backend: `lfg.findparty.online`
3. Traefik should have Let's Encrypt certificate resolver configured (`le`)

## Notes

- The app uses **direct PostgreSQL** connections (no Supabase client)
- You can use the included PostgreSQL service (`--profile local-db`) or provide your own database via `DATABASE_URL`
- Migrations are automatically run when using the `local-db` profile
- Frontend environment variables (`VITE_*`) are baked into the build at build time, not runtime
- Auth data is persisted in a Docker volume (`auth_data`)
- Chat messages are polled every 2 seconds (real-time updates via polling)

