# LFG MVP

Looking For Group (LFG) MVP - A platform for finding gaming parties.

## Features

- 🎮 Game party listings
- 💬 Real-time chat
- 🔐 OAuth authentication (Discord, Steam, Telegram)
- 🌐 Multi-language support (EN/RU)
- 📱 Responsive design
- 🐳 Dockerized for easy deployment

## Tech Stack

- **Backend:** Go (Golang)
- **Frontend:** React + TypeScript + Vite
- **Database:** PostgreSQL
- **WebSocket:** Gorilla WebSocket
- **Reverse Proxy:** Traefik (for production)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- PostgreSQL (or use included service)
- OAuth credentials (Discord, Steam, Telegram)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lfg-mvp
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start services**
   ```bash
   # With local PostgreSQL
   docker-compose --profile local-db up -d --build
   
   # Or without local PostgreSQL (provide DATABASE_URL)
   docker-compose up -d --build
   ```

4. **Access the application**
   - Frontend: `http://localhost` (or your configured domain)
   - Backend API: `http://localhost:8080`
   - Health check: `http://localhost:8080/healthz`

## Documentation

- **[ENV.md](./ENV.md)** - Complete environment variables documentation
- **[DOCKER.md](./DOCKER.md)** - Docker setup and deployment guide
- **[backend/README.md](./backend/README.md)** - Backend configuration
- **[frontend/README.md](./frontend/README.md)** - Frontend setup

## Development

### Backend

```bash
cd backend
go mod download
go run main.go
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

See **[ENV.md](./ENV.md)** for complete documentation.

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_BACKEND_URL` - Backend URL for frontend
- `AUTH_JWT_SECRET` - Session secret (generate with `openssl rand -hex 32`)
- `FRONTEND_URL` - Frontend URL
- `BACKEND_URL` - Backend URL
- OAuth credentials (Discord, Steam, Telegram)

## Project Structure

```
lfg-mvp/
├── backend/           # Go backend
│   ├── auth/         # Authentication
│   ├── ws/           # WebSocket handlers
│   ├── api/          # REST API endpoints
│   └── migrations/   # Database migrations
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── context/
│   └── public/
├── docker-compose.yml # Docker Compose configuration
├── .env.example       # Environment variables template
└── ENV.md            # Environment variables documentation
```

## API Endpoints

- `GET /api/chat/messages` - Get chat messages
- `POST /api/chat/messages/create` - Create chat message
- `POST /api/games/suggest` - Suggest a game
- `GET /healthz` - Health check
- `WS /ws` - WebSocket for party updates

## License

[Your License Here]

