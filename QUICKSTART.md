# Quick Start Guide

## Prerequisites

1. **Docker and Docker Compose** installed
2. **Traefik network** (if using Traefik reverse proxy)
3. **Environment variables** configured in `.env` file

## Step 1: Create .env File

If you haven't already:

```bash
cp .env.example .env
# Edit .env with your values
```

## Step 2: Create Traefik Network (if using Traefik)

If you're using Traefik as reverse proxy:

```bash
docker network create traefik
```

**Important:** After starting your services, restart Traefik so it discovers them:

```bash
docker restart traefik
# Watch logs to see if services are discovered
docker logs traefik -f
```

If you're NOT using Traefik, you'll need to:
- Remove Traefik labels from `docker-compose.yml`
- Expose ports directly or use a different reverse proxy

## Step 3: Choose Your Setup

### Option A: With Local PostgreSQL (Recommended for first time)

This will start PostgreSQL, run migrations, then start API and frontend:

```bash
docker-compose --profile local-db up -d --build
```

### Option B: With External PostgreSQL

If you have your own PostgreSQL database:

1. Set `DATABASE_URL` in `.env` to point to your database
2. Run migrations manually or skip if already done
3. Start services:

```bash
docker-compose up -d --build
```

## Step 4: Verify Services Are Running

```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f

# Check specific service
docker-compose logs -f api
docker-compose logs -f postgres
```

## Step 5: Configure Vercel (Frontend)

Since the frontend is deployed on Vercel (not Docker), make sure to set this environment variable in Vercel:

```
VITE_BACKEND_URL=https://lfg.findparty.online
```

This tells the frontend where to find the backend API.

## Step 6: Access Your Application

- **Frontend**: Deployed on Vercel at `https://findparty.online`
- **Backend API**: `https://lfg.findparty.online` (or your configured domain)
- **Health Check**: `https://lfg.findparty.online/healthz`

## Common Commands

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes data)
```bash
docker-compose down -v
```

### Rebuild and restart
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
docker-compose logs -f postgres
```

### Restart a specific service
```bash
docker-compose restart api
docker-compose restart frontend
```

## Troubleshooting

### Services won't start

1. **Check .env file exists and has required variables:**
   ```bash
   cat .env | grep -E "DATABASE_URL|AUTH_JWT_SECRET|VITE_BACKEND_URL"
   ```

2. **Check Docker is running:**
   ```bash
   docker ps
   ```

3. **Check for port conflicts:**
   ```bash
   # Check if port 5432 is in use (PostgreSQL)
   lsof -i :5432
   # Check if port 8080 is in use (API)
   lsof -i :8080
   ```

### Database connection errors

- Verify `DATABASE_URL` is correct
- If using local-db profile, wait for PostgreSQL to be healthy
- Check database logs: `docker-compose logs postgres`

### Frontend can't connect to backend

- Frontend is deployed on Vercel, not Docker
- Verify `VITE_BACKEND_URL` environment variable in Vercel is set to `https://lfg.findparty.online`
- Rebuild frontend in Vercel after changing environment variables

### Traefik errors

- Ensure Traefik network exists: `docker network ls | grep traefik`
- Check Traefik logs if available
- Verify domain names in `docker-compose.yml` match your setup

## Next Steps

1. Run migrations (if not using local-db profile):
   ```bash
   docker-compose run migrate
   ```

2. Check health endpoint:
   ```bash
   curl https://lfg.findparty.online/healthz
   ```

3. Monitor logs for any errors:
   ```bash
   docker-compose logs -f
   ```

