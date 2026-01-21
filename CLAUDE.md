# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LFG MVP is a "Looking For Group" platform for finding gaming parties. Go backend + React/TypeScript frontend with real-time WebSocket updates and OAuth authentication (Discord, Steam, Telegram).

## Development Commands

### Frontend (in `frontend/`)
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 5173)
npm run build        # Production build
npm run lint         # ESLint check
npm run preview      # Preview production build
```

### Backend (in `backend/`)
```bash
go mod download      # Download dependencies
go run main.go       # Start server (port 8080)
```

### Docker Compose (from project root)
```bash
docker-compose --profile local-db up -d --build   # With local PostgreSQL
docker-compose up -d --build                       # Without local PostgreSQL
docker-compose logs -f                             # View logs
docker-compose down -v                             # Stop and remove volumes
```

## Architecture

### Backend Structure (`backend/`)
- **main.go** - Entry point, HTTP server setup, CORS middleware, route registration
- **auth/** - OAuth handlers (Discord, Steam, Telegram), JWT session management, user storage
- **api/** - REST handlers: chat, parties, games, user stats, global stats
- **ws/** - WebSocket server for real-time party updates
- **migrations/** - PostgreSQL schema migrations (run automatically with Docker)

### Frontend Structure (`frontend/src/`)
- **pages/** - Route components (Landing, PartyFeed, Profile, AuthCallback)
- **components/** - Reusable UI (PartyCard, Chat, Header, modals)
- **context/** - React Context (AuthContext, OnlineCountContext)
- **ws/** - WebSocket client for party updates
- **locales/** - i18n translations (EN/RU)
- **types.ts** - TypeScript type definitions for Party, Message, etc.

### Key Patterns
- **Real-time updates**: WebSocket for party state, HTTP polling for chat
- **Authentication**: OAuth 2.0 → JWT session cookie
- **State management**: React Context API (no Redux)
- **Styling**: Tailwind CSS v4

## WebSocket Message Types

Incoming (from server):
- `initial_state` - Full party list on connect
- `new_party` - Party created
- `party_update` - Party modified (joined, etc.)
- `party_remove` - Party deleted
- `online_count` - Active users count

Outgoing (to server):
- `create_party` - Create new party
- `join_party` - Join existing party
- `heartbeat` - Keep connection alive

## API Endpoints

- `GET /api/chat/messages` - Chat history
- `POST /api/chat/messages/create` - Send chat message
- `POST /api/games/suggest` - Suggest a game
- `GET /api/user/stats` - User statistics
- `GET /api/user/parties` - User's parties
- `DELETE /api/parties/delete` - Delete party
- `PUT /api/parties/update` - Update party
- `GET /api/stats` - Global statistics
- `GET /healthz` - Health check
- `WS /ws` - WebSocket connection

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_JWT_SECRET` - Session signing key (min 32 chars)
- `VITE_BACKEND_URL` - Backend URL (baked into frontend at build time)
- `FRONTEND_URL` - For OAuth redirects
- `BACKEND_URL` - For OAuth callbacks
- OAuth credentials: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `STEAM_WEB_API_KEY`, `TELEGRAM_BOT_TOKEN`

See `ENV.md` for complete reference.

## Database

PostgreSQL with direct connections (no ORM). Migrations in `backend/migrations/` run automatically in Docker. Key tables:
- `parties` - Party listings
- `party_members` - Join tracking
- `auth_users` - User accounts
- `sessions` - Active sessions
- `chat_messages` - Chat history
