# Scheduled parties implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `scheduled_at` field to parties so users can schedule sessions in advance, keeping the feed populated even during off-peak hours.

**Architecture:** New `scheduled_at TIMESTAMPTZ NULL` column flows from DB → Go WS types → WebSocket handler → frontend types → CreatePartyForm selector → PartyCard badge + feed sort. Backend and frontend tasks are independent and can run in parallel.

**Tech stack:** Go 1.24 (no ORM, raw SQL), Next.js App Router, TypeScript, Tailwind CSS v4, WebSocket (Gorilla), i18next

---

## Task 1 (Backend): Add scheduled_at to DB + Go types + queries

**Files:**
- Create: `backend/migrations/add_scheduled_at.sql`
- Modify: `backend/ws/types.go`
- Modify: `backend/ws/database.go`
- Modify: `backend/ws/server.go`
- Modify: `backend/api/parties.go`

### Step 1: Write migration

Create `backend/migrations/add_scheduled_at.sql`:

```sql
ALTER TABLE parties ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;
```

Apply it to the running database (or it will be applied on next deploy).

### Step 2: Update ws/types.go

Add `ScheduledAt *time.Time` to both `Party` and `CreatePartyPayload`:

```go
type Party struct {
	ID          string          `json:"id"`
	Game        string          `json:"game"`
	Goal        string          `json:"goal"`
	Slots       int             `json:"slots"`
	Joined      int             `json:"joined"`
	CreatedAt   time.Time       `json:"created_at"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	ScheduledAt *time.Time      `json:"scheduled_at,omitempty"`
	Contacts    []ContactMethod `json:"contacts,omitempty"`
	Pinned      bool            `json:"pinned"`
	UserID      string          `json:"user_id,omitempty"`
}

type CreatePartyPayload struct {
	Game        string          `json:"game"`
	Goal        string          `json:"goal"`
	Slots       int             `json:"slots"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	ScheduledAt *time.Time      `json:"scheduled_at,omitempty"`
	Contacts    []ContactMethod `json:"contacts,omitempty"`
}
```

### Step 3: Update ws/server.go — pass ScheduledAt when creating party

In `HandleConnections`, in the `create_party` case, add `ScheduledAt: payload.ScheduledAt` to the party construction:

```go
p := &Party{
    ID:          generateID(),
    Game:        payload.Game,
    Goal:        payload.Goal,
    Slots:       payload.Slots,
    Joined:      1,
    CreatedAt:   time.Now(),
    ExpiresAt:   payload.ExpiresAt,
    ScheduledAt: payload.ScheduledAt,
    Contacts:    payload.Contacts,
    UserID:      userID,
}
```

### Step 4: Update ws/database.go — SavePartyToDatabase

Change the INSERT/UPDATE query to include `scheduled_at`. Current query uses columns:
`id, game, goal, slots, joined, created_at, expires_at, contacts, pinned, user_id` (10 cols, $1–$10).

New query:
```go
query := `
    INSERT INTO parties (id, game, goal, slots, joined, created_at, expires_at, scheduled_at, contacts, pinned, user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
        game = EXCLUDED.game,
        goal = EXCLUDED.goal,
        slots = EXCLUDED.slots,
        joined = EXCLUDED.joined,
        created_at = EXCLUDED.created_at,
        expires_at = EXCLUDED.expires_at,
        scheduled_at = EXCLUDED.scheduled_at,
        contacts = EXCLUDED.contacts,
        pinned = EXCLUDED.pinned,
        user_id = EXCLUDED.user_id
`

_, err = db.Exec(query,
    p.ID,
    p.Game,
    p.Goal,
    p.Slots,
    p.Joined,
    p.CreatedAt,
    p.ExpiresAt,
    p.ScheduledAt,
    string(contactsJSON),
    p.Pinned,
    p.UserID,
)
```

### Step 5: Update ws/database.go — LoadPartiesFromDatabase

Change SELECT query and scan to include `scheduled_at`:

```go
query := `SELECT id, game, goal, slots, joined, created_at, expires_at, scheduled_at, contacts, pinned, user_id FROM parties ORDER BY created_at DESC`
```

Add scan variable and assignment (after `var expiresAt sql.NullTime`):
```go
var scheduledAt sql.NullTime
```

In `rows.Scan(...)` add `&scheduledAt` after `&expiresAt`.

After the `expiresAt` handling block, add:
```go
if scheduledAt.Valid {
    p.ScheduledAt = &scheduledAt.Time
}
```

### Step 6: Update backend/api/parties.go — PartyResponse + queries

Add `ScheduledAt` to `PartyResponse`:
```go
type PartyResponse struct {
    ID          string          `json:"id"`
    Game        string          `json:"game"`
    Goal        string          `json:"goal"`
    Slots       int             `json:"slots"`
    Joined      int             `json:"joined"`
    CreatedAt   time.Time       `json:"created_at"`
    ScheduledAt *time.Time      `json:"scheduled_at,omitempty"`
    Contacts    json.RawMessage `json:"contacts,omitempty"`
    Pinned      bool            `json:"pinned"`
}
```

In `GetUserParties`, update SELECT to include `scheduled_at` and scan it:
```go
rows, err := h.db.Query(`
    SELECT id, game, goal, slots, joined, created_at, scheduled_at, contacts, pinned
    FROM parties
    WHERE user_id = $1
    ORDER BY created_at DESC
`, userID)
```

Add `var scheduledAt sql.NullTime` and scan it. After scan:
```go
if scheduledAt.Valid {
    p.ScheduledAt = &scheduledAt.Time
}
```

### Step 7: Commit

```bash
git add backend/migrations/add_scheduled_at.sql backend/ws/types.go backend/ws/database.go backend/ws/server.go backend/api/parties.go
git commit -m "feat: add scheduled_at to parties (backend)"
```

---

## Task 2 (Frontend): Form selector + PartyCard badge + feed sort

**Files:**
- Modify: `nextjs/lib/types.ts`
- Modify: `nextjs/lib/ws/client.ts`
- Modify: `nextjs/components/CreatePartyForm.tsx`
- Modify: `nextjs/components/PartyCard.tsx`
- Modify: `nextjs/app/feed/PageContent.tsx`
- Modify: `nextjs/locales/ru.json`
- Modify: `nextjs/locales/en.json`

### Step 1: Update lib/types.ts

Add `scheduled_at` to Party type and OutgoingMessage:

```ts
export type Party = {
  id: string;
  game: string;
  goal: string;
  slots: number;
  joined: number;
  created_at: string;
  expires_at?: string;
  scheduled_at?: string;   // <-- add this
  contacts?: ContactMethod[];
  pinned?: boolean;
  user_id?: string;
};
```

In `OutgoingMessage`, in the `create_party` payload:
```ts
payload: {
  game: string;
  goal: string;
  slots: number;
  expires_at?: string;
  scheduled_at?: string;   // <-- add this
  contacts?: ContactMethod[];
};
```

### Step 2: Update lib/ws/client.ts — sendCreateParty

Add `scheduled_at?: string` to the payload parameter type:

```ts
export function sendCreateParty(payload: {
  game: string;
  goal: string;
  slots: number;
  expires_at?: string;
  scheduled_at?: string;
  contacts?: ContactMethod[];
})
```

No other changes needed - payload is forwarded as-is.

### Step 3: Add i18n keys

In `nextjs/locales/ru.json`, inside the `"form"` object, add after the `"expiration"` block:
```json
"schedule": {
  "label": "Когда",
  "now": "Сейчас",
  "in_2h": "Через 2 часа",
  "tonight": "Сегодня вечером",
  "tomorrow": "Завтра"
}
```

In `nextjs/locales/en.json`, add the same block:
```json
"schedule": {
  "label": "When",
  "now": "Now",
  "in_2h": "In 2 hours",
  "tonight": "Tonight",
  "tomorrow": "Tomorrow"
}
```

Also add to both locale files, inside the `"party"` object:
```json
"scheduled_at": "начало в {{time}}",
"scheduled_today": "сегодня в {{time}}",
"scheduled_tomorrow": "завтра в {{time}}"
```

English versions:
```json
"scheduled_at": "starts at {{time}}",
"scheduled_today": "today at {{time}}",
"scheduled_tomorrow": "tomorrow at {{time}}"
```

### Step 4: Add "когда" selector to CreatePartyForm.tsx

Add state at the top of the component (after `const [slots, setSlots] = useState(5)`):
```ts
const [scheduleOption, setScheduleOption] = useState<'now' | 'in_2h' | 'tonight' | 'tomorrow'>('now');
```

Add a helper to compute `scheduled_at` from the option:
```ts
function getScheduledAt(option: string): string | undefined {
    if (option === 'now') return undefined;
    const now = new Date();
    if (option === 'in_2h') {
        return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
    }
    if (option === 'tonight') {
        const t = new Date(now);
        t.setHours(20, 0, 0, 0);
        if (t <= now) t.setDate(t.getDate() + 1); // if past 20:00, push to tomorrow
        return t.toISOString();
    }
    if (option === 'tomorrow') {
        const t = new Date(now);
        t.setDate(t.getDate() + 1);
        t.setHours(20, 0, 0, 0);
        return t.toISOString();
    }
    return undefined;
}
```

In `handleSubmit`, pass `scheduled_at` to `sendCreateParty`:
```ts
sendCreateParty({ game, goal, slots, contacts, scheduled_at: getScheduledAt(scheduleOption) });
```

Add the selector UI after the slots stepper block (before contact info block):
```tsx
{/* Schedule selector */}
<div className="space-y-2">
    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {t("form.schedule.label")}
    </p>
    <div className="flex gap-1.5 flex-wrap">
        {(['now', 'in_2h', 'tonight', 'tomorrow'] as const).map((opt) => (
            <button
                key={opt}
                type="button"
                onClick={() => setScheduleOption(opt)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition-all ${
                    scheduleOption === opt
                        ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
            >
                {t(`form.schedule.${opt}`)}
            </button>
        ))}
    </div>
</div>
```

### Step 5: Add scheduled badge to PartyCard.tsx

Add a helper function after the existing `getTimeUntilExpiration` function:

```ts
const getScheduledLabel = () => {
    if (!party.scheduled_at) return null;
    const scheduledDate = new Date(party.scheduled_at);
    const now = new Date();
    const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isToday = scheduledDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();

    if (isToday) return t("party.scheduled_today", { time: timeStr });
    if (isTomorrow) return t("party.scheduled_tomorrow", { time: timeStr });
    return t("party.scheduled_at", { time: timeStr });
};

const scheduledLabel = getScheduledLabel();
```

Add the badge in the badges block (after the `isNewlyCreated` badge, before `isAlmostFull`):
```tsx
{scheduledLabel && (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-md shadow-emerald-500/10 backdrop-blur-sm">
        <ClockIcon className="w-4 h-4" />
        {scheduledLabel}
    </span>
)}
```

### Step 6: Feed sort — scheduled parties after active

In `nextjs/app/feed/PageContent.tsx`, find where parties are rendered (filtered list). Add sort logic. Look for `filteredParties` or equivalent array used to render `<PartyCard>` components. Add before render:

```ts
const sortedParties = useMemo(() => {
    const now = new Date();
    const active = filteredParties.filter(p => !p.scheduled_at || new Date(p.scheduled_at) <= now);
    const scheduled = filteredParties.filter(p => p.scheduled_at && new Date(p.scheduled_at) > now);
    scheduled.sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
    return [...active, ...scheduled];
}, [filteredParties]);
```

Replace `filteredParties` with `sortedParties` in the JSX map.

### Step 7: Commit

```bash
git add nextjs/lib/types.ts nextjs/lib/ws/client.ts nextjs/components/CreatePartyForm.tsx nextjs/components/PartyCard.tsx nextjs/app/feed/PageContent.tsx nextjs/locales/ru.json nextjs/locales/en.json
git commit -m "feat: add scheduled_at to parties (frontend)"
```
