# Chat security, WS chat, public profiles, changelog implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix chat auth security hole, move chat to WebSocket, add public profile pages with links in chat, add changelog page.

**Architecture:** Backend gets a WS chat message type piped through the existing gorilla/websocket hub. Frontend Chat.tsx drops HTTP polling and subscribes via the shared WS connection. Public profile page reads from the already-existing `/api/users/{id}/profile` endpoint. Changelog is a static React page.

**Tech Stack:** Go 1.24, gorilla/websocket, React 19 + TypeScript + Vite, Tailwind CSS v4, React Router v7, i18next.

**No tests in this project** - TypeScript strict mode and ESLint are the quality gates.

---

## Batch A - independent tasks, run in parallel

---

### Task 1: Fix chat auth security (backend)

**Files:**
- Modify: `backend/api/chat.go`
- Modify: `backend/main.go` (pass sessionManager to ChatHandler)

The `CreateMessage` handler currently accepts `user_id` and `user_display_name` from the request body - anyone can impersonate anyone. Fix: extract identity from the JWT cookie using `sessionManager.Extract(r)`, ignore body fields for identity.

**Step 1: Update ChatHandler to hold sessionManager**

In `backend/api/chat.go`, change the struct and constructor:

```go
type ChatHandler struct {
	db             *sql.DB
	sessionManager *auth.SessionManager
}

func NewChatHandler(db *sql.DB, sessionManager *auth.SessionManager) *ChatHandler {
	return &ChatHandler{db: db, sessionManager: sessionManager}
}
```

Add import at top: `"lfg/auth"`

**Step 2: Rewrite CreateMessage to ignore body identity**

Replace the body parsing section in `CreateMessage`:

```go
func (h *ChatHandler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	// Auth check
	userID, err := h.sessionManager.Extract(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Fetch display name from auth_users
	var displayName string
	row := h.db.QueryRow(`SELECT COALESCE(display_name, '') FROM auth_users WHERE id = $1`, userID)
	row.Scan(&displayName)

	// Only read message text from body
	var req struct {
		Message     string `json:"message"`
		ClientMsgID string `json:"client_msg_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	// rest of insert stays the same, use userID and displayName vars
```

**Step 3: Update main.go to pass sessionManager to NewChatHandler**

In `backend/main.go`, change:
```go
chatHandler := api.NewChatHandler(db)
```
to:
```go
chatHandler := api.NewChatHandler(db, sessionManager)
```

**Step 4: Build and verify**

```bash
cd backend && go build ./...
```
Expected: no errors.

**Step 5: Commit**

```bash
git add backend/api/chat.go backend/main.go
git commit -m "fix: require auth session to send chat messages"
```

---

### Task 2: Changelog page (frontend)

**Files:**
- Create: `frontend/src/pages/ChangelogPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Header.tsx`

**Step 1: Create ChangelogPage**

```tsx
// frontend/src/pages/ChangelogPage.tsx
import { useTranslation } from "react-i18next";

type Entry = {
  date: string;
  items: string[];
};

const ENTRIES: Entry[] = [
  {
    date: "2026-03-27",
    items: [
      "Chat messages now require authentication",
      "Chat moved to WebSocket for instant delivery",
      "Public profile pages at /profile/:userId",
      "Profile links in chat nicknames",
      "This changelog page",
    ],
  },
];

export default function ChangelogPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-20 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8 text-white">
          {t("changelog.title", "What's new")}
        </h1>
        <div className="space-y-10">
          {ENTRIES.map((entry) => (
            <div key={entry.date}>
              <p className="text-xs font-mono text-zinc-500 mb-3 uppercase tracking-widest">
                {entry.date}
              </p>
              <ul className="space-y-2">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Add route in App.tsx**

```tsx
import ChangelogPage from "./pages/ChangelogPage";
// inside <Routes>:
<Route path="/changelog" element={<ChangelogPage />} />
```

**Step 3: Add link in Header.tsx**

Read Header.tsx first. Find the nav links section and add:
```tsx
<Link to="/changelog" className="text-sm text-zinc-400 hover:text-white transition-colors">
  {t("nav.changelog", "Changelog")}
</Link>
```

**Step 4: Build check**

```bash
cd frontend && npm run build
```
Expected: no TS errors.

**Step 5: Commit**

```bash
git add frontend/src/pages/ChangelogPage.tsx frontend/src/App.tsx frontend/src/components/Header.tsx
git commit -m "feat: add changelog page at /changelog"
```

---

## Batch B - run after Batch A completes

---

### Task 3: Chat via WebSocket (backend)

**Files:**
- Modify: `backend/ws/types.go`
- Modify: `backend/ws/server.go`

Add a `send_chat` inbound WS message type that saves to DB and broadcasts a `chat_message` outbound type to all clients.

**Step 1: Add types in ws/types.go**

```go
type SendChatPayload struct {
	Message     string `json:"message"`
	ClientMsgID string `json:"client_msg_id"`
}

type ChatMessagePayload struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	UserDisplayName string    `json:"user_display_name"`
	Message         string    `json:"message"`
	ClientMsgID     string    `json:"client_msg_id,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
```

**Step 2: Handle send_chat in ws/server.go**

In the `switch message.Type` block, add a new case. This needs the DB (already accessible via `GetDB()`) and session manager (already set via `SetSessionManager`).

Find where the switch ends and add before the closing brace:

```go
case "send_chat":
    var payload SendChatPayload
    if err := parsePayload(message.Payload, &payload); err != nil {
        log.Println("invalid send_chat payload:", err)
        continue
    }
    if payload.Message == "" {
        continue
    }
    // Auth check
    var userID string
    if sessionManager != nil {
        if uid, err := sessionManager.Extract(r); err == nil {
            userID = uid
        }
    }
    if userID == "" {
        log.Println("send_chat: unauthenticated")
        continue
    }

    db := GetDB()
    if db == nil {
        continue
    }

    // Fetch display name
    var displayName string
    db.QueryRow(`SELECT COALESCE(display_name, '') FROM auth_users WHERE id = $1`, userID).Scan(&displayName)

    // Save to DB
    var msgID string
    var createdAt time.Time
    err := db.QueryRow(`
        INSERT INTO chat_messages (user_id, user_display_name, message, client_msg_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, created_at
    `, userID, displayName, payload.Message, payload.ClientMsgID).Scan(&msgID, &createdAt)
    if err != nil {
        log.Printf("send_chat DB error: %v", err)
        continue
    }

    // Broadcast to all clients
    chatMsg := Message{
        Type: "chat_message",
        Payload: ChatMessagePayload{
            ID:              msgID,
            UserID:          userID,
            UserDisplayName: displayName,
            Message:         payload.Message,
            ClientMsgID:     payload.ClientMsgID,
            CreatedAt:       createdAt,
        },
    }
    broadcastMessage(chatMsg)
```

**Step 3: Verify broadcastMessage function exists**

Check `ws/manager.go` or `ws/parties.go` - there should be a `broadcastMessage(msg Message)` helper. If it's named differently (e.g. `broadcast`), use the right name. The function iterates `clients` map and sends JSON.

```bash
grep -n "func broadcast" backend/ws/*.go
```

**Step 4: Build and verify**

```bash
cd backend && go build ./...
```

**Step 5: Commit**

```bash
git add backend/ws/types.go backend/ws/server.go
git commit -m "feat: handle send_chat via WebSocket, broadcast chat_message"
```

---

### Task 4: Chat via WebSocket (frontend)

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/ws/client.ts`
- Modify: `frontend/src/components/Chat.tsx`

**Step 1: Add types in types.ts**

In the `Message` union type, add:
```ts
| { type: "chat_message"; payload: ChatMessage }
```

Add new type:
```ts
export type ChatMessage = {
  id: string;
  user_id: string;
  user_display_name: string;
  message: string;
  client_msg_id?: string;
  created_at: string;
};
```

In `OutgoingMessage` union, add:
```ts
| {
    type: "send_chat";
    payload: {
      message: string;
      client_msg_id: string;
    };
  }
```

**Step 2: Add sendChatMessage helper in ws/client.ts**

```ts
export function sendChatMessage(payload: { message: string; client_msg_id: string }) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("WebSocket not open, cannot send chat message");
    return false;
  }
  socket.send(JSON.stringify({ type: "send_chat", payload }));
  return true;
}
```

**Step 3: Rewrite Chat.tsx to use WebSocket**

The component needs to:
1. Load initial messages via HTTP fetch (keep existing `fetchMessages` - this loads history on mount)
2. Subscribe to `chat_message` WS events via `onMessage`
3. Send via `sendChatMessage` instead of HTTP POST
4. Remove the 10-second polling interval

Key changes in `Chat.tsx`:

Remove the `setInterval` polling block entirely.

Add WS subscription in `useEffect`:
```ts
useEffect(() => {
  fetchMessages(); // load history once on mount
  analytics.chatOpened();

  // Subscribe to real-time chat messages
  const unsubscribe = onMessage((msg) => {
    if (msg.type === "chat_message") {
      setMessages((prev) => {
        // Deduplicate: replace optimistic with confirmed
        const withoutOptimistic = prev.filter(
          (m) => m.client_msg_id !== msg.payload.client_msg_id
        );
        // Avoid duplicates from initial load
        if (withoutOptimistic.some((m) => m.id === msg.payload.id)) {
          return prev;
        }
        return [...withoutOptimistic, msg.payload];
      });
    }
  });

  return unsubscribe;
}, []);
```

Note: `onMessage` currently doesn't return an unsubscribe function. Update `ws/client.ts` to support it:
```ts
export function onMessage(cb: (msg: Message) => void): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}
```

Update `sendMessage` in Chat.tsx to use WS:
```ts
const sendMessage = async () => {
  if (!profile) return;
  const trimmed = input.trim();
  if (!trimmed) return;

  const client_msg_id = `msg-${Date.now()}-${Math.random()}`;

  // Optimistic message
  setMessages((prev) => [
    ...prev,
    {
      id: client_msg_id,
      client_msg_id,
      user_id: profile.id,
      user_display_name: profile.displayName,
      message: trimmed,
      created_at: new Date().toISOString(),
      optimistic: true,
    } as any,
  ]);
  setInput("");

  const sent = sendChatMessage({ message: trimmed, client_msg_id });
  if (sent) {
    analytics.chatMessageSent();
  }
};
```

**Step 4: Build check**

```bash
cd frontend && npm run build
```

**Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/ws/client.ts frontend/src/components/Chat.tsx
git commit -m "feat: move chat to WebSocket, remove HTTP polling"
```

---

## Batch C - run after Batch B completes

---

### Task 5: Public profile page (frontend)

Backend already has `/api/users/{id}/profile` returning `PublicProfile`. Just need the frontend page.

**Files:**
- Create: `frontend/src/pages/PublicProfilePage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Check what PublicProfile returns**

The backend `getPublicProfile` returns:
```go
type PublicProfile struct {
    UserID         string   `json:"user_id"`
    DisplayName    string   `json:"display_name"`
    AvatarURL      string   `json:"avatar_url"`
    Level          int      `json:"level"`
    TotalXP        int      `json:"total_xp"`
    PartiesCreated int      `json:"parties_created"`
    PartiesJoined  int      `json:"parties_joined"`
    CurrentStreak  int      `json:"current_streak"`
    Achievements   []string `json:"achievements"`
}
```

Read `user_stats.go` around line 252-300 to confirm exact fields before coding.

**Step 2: Add type to types.ts**

```ts
export type PublicProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  level: number;
  total_xp: number;
  parties_created: number;
  parties_joined: number;
  current_streak: number;
  achievements: string[];
};
```

**Step 3: Create PublicProfilePage.tsx**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, Users, Flame, Zap } from "lucide-react";
import type { PublicProfile } from "../types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${BACKEND_URL}/api/users/${userId}/profile`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setProfile(data); })
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="animate-pulse text-zinc-500">{t("ui.loading", "Loading...")}</div>
    </main>
  );

  if (notFound || !profile) return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
      <p className="text-zinc-400">{t("profile.not_found", "Player not found")}</p>
      <Link to="/feed" className="text-blue-400 hover:underline text-sm">{t("nav.feed", "Back to feed")}</Link>
    </main>
  );

  const displayName = profile.display_name || t("profile.anonymous", "Player");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pt-20 pb-16">
      <div className="max-w-lg mx-auto px-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-8">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-400">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <p className="text-sm text-zinc-500">Level {profile.level} · {profile.total_xp} XP</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            { icon: <Trophy className="w-4 h-4" />, label: t("stats.parties_created", "Parties created"), value: profile.parties_created },
            { icon: <Users className="w-4 h-4" />, label: t("stats.parties_joined", "Parties joined"), value: profile.parties_joined },
            { icon: <Flame className="w-4 h-4" />, label: t("stats.streak", "Current streak"), value: profile.current_streak },
            { icon: <Zap className="w-4 h-4" />, label: t("stats.xp", "Total XP"), value: profile.total_xp },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="text-zinc-500 flex items-center gap-1.5">{s.icon}<span className="text-xs">{s.label}</span></div>
              <span className="text-2xl font-bold text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
```

**Step 4: Add route in App.tsx**

```tsx
import PublicProfilePage from "./pages/PublicProfilePage";
// inside <Routes>:
<Route path="/profile/:userId" element={<PublicProfilePage />} />
```

Note: keep the existing `/profile` route (no param) for the own-profile page. Order matters - put `/profile/:userId` before `/profile` or use exact matching (React Router v7 uses exact by default for static routes, but `/profile` and `/profile/:userId` won't conflict).

**Step 5: Build check**

```bash
cd frontend && npm run build
```

**Step 6: Commit**

```bash
git add frontend/src/pages/PublicProfilePage.tsx frontend/src/App.tsx frontend/src/types.ts
git commit -m "feat: add public profile page at /profile/:userId"
```

---

### Task 6: Profile links in chat

**Files:**
- Modify: `frontend/src/components/Chat.tsx`

**Step 1: Make display name a link**

In `Chat.tsx`, find the message rendering where `displayName(msg)` is shown:

```tsx
<span className="text-blue-400 font-semibold text-[10px] sm:text-xs bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent truncate">
  {displayName(msg)}
</span>
```

Replace with:
```tsx
import { Link } from "react-router-dom";

// inside the message map:
{msg.user_id ? (
  <Link
    to={`/profile/${msg.user_id}`}
    className="text-blue-400 font-semibold text-[10px] sm:text-xs hover:text-blue-300 transition-colors truncate"
    onClick={(e) => e.stopPropagation()}
  >
    {displayName(msg)}
  </Link>
) : (
  <span className="text-blue-400 font-semibold text-[10px] sm:text-xs truncate">
    {displayName(msg)}
  </span>
)}
```

Note: remove `bg-gradient-to-r bg-clip-text text-transparent` from the link since those don't work well on interactive elements.

**Step 2: Build check**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/components/Chat.tsx
git commit -m "feat: link chat nicknames to public profile pages"
```

---

## Execution order for parallel agents

```
Batch A (parallel):  Task 1 + Task 2
         ↓
Batch B (parallel):  Task 3 + Task 4
         ↓
Batch C (parallel):  Task 5 + Task 6
```

Task 1 and 2 are fully independent.
Task 3 (backend WS) and Task 4 (frontend WS) modify different files and can run in parallel.
Task 5 (public profile page) and Task 6 (profile links) - Task 6 modifies Chat.tsx to add Link, Task 5 creates the page. They can run in parallel but Task 6 is trivial.

Final integration test:
1. `cd backend && go build ./...` - must pass
2. `cd frontend && npm run build` - must pass
3. Manually test: send chat message, click nickname, see profile page
