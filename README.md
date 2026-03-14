# LFG - FindParty

Platform for finding gaming teammates. Create or join parties, chat in real-time, authenticate via Discord, Steam, or Telegram.

**Live:** [findparty.online](https://findparty.online)

## Tech Stack

- **Backend:** Go - Dockerized, Traefik reverse proxy
- **Frontend:** React + TypeScript + Vite - deployed on Vercel
- **Database:** PostgreSQL
- **Real-time:** Gorilla WebSocket
- **Auth:** Discord OAuth, Steam OpenID, Telegram Login

## Quick Start

1. **Clone**
   ```bash
   git clone https://github.com/4oko4ow/lfg.git
   cd lfg
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Fill in required values (see .env.example for reference)
   ```

3. **Start services**
   ```bash
   # With local PostgreSQL
   docker-compose --profile local-db up -d --build

   # With external database (set DATABASE_URL in .env)
   docker-compose up -d --build
   ```

4. **Access**
   - Frontend: http://localhost:5173 (or https://findparty.online)
   - API: http://localhost:8080
   - Health: http://localhost:8080/healthz

## Development

**Backend**
```bash
cd backend
go mod download
go run main.go
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_JWT_SECRET` - Session secret (`openssl rand -hex 32`)
- `FRONTEND_URL` - Frontend URL
- `BACKEND_URL` - Backend URL
- OAuth credentials (Discord, Steam, Telegram)

See `.env.example` for the full list.

## Project Structure

```
lfg/
├── backend/           # Go backend
│   ├── auth/         # Authentication (JWT, OAuth)
│   ├── ws/           # WebSocket handlers
│   ├── api/          # REST API endpoints
│   └── migrations/   # Database migrations
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── context/
│   └── public/
└── docker-compose.yml
```

## API Endpoints

- `GET /api/chat/messages` - Get chat messages
- `POST /api/chat/messages/create` - Create chat message
- `POST /api/games/suggest` - Suggest a game
- `GET /healthz` - Health check
- `WS /ws` - WebSocket for real-time party updates

## License

MIT
