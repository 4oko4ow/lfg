# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LFG (FindParty) is a platform for finding gaming teammates. Users create or join parties, chat in real-time, and authenticate via Discord, Steam, or Telegram.

- **Frontend:** React 19 + TypeScript + Vite, deployed on Vercel
- **Backend:** Go 1.24, Dockerized with Traefik reverse proxy
- **Database:** PostgreSQL (no ORM, raw SQL with `database/sql`)
- **Real-time:** Gorilla WebSocket
- **Styling:** Tailwind CSS v4

Live: https://findparty.online | API: https://lfg.findparty.online

Vercel project name: `lfg` (deploy from `nextjs/` directory with `cd nextjs && vercel --prod`)

## Commands

### Frontend (`cd frontend`)

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:5173
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run preview      # preview production build
```

### Backend (`cd backend`)

```bash
go mod download      # install deps
go run main.go       # start server at http://localhost:8080
```

### Docker (from repo root)

```bash
# With local PostgreSQL
docker-compose --profile local-db up -d --build

# With external database (set DATABASE_URL in .env)
docker-compose up -d --build
```

### Environment setup

```bash
cp .env.example .env   # then fill in required values
```

Required vars: `DATABASE_URL`, `AUTH_JWT_SECRET`, `FRONTEND_URL`, `BACKEND_URL`, `DISCORD_CLIENT_ID/SECRET`, `STEAM_WEB_API_KEY`, `TELEGRAM_BOT_TOKEN/ID`.

Frontend env var: `VITE_BACKEND_URL` (baked into Vite build).

## Architecture

### Request flow

```
Browser → Vite (dev) / Vercel (prod)
        → React SPA (React Router v7)
        → Go backend (HTTP REST + WebSocket)
        → PostgreSQL
```

Auth uses JWT-signed HTTP-only cookies. Frontend always passes `credentials: "include"` on fetch calls. OAuth providers: Discord OAuth2, Steam OpenID, Telegram Login Widget.

### Real-time (WebSocket)

The backend keeps an in-memory party cache synchronized with the database. All connected clients receive broadcasts for party create/update/delete and online count changes. The frontend (`/frontend/src/ws/`) maintains the WebSocket connection and dispatches messages to `PartyFeedPage`.

WebSocket message types are defined in `/frontend/src/types.ts`:
- Inbound: `initial_state`, `new_party`, `party_update`, `party_remove`, `online_count`, `join_party`
- Outbound: `create_party`, `join_party`, `heartbeat`

### Frontend structure

- `src/pages/` - Route-level components (one per route)
- `src/components/` - Reusable UI components
- `src/context/AuthContext.tsx` - Global auth state via `useAuth()` hook
- `src/context/OnlineCountContext.tsx` - Real-time user count
- `src/locales/` - i18next translation files (multi-language)
- `src/utils/analytics.ts` - Event tracking

### Backend structure

- `backend/auth/` - JWT session manager, OAuth handlers, cookie management
- `backend/api/` - REST API route handlers
- `backend/ws/` - WebSocket hub, client handling, broadcast logic
- `backend/migrations/` - Plain SQL migration files (applied in order, no migration tool)
- `backend/main.go` - Server entry point: CORS, route registration, startup sync

### Database notes

- Raw SQL, no ORM
- Prepared statements are **disabled** for Supabase Transaction mode pooler compatibility
- Connection pooling configured for PgBouncer (`prefer_simple_protocol`)
- Key tables: `parties`, `auth_users`, `sessions`, `chat_messages`, `party_members`

## No tests

There are no test files or test configuration in this project. TypeScript strict mode and ESLint serve as the primary code quality tools.
