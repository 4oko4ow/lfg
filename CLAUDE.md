# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

LFG (FindParty) is a platform for finding gaming teammates. Users create or join parties, chat in real-time, and authenticate via Discord, Steam, or Telegram.

- **Frontend:** Next.js (App Router) + TypeScript, deployed on Vercel from `nextjs/`
- **Backend:** Go 1.24, Dockerized with Traefik reverse proxy
- **Database:** PostgreSQL (no ORM, raw SQL with `database/sql`)
- **Real-time:** Gorilla WebSocket
- **Styling:** Tailwind CSS v4

Live: https://findparty.online | API: https://lfg.findparty.online

Vercel project name: `lfg` (deploy from `nextjs/` directory with `cd nextjs && vercel --prod`)

## Commands

### Frontend (`cd nextjs`)

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:3000
npm run build        # next build
npm run lint         # eslint
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

Frontend env var: `NEXT_PUBLIC_BACKEND_URL` (used in Next.js).

## Architecture

### Request flow

```
Browser → Next.js (dev) / Vercel (prod)
        → Next.js App Router
        → Go backend (HTTP REST + WebSocket)
        → PostgreSQL
```

Auth uses JWT-signed HTTP-only cookies. Frontend always passes `credentials: "include"` on fetch calls. OAuth providers: Discord OAuth2, Steam OpenID, Telegram Login Widget.

### Real-time (WebSocket)

The backend keeps an in-memory party cache synchronized with the database. All connected clients receive broadcasts for party create/update/delete, online count changes, and chat messages. The frontend (`/nextjs/hooks/`) maintains the WebSocket connection.

WebSocket message types:
- Inbound: `initial_state`, `new_party`, `party_update`, `party_remove`, `online_count`, `join_party`, `chat_message`
- Outbound: `create_party`, `join_party`, `heartbeat`, `send_chat`

### Frontend structure (`nextjs/`)

- `app/` - Next.js App Router pages (one directory per route)
- `components/` - Reusable UI components
- `components/providers/AuthProvider.tsx` - Global auth state via `useAuth()` hook
- `components/providers/OnlineCountProvider.tsx` - Real-time user count
- `hooks/` - Custom React hooks
- `lib/` - Utilities, analytics, constants
- `locales/` - i18next translation files (multi-language)

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

## Changelog

The changelog page (`/changelog`) is a static Next.js page at `nextjs/app/changelog/page.tsx`. To add a new entry, prepend an object to the `ENTRIES` array:

```ts
{
  date: "YYYY-MM-DD",
  items: [
    "Описание изменения",
  ],
},
```

No database or CMS involved - it's plain static HTML rendered at build time.

### When to update the changelog

**Before every push**, check if any committed changes are significant enough to mention. Update the changelog if the changes include:

- New features visible to users (new UI elements, new pages, new flows)
- Meaningful UX improvements (behaviour changes, interaction changes, performance wins)
- Bug fixes that users would notice

**Skip the changelog for:**

- Refactors with no visible effect
- Code style or linting fixes
- Internal tooling or config changes
- Backend-only changes with no user-facing impact

**Rules for writing entries:**

- Write in Russian, from the user's perspective ("Чат: кнопка отправки — больше не нужно жать Enter")
- One entry per deploy date — group all changes from that date into a single `ENTRIES` item
- Keep items short (one sentence), explain the benefit not the implementation
- Never mention technical details (file names, function names, DB columns)

## No tests

There are no test files or test configuration in this project. TypeScript strict mode and ESLint serve as the primary code quality tools.
