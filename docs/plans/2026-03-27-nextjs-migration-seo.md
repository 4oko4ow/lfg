# Next.js Migration + SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate React/Vite SPA to Next.js App Router, adding game-specific static pages for SEO while keeping the Go backend untouched.

**Architecture:** New `nextjs/` directory alongside existing `frontend/`. All existing pages become `'use client'` components (they use WebSocket, localStorage, window.location). New `/game/[slug]` pages are Server Components with `generateStaticParams` + `generateMetadata` that pre-render SEO HTML, then hydrate with the client feed. Once tested, Vercel config is pointed at `nextjs/` and `frontend/` is removed.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, i18next, lucide-react, react-hot-toast

---

## Task 1: Initialize Next.js project

**Files:**
- Create: `nextjs/` (directory via npx)

**Step 1: Scaffold Next.js app**

From repo root:
```bash
cd /path/to/lfg-mvp
npx create-next-app@latest nextjs \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

When prompted, accept defaults. This creates `nextjs/` with App Router, TypeScript, and Tailwind.

**Step 2: Install runtime dependencies**

```bash
cd nextjs
npm install i18next react-i18next lucide-react react-hot-toast
npm install i18next-resources-to-backend
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: server starts on http://localhost:3000, default Next.js page loads.

**Step 4: Commit**

```bash
cd ..
git add nextjs/
git commit -m "feat: scaffold Next.js app for SEO migration"
```

---

## Task 2: Copy shared code

**Files:**
- Create: `nextjs/lib/types.ts` (from `frontend/src/types.ts`)
- Create: `nextjs/lib/constants/games.ts` (from `frontend/src/constants/games.ts`)
- Create: `nextjs/lib/constants/achievements.ts` (from `frontend/src/constants/achievements.ts`)
- Create: `nextjs/lib/utils/analytics.ts` (from `frontend/src/utils/analytics.ts`)
- Create: `nextjs/lib/utils/anonIdentity.ts` (from `frontend/src/utils/anonIdentity.ts`)
- Create: `nextjs/lib/utils/contactHelpers.ts` (from `frontend/src/utils/contactHelpers.ts`)
- Create: `nextjs/lib/utils/telegramAuth.ts` (from `frontend/src/utils/telegramAuth.ts`)
- Create: `nextjs/lib/ws/client.ts` (from `frontend/src/ws/client.ts`)
- Create: `nextjs/lib/seo.ts` (SEO data extracted from DynamicMeta.tsx)
- Create: `nextjs/locales/ru.json` (copy from `frontend/src/locales/ru.json`)
- Create: `nextjs/locales/en.json` (copy from `frontend/src/locales/en.json`)

**Step 1: Copy files**

```bash
mkdir -p nextjs/lib/constants nextjs/lib/utils nextjs/lib/ws nextjs/locales
cp frontend/src/types.ts nextjs/lib/types.ts
cp frontend/src/constants/games.ts nextjs/lib/constants/games.ts
cp frontend/src/constants/achievements.ts nextjs/lib/constants/achievements.ts
cp frontend/src/utils/analytics.ts nextjs/lib/utils/analytics.ts
cp frontend/src/utils/anonIdentity.ts nextjs/lib/utils/anonIdentity.ts
cp frontend/src/utils/contactHelpers.ts nextjs/lib/utils/contactHelpers.ts
cp frontend/src/utils/telegramAuth.ts nextjs/lib/utils/telegramAuth.ts
cp frontend/src/ws/client.ts nextjs/lib/ws/client.ts
cp frontend/src/locales/ru.json nextjs/locales/ru.json
cp frontend/src/locales/en.json nextjs/locales/en.json
```

**Step 2: Fix import paths in copied files**

In each copied file, replace any `../` imports that reference old paths. Most utils have no internal imports so this is minimal. Check each file after copying.

In `nextjs/lib/constants/games.ts` - no changes needed (no imports).
In `nextjs/lib/ws/client.ts` - verify it only imports from `../types` → change to `@/lib/types`.

**Step 3: Create `nextjs/lib/seo.ts`**

Extract SEO data from `frontend/src/components/DynamicMeta.tsx` (the `HOME_SEO` and `GAME_SEO` objects) into a standalone file:

```typescript
// nextjs/lib/seo.ts

export const HOME_SEO = {
  title: "Сайт для поиска тиммейтов — FindParty Online | Поиск тиммейтов для Dota 2, CS2, Rust, Fortnite",
  description: "Сайт для поиска тиммейтов? FindParty — быстрый поиск тиммейтов для Dota 2, CS2, Rust, Fortnite, Valorant, Minecraft, Apex, PUBG, Tarkov, REPO и других игр. Поиск тиммейтов дота 2, поиск тиммейтов раст, поиск тиммейтов кс 2, поиск тиммейтов фортнайт, поиск тиммейтов валорант, поиск тиммейтов майнкрафт. Без регистрации, живой чат, всё бесплатно.",
};

export const GAME_SEO: Record<string, { title: string; description: string }> = {
  // paste the full GAME_SEO object from DynamicMeta.tsx here
  repo: {
    title: "Поиск игроков для R.E.P.O — FindParty | Найти команду и тиммейтов",
    description: "Поиск игроков для R.E.P.O? FindParty — быстрый способ найти команду и тиммейтов для игры R.E.P.O. Создай пати или вступи в готовую команду за 10 секунд. Без регистрации, всё бесплатно.",
  },
  // ... (copy all entries from DynamicMeta.tsx)
};

export function getGameSeo(slug: string) {
  return GAME_SEO[slug] ?? {
    title: `Найти тиммейтов — FindParty`,
    description: `Найди тиммейтов и пати на FindParty. Без регистрации, всё бесплатно.`,
  };
}
```

**Step 4: Create i18n setup for client components**

```typescript
// nextjs/lib/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "@/locales/ru.json";
import en from "@/locales/en.json";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        ru: { translation: ru },
        en: { translation: en },
      },
      lng: "ru",
      fallbackLng: "ru",
      interpolation: { escapeValue: false },
    });
}

export default i18n;
```

**Step 5: Commit**

```bash
git add nextjs/lib nextjs/locales
git commit -m "feat: copy shared code and SEO data to Next.js app"
```

---

## Task 3: Configure Tailwind v4 and global styles

**Files:**
- Modify: `nextjs/app/globals.css`
- Modify: `nextjs/next.config.ts`

**Step 1: Check existing Tailwind setup**

Next.js 15 with `--tailwind` already installs `tailwindcss` and creates `globals.css`. Verify it uses Tailwind v4 syntax (check `nextjs/package.json` for `"tailwindcss": "^4"`).

If it installed Tailwind v3, upgrade:
```bash
cd nextjs
npm install tailwindcss@^4 @tailwindcss/postcss
```

**Step 2: Copy global styles from Vite app**

Look at `frontend/src/index.css` (or wherever global styles are defined) and copy any custom CSS variables, animations (`animate-fadeIn`, etc.) into `nextjs/app/globals.css`.

Key things to copy:
- CSS custom properties
- `@keyframes fadeIn` for `animate-fadeIn` used in PartyFeedPage
- Background color / default body styles

**Step 3: Verify Tailwind config**

In Tailwind v4, there is no `tailwind.config.js`. Configuration is done via `@import "tailwindcss"` in CSS. Ensure `nextjs/app/globals.css` starts with:
```css
@import "tailwindcss";
```

**Step 4: Commit**

```bash
git add nextjs/app/globals.css nextjs/next.config.ts
git commit -m "feat: configure Tailwind v4 and global styles"
```

---

## Task 4: Set up root layout and providers

**Files:**
- Create: `nextjs/components/providers/AuthProvider.tsx` (from `frontend/src/context/AuthContext.tsx`)
- Create: `nextjs/components/providers/OnlineCountProvider.tsx` (from `frontend/src/context/OnlineCountContext.tsx`)
- Create: `nextjs/components/providers/I18nProvider.tsx`
- Create: `nextjs/components/providers/Providers.tsx` (combines all providers)
- Modify: `nextjs/app/layout.tsx`

**Step 1: Create AuthProvider**

Copy `frontend/src/context/AuthContext.tsx` to `nextjs/components/providers/AuthProvider.tsx`.

Add `'use client'` at the top (required - uses useState, useEffect, window.location).

Fix imports:
- `import type { ... } from "@/lib/types"` (instead of `../types`)
- `import { analytics } from "@/lib/utils/analytics"`
- Remove `import.meta.env.VITE_BACKEND_URL` - replace with `process.env.NEXT_PUBLIC_BACKEND_URL`:

```typescript
'use client'
// ... rest of imports

const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
```

**Step 2: Create OnlineCountProvider**

Copy `frontend/src/context/OnlineCountContext.tsx` to `nextjs/components/providers/OnlineCountProvider.tsx`.

Add `'use client'` at top. Fix imports to use `@/lib/` paths.

**Step 3: Create I18nProvider**

```typescript
// nextjs/components/providers/I18nProvider.tsx
'use client'
import { useEffect } from "react";
import "@/lib/i18n"; // initialize i18n on client

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

**Step 4: Create combined Providers**

```typescript
// nextjs/components/providers/Providers.tsx
'use client'
import { AuthProvider } from "./AuthProvider";
import { OnlineCountProvider } from "./OnlineCountProvider";
import { I18nProvider } from "./I18nProvider";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <OnlineCountProvider>
          {children}
          <Toaster />
        </OnlineCountProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
```

**Step 5: Update root layout**

```typescript
// nextjs/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { HOME_SEO } from "@/lib/seo";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: HOME_SEO.title,
  description: HOME_SEO.description,
  openGraph: {
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    siteName: "FindParty",
    locale: "ru_RU",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

**Step 6: Commit**

```bash
git add nextjs/components/providers nextjs/app/layout.tsx
git commit -m "feat: set up providers and root layout"
```

---

## Task 5: Migrate UI components

**Files:**
- Create: `nextjs/components/` (migrated from `frontend/src/components/`)

**Step 1: Copy all components**

```bash
mkdir -p nextjs/components/modals
cp frontend/src/components/Header.tsx nextjs/components/Header.tsx
cp frontend/src/components/PartyCard.tsx nextjs/components/PartyCard.tsx
cp frontend/src/components/PartyCardSkeleton.tsx nextjs/components/PartyCardSkeleton.tsx
cp frontend/src/components/Chat.tsx nextjs/components/Chat.tsx
cp frontend/src/components/ChatDrawer.tsx nextjs/components/ChatDrawer.tsx
cp frontend/src/components/ContactModal.tsx nextjs/components/ContactModal.tsx
cp frontend/src/components/FeedbackButton.tsx nextjs/components/FeedbackButton.tsx
cp frontend/src/components/NoJoinSurvey.tsx nextjs/components/NoJoinSurvey.tsx
cp frontend/src/components/CreatorBadge.tsx nextjs/components/CreatorBadge.tsx
cp frontend/src/components/CreatorTooltip.tsx nextjs/components/CreatorTooltip.tsx
cp frontend/src/components/TelegramLoginButton.tsx nextjs/components/TelegramLoginButton.tsx
cp frontend/src/components/modals/CreatePartyModal.tsx nextjs/components/modals/CreatePartyModal.tsx
cp frontend/src/components/modals/LoginModal.tsx nextjs/components/modals/LoginModal.tsx
cp frontend/src/components/modals/SuggestGameModal.tsx nextjs/components/modals/SuggestGameModal.tsx
cp frontend/src/forms/CreatePartyForm.tsx nextjs/components/CreatePartyForm.tsx
cp frontend/src/hooks/useCreatorProfile.ts nextjs/hooks/useCreatorProfile.ts
```

**Step 2: Add `'use client'` to all interactive components**

Every component that uses hooks (useState, useEffect, useContext), event handlers, or browser APIs needs `'use client'` at the top.

Add `'use client'` to:
- `Header.tsx`
- `PartyCard.tsx`
- `Chat.tsx`, `ChatDrawer.tsx`
- `ContactModal.tsx`
- `FeedbackButton.tsx`
- `NoJoinSurvey.tsx`
- `CreatorBadge.tsx`, `CreatorTooltip.tsx`
- `TelegramLoginButton.tsx`
- `modals/CreatePartyModal.tsx`, `modals/LoginModal.tsx`, `modals/SuggestGameModal.tsx`
- `CreatePartyForm.tsx`
- `hooks/useCreatorProfile.ts`

**Step 3: Fix imports in all components**

Replace all `../context/AuthContext` with `@/components/providers/AuthProvider`.
Replace all `../context/OnlineCountContext` with `@/components/providers/OnlineCountProvider`.
Replace all `../types` with `@/lib/types`.
Replace all `../utils/analytics` with `@/lib/utils/analytics`.
Replace all `../ws/client` with `@/lib/ws/client`.
Replace all `../constants/games` with `@/lib/constants/games`.

In `Header.tsx`, replace `react-router-dom` Link/useNavigate with `next/link` and `next/navigation`:
- `import Link from "next/link"` instead of `import { Link } from "react-router-dom"`
- `import { useRouter, usePathname } from "next/navigation"` instead of `import { useNavigate, useLocation } from "react-router-dom"`
- `router.push('/feed')` instead of `navigate('/feed')`
- `pathname === '/feed'` instead of `location.pathname === '/feed'`

**Step 4: Commit**

```bash
git add nextjs/components nextjs/hooks
git commit -m "feat: migrate UI components to Next.js"
```

---

## Task 6: Migrate pages (landing, feed, profile, auth)

**Files:**
- Create: `nextjs/app/page.tsx` (landing page)
- Create: `nextjs/app/feed/page.tsx`
- Create: `nextjs/app/profile/page.tsx`
- Create: `nextjs/app/communities/page.tsx`
- Create: `nextjs/app/auth/callback/page.tsx`
- Create: `nextjs/app/auth/telegram/callback/page.tsx`
- Create: `nextjs/app/telegram-auth-relay/page.tsx`

**Step 1: Copy and adapt each page**

For each page from `frontend/src/pages/`:

```bash
mkdir -p nextjs/app/feed nextjs/app/profile nextjs/app/communities
mkdir -p nextjs/app/auth/callback nextjs/app/auth/telegram/callback
mkdir -p nextjs/app/telegram-auth-relay
```

Copy content from each Vite page, then:
1. Add `'use client'` at top of each page (all pages use hooks/browser APIs)
2. Remove `<DynamicMeta />` import and usage (Next.js handles meta via `generateMetadata`)
3. Replace `react-router-dom` hooks:
   - `useLocation()` → `useSearchParams()` from `next/navigation`
   - `useNavigate()` → `useRouter()` from `next/navigation`
   - `<Navigate to="/" />` → `redirect('/')` from `next/navigation`
4. Fix import paths to use `@/` aliases

Example for `nextjs/app/feed/page.tsx`:
```typescript
'use client'
// ... (content of PartyFeedPage.tsx with above changes)
// At top, remove DynamicMeta import
// Replace: const location = useLocation()
// With:    const searchParams = useSearchParams()
// Replace: location.search
// With:    searchParams.toString() (or searchParams.get('game'))
```

**Step 2: Create landing page**

Copy `frontend/src/pages/LandingPage.tsx` to `nextjs/app/page.tsx`.
Add `'use client'`. Fix imports.

**Step 3: Add Header to layout or each page**

Option A (recommended): Add `<Header />` to `nextjs/app/layout.tsx` above `{children}`.
Option B: Add it to each page. Choose A for DRY.

**Step 4: Commit**

```bash
git add nextjs/app/
git commit -m "feat: migrate all pages to Next.js App Router"
```

---

## Task 7: Create SEO game pages (the main goal)

**Files:**
- Create: `nextjs/app/game/[slug]/page.tsx`
- Create: `nextjs/app/game/[slug]/GameFeedClient.tsx`

**Step 1: Create GameFeedClient (client component)**

This is a copy of PartyFeedPage with a pre-selected game filter:

```typescript
// nextjs/app/game/[slug]/GameFeedClient.tsx
'use client'
// ... same imports as PartyFeedPage

interface Props {
  slug: string;
  gameName: string;
}

export function GameFeedClient({ slug, gameName }: Props) {
  // Copy all of PartyFeedPage content
  // BUT: initialize filter with gameName instead of ALL_LABEL
  // Replace: const [filter, setFilter] = useState<string>(ALL_LABEL)
  // With:    const [filter, setFilter] = useState<string>(gameName)

  // Also: instead of reading ?game from URL params,
  // the game is fixed by the slug prop
  // Remove the useEffect that reads location.search for game filter

  // ... rest of PartyFeedPage JSX unchanged
}
```

**Step 2: Create the Server Component page**

```typescript
// nextjs/app/game/[slug]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAME_SLUGS, SLUG_TO_FALLBACK_NAME } from "@/lib/constants/games";
import { getGameSeo } from "@/lib/seo";
import { GameFeedClient } from "./GameFeedClient";

// Pre-render top 10 game pages at build time (phase 1)
const TOP_GAME_SLUGS = ["repo", "dota2", "cs2", "rust", "fortnite", "minecraft", "valorant", "apex", "tarkov", "peak"] as const;

export function generateStaticParams() {
  return TOP_GAME_SLUGS.map((slug) => ({ slug }));
}

// Generate SEO metadata per game
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seo = getGameSeo(slug);
  return {
    title: seo.title,
    description: seo.description,
    openGraph: {
      title: seo.title,
      description: seo.description,
      siteName: "FindParty",
      locale: "ru_RU",
      type: "website",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    alternates: {
      canonical: `https://findparty.online/game/${slug}`,
    },
  };
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 404 for unknown slugs
  if (!(GAME_SLUGS as readonly string[]).includes(slug)) {
    notFound();
  }

  const gameName = SLUG_TO_FALLBACK_NAME[slug as keyof typeof SLUG_TO_FALLBACK_NAME];

  return <GameFeedClient slug={slug} gameName={gameName} />;
}
```

**Step 3: Verify static generation works**

```bash
cd nextjs
npm run build
```

Expected: build succeeds, output shows 75+ static pages generated under `/game/[slug]`.

**Step 4: Commit**

```bash
git add nextjs/app/game/
git commit -m "feat: add SEO game pages with static generation and metadata"
```

---

## Task 8: Create sitemap.ts

**Files:**
- Create: `nextjs/app/sitemap.ts`

**Step 1: Write sitemap**

```typescript
// nextjs/app/sitemap.ts
import type { MetadataRoute } from "next";
import { GAME_SLUGS } from "@/lib/constants/games";

const BASE_URL = "https://findparty.online";

export default function sitemap(): MetadataRoute.Sitemap {
  const TOP_GAME_SLUGS = ["repo", "dota2", "cs2", "rust", "fortnite", "minecraft", "valorant", "apex", "tarkov", "peak"];
  const gamePages = TOP_GAME_SLUGS.map((slug) => ({
    url: `${BASE_URL}/game/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/feed`,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 0.9,
    },
    ...gamePages,
  ];
}
```

**Step 2: Verify sitemap is generated**

After `npm run build`, visit `http://localhost:3000/sitemap.xml` in dev mode (`npm run dev`) and confirm it lists all game pages.

**Step 3: Commit**

```bash
git add nextjs/app/sitemap.ts
git commit -m "feat: add sitemap with all game pages"
```

---

## Task 9: Set up environment variables and Vercel config

**Files:**
- Create: `nextjs/.env.local` (local dev only, gitignored)
- Modify: `vercel.json` or Vercel dashboard settings

**Step 1: Create local env file**

```bash
# nextjs/.env.local
NEXT_PUBLIC_BACKEND_URL=https://lfg.findparty.online
```

For local dev pointing to local backend:
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

**Step 2: Update Vercel project settings**

In Vercel dashboard → Project Settings → General:
- Change "Root Directory" from `frontend` to `nextjs`
- Framework Preset: Next.js (auto-detected)

Or in `vercel.json` at repo root:
```json
{
  "buildCommand": "cd nextjs && npm run build",
  "outputDirectory": "nextjs/.next",
  "installCommand": "cd nextjs && npm install",
  "framework": "nextjs"
}
```

**Step 3: Add environment variable in Vercel dashboard**

Add `NEXT_PUBLIC_BACKEND_URL` = `https://lfg.findparty.online` in Vercel Project → Settings → Environment Variables.

**Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore: point Vercel to Next.js app"
```

---

## Task 10: Add game page navigation from feed

**Files:**
- Modify: `nextjs/components/Header.tsx` or wherever game links are appropriate
- Modify: `nextjs/app/feed/page.tsx` - update game filter chips to link to `/game/[slug]`

**Step 1: Update game filter chips in FeedPage**

In the game filter section of PartyFeedPage, make popular game chips link to `/game/[slug]` for SEO (while still working as client-side filters):

```typescript
// For each popular game chip, add an <a> tag alongside the button
// OR: navigate to /game/slug when clicking a game filter
// This helps Google discover the game pages via internal links

import { useRouter } from "next/navigation";
const router = useRouter();

// In onClick for game filter:
onClick={() => {
  setFilter(game.name);
  // Update URL to /game/slug for SEO and shareability
  router.push(`/game/${game.slug}`, { scroll: false });
}}
```

**Step 2: Add canonical URL handling**

In `GameFeedClient`, when user changes game filter, update URL to match:
```typescript
// When filter changes in GameFeedClient, push to correct game URL
```

**Step 3: Commit**

```bash
git add nextjs/
git commit -m "feat: link game filters to SEO game pages"
```

---

## Task 11: Verify build and deploy

**Step 1: Full build check**

```bash
cd nextjs
npm run build
```

Expected: no TypeScript errors, all 75+ game pages statically generated, sitemap created.

**Step 2: Test locally**

```bash
npm run start
```

Visit:
- `http://localhost:3000/` - landing page works
- `http://localhost:3000/feed` - party feed loads with WebSocket
- `http://localhost:3000/game/repo` - REPO page loads with SEO title "Поиск игроков для R.E.P.O"
- `http://localhost:3000/game/dota2` - Dota 2 page loads
- `http://localhost:3000/sitemap.xml` - lists all pages

Check in browser DevTools → Network that WebSocket connects to Go backend.

**Step 3: Check page source (the whole point)**

```bash
curl http://localhost:3000/game/repo | grep "<title>"
```

Expected: `<title>Поиск игроков для R.E.P.O — FindParty | Найти команду и тиммейтов</title>`

This is the key test - title must be in the HTML response, not injected by JS.

**Step 4: Deploy to Vercel**

```bash
cd ..  # repo root
git push origin master
```

Vercel auto-deploys. Verify preview URL works.

**Step 5: Submit sitemap to Google Search Console**

After deploy, go to Google Search Console → Sitemaps → add `https://findparty.online/sitemap.xml`.

**Step 6: Submit sitemap to Yandex Webmaster**

In Yandex Webmaster → Sitemap Files → add `https://findparty.online/sitemap.xml`.

---

## Task 12: Remove old Vite frontend (after cutover)

Only after confirming production Next.js works for 1-2 days.

**Step 1: Archive frontend**

```bash
git rm -r frontend/
git commit -m "chore: remove Vite frontend after Next.js migration"
```

---

## Key decisions and gotchas

1. **All pages are `'use client'`** - this is correct and expected. The SEO value comes from the new `/game/[slug]` Server Component wrappers and the sitemap, not from making the existing feed server-rendered.

2. **Tailwind v4** - no `tailwind.config.js`. Use `@import "tailwindcss"` in globals.css. Custom utilities go in the CSS file using `@utility`.

3. **Next.js 15 async params** - `params` is now a `Promise`. Always `await params` in `generateMetadata` and page components.

4. **i18n** - i18next works client-side only. The `lib/i18n.ts` guard (`if (!i18n.isInitialized)`) prevents re-initialization on HMR.

5. **WebSocket** - remains fully client-side. `ws/client.ts` is imported only from `'use client'` components.

6. **`import.meta.env.VITE_*`** - must be changed to `process.env.NEXT_PUBLIC_*` everywhere.

7. **`react-router-dom`** - removed entirely. Use `next/link`, `next/navigation` instead.

8. **`useSearchParams` must be wrapped in Suspense** in Next.js 15. If the build errors on this, wrap the component that uses `useSearchParams` in a `<Suspense>` boundary.
