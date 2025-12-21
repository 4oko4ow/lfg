# Local Development Setup Guide

This guide will help you run the LFG MVP platform locally on your machine.

## Option 1: Docker Compose (Recommended - Easiest)

### Prerequisites
- Docker and Docker Compose installed
- Ports 5432 (PostgreSQL) and 8080 (Backend) available

### Steps

1. **Create `.env` file** (if it doesn't exist):
   ```bash
   cp .env.local.example .env
   ```

2. **Generate AUTH_JWT_SECRET**:
   ```bash
   # Generate a random secret
   openssl rand -hex 32
   # Copy the output and paste it as AUTH_JWT_SECRET in .env
   ```

3. **Start services with local PostgreSQL**:
   ```bash
   docker-compose --profile local-db up -d --build
   ```

   This will:
   - Start PostgreSQL database
   - Run database migrations automatically
   - Start the backend API

4. **Check services are running**:
   ```bash
   docker-compose ps
   ```

5. **View logs**:
   ```bash
   # All services
   docker-compose logs -f
   
   # Just backend
   docker-compose logs -f api
   ```

6. **Access the backend**:
   - API: http://localhost:8080
   - Health check: http://localhost:8080/healthz

7. **Start frontend separately** (see Frontend section below)

### Stop services
```bash
docker-compose down
```

---

## Option 2: Manual Setup (For Development)

### Prerequisites
- Go 1.24+ installed
- Node.js 18+ and npm installed
- PostgreSQL installed and running locally

### Backend Setup

1. **Install PostgreSQL** (if not installed):
   ```bash
   # macOS
   brew install postgresql@16
   brew services start postgresql@16
   
   # Linux (Ubuntu/Debian)
   sudo apt-get install postgresql-16
   sudo systemctl start postgresql
   
   # Or use Docker just for DB:
   docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
   ```

2. **Create database**:
   ```bash
   createdb lfg_mvp
   # Or using psql:
   psql -U postgres -c "CREATE DATABASE lfg_mvp;"
   ```

3. **Run migrations**:
   ```bash
   cd backend
   # Install migrate tool or use Docker:
   docker run -v $(pwd)/migrations:/migrations --network host migrate/migrate \
     -path /migrations -database "postgresql://postgres:postgres@localhost:5432/lfg_mvp?sslmode=disable" up
   ```

4. **Set environment variables**:
   ```bash
   export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lfg_mvp?sslmode=disable"
   export AUTH_JWT_SECRET="$(openssl rand -hex 32)"
   export FRONTEND_URL="http://localhost:5173"
   export BACKEND_URL="http://localhost:8080"
   export AUTH_COOKIE_SECURE="false"
   export AUTH_COOKIE_DOMAIN=""
   ```

5. **Install dependencies and run**:
   ```bash
   cd backend
   go mod download
   go run main.go
   ```

   Backend should start on http://localhost:8080

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Create `.env.local` file** (for Vite):
   ```bash
   echo "VITE_BACKEND_URL=http://localhost:8080" > .env.local
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   Frontend should start on http://localhost:5173

---

## Quick Start Script

For the fastest setup, use this script:

```bash
#!/bin/bash
# quick-start.sh

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lfg_mvp?sslmode=disable
AUTH_JWT_SECRET=$JWT_SECRET
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8080
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_DOMAIN=
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8080
EOF

# Start Docker services
docker-compose --profile local-db up -d --build

echo "✅ Backend starting on http://localhost:8080"
echo "📝 Now start frontend: cd frontend && npm install && npm run dev"
```

---

## Verify Everything Works

1. **Check backend health**:
   ```bash
   curl http://localhost:8080/healthz
   # Should return: ok
   ```

2. **Check database connection**:
   ```bash
   docker-compose logs api | grep "Initial sync done"
   # Or check manually:
   psql -U postgres -d lfg_mvp -c "SELECT COUNT(*) FROM parties;"
   ```

3. **Open frontend**:
   - Navigate to http://localhost:5173
   - You should see the landing page

---

## Troubleshooting

### Port already in use
```bash
# Check what's using port 8080
lsof -i :8080
# Kill the process or change PORT in .env
```

### Database connection errors
- Make sure PostgreSQL is running
- Check DATABASE_URL is correct
- Verify database exists: `psql -U postgres -l | grep lfg_mvp`

### Frontend can't connect to backend
- Verify backend is running: `curl http://localhost:8080/healthz`
- Check VITE_BACKEND_URL in frontend/.env.local
- Check CORS settings in backend (ALLOWED_ORIGINS)

### Migrations not running
```bash
# Run migrations manually
docker-compose run migrate
```

### OAuth not working locally
- OAuth requires public URLs for callbacks
- For local dev, you can skip OAuth and test other features
- Or use ngrok/tunneling service to expose localhost

---

## Next Steps

1. **Run the new migration** (for gamification features):
   ```bash
   # If using Docker, migrations run automatically
   # If manual, run:
   psql -U postgres -d lfg_mvp -f backend/migrations/add_user_stats_and_gamification.sql
   ```

2. **Test the features**:
   - Landing page at root URL
   - Create a party (requires auth)
   - Check profile page for stats
   - View achievements

3. **Development workflow**:
   - Backend: Make changes, restart with `go run main.go`
   - Frontend: Changes hot-reload automatically
   - Database: Changes persist in Docker volume

---

## Environment Variables Reference

See [ENV.md](./ENV.md) for complete documentation of all environment variables.

**Minimum required for local dev:**
- `DATABASE_URL` - PostgreSQL connection
- `AUTH_JWT_SECRET` - Random 32+ character string
- `FRONTEND_URL` - http://localhost:5173
- `BACKEND_URL` - http://localhost:8080

