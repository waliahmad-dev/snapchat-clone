# Snapchat Clone v2

A production-grade Snapchat clone built with Expo / React Native. Camera-first UI, ephemeral 1-on-1 snaps, 24-hour stories, realtime chat, streaks, memories archive, and a friends system.

---

## Stack at a Glance

| Layer           | Choice                                                        |
| --------------- | ------------------------------------------------------------- |
| Framework       | Expo 54 · React Native 0.81 · React 19 · TypeScript (strict)  |
| UI              | NativeWind (Tailwind) · Reanimated 4 · Skia 2 · Expo Router 6 |
| State           | Zustand (UI) · React Query v5 (server cache)                  |
| Backend         | Supabase (Postgres + Auth + Realtime + Storage)               |
| On-device cache | WatermelonDB (SQLite native / LokiJS in Expo Go)              |
| TTL store       | Upstash Redis (streaks, presence, view throttle)              |

The New Architecture is enabled — Reanimated 4 and Skia 2 require it.

---

## Repository Layout

```
Snapchat-clone-v2/
├── README.md               # this file
└── my-expo-app/            # the actual app — everything below is relative to here
    ├── app/                # Expo Router tree (file-based routing)
    │   ├── _layout.tsx     # root providers + AuthGate
    │   ├── (auth)/         # welcome / login / signup / verify
    │   └── (app)/          # camera, chat, stories, memories, profile, search, settings
    ├── src/
    │   ├── components/     # reusable ui/ + layout/
    │   ├── constants/      # colors, dimensions, config
    │   ├── features/       # feature-first: auth, camera, chat, stories, friends, memories, profile, settings
    │   │   └── <feature>/{components,hooks,store,utils}
    │   ├── hooks/          # cross-cutting hooks (app state, network, debounce)
    │   ├── lib/            # infra: supabase/, watermelondb/, redis/, imageManipulator/, theme/
    │   ├── navigation/     # custom SwipeNavigator (3-panel chat ← camera → stories)
    │   ├── panels/         # screen-level containers rendered by routes
    │   ├── providers/      # AppProviders, QueryProvider, WatermelonProvider, NotificationProvider
    │   └── types/          # database, navigation, media types
    ├── supabase/functions/ # Supabase Edge Functions (e.g. delete-account)
    ├── supabase-schema.sql # Postgres DDL + RLS + triggers
    ├── supabase-storage-rls.sql
    ├── app.json            # Expo config (plugins, permissions, scheme)
    ├── eas.json            # build profiles
    ├── babel.config.js     # decorators scoped to watermelondb/, reanimated plugin last
    ├── metro.config.js     # NativeWind transformer + op-sqlite blocklist
    ├── tailwind.config.js  # Snapchat palette
    └── tsconfig.json       # strict + path aliases (@/, @features/, @lib/, @components/)
```

### Why this shape

- **`app/` vs `src/`** — `app/` is owned by Expo Router; its tree _is_ the route tree. All domain code lives in `src/` so routing stays uncluttered. Routes render screen panels from [src/panels/](my-expo-app/src/panels/).
- **Feature-first** — each feature owns its components, hooks, store, and utils. A change to chat stays inside [src/features/chat/](my-expo-app/src/features/chat/) instead of touching five layer-folders.
- **`lib/` is infra only** — Supabase client, WatermelonDB schema/adapter, Redis client, image processor. No feature logic.

---

## Prerequisites

- **Node** ≥ 20 LTS
- **npm** (or pnpm/yarn — lockfile is npm)
- **EAS CLI** — `npm i -g eas-cli` (only if you build dev/prod binaries)
- **A physical device or simulator with a Dev Client**
  Expo Go is **not** sufficient: WatermelonDB's SQLite adapter, Skia, and Reanimated 4 all need native modules.
- **Accounts**:
  - [Supabase](https://supabase.com) project (Postgres + Auth + Storage + Realtime)
  - [Upstash Redis](https://upstash.com) database (REST API)

---

## First-Time Setup

```bash
git clone <repo-url> Snapchat-clone-v2
cd Snapchat-clone-v2/my-expo-app
npm install
```

### 1. Configure environment

Create `my-expo-app/.env.local`:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>

# Upstash Redis (REST)
EXPO_PUBLIC_UPSTASH_REDIS_REST_URL=https://<host>.upstash.io
EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN=<rest-token>

# App
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_APP_SCHEME=snapchat-clone
EXPO_PUBLIC_STREAK_TTL_HOURS=24
EXPO_PUBLIC_STORY_DURATION_HOURS=24
```

> **Heads up**: the Upstash token is currently client-shipped. Before public release, proxy Redis through a Supabase Edge Function authenticated by JWT.

### 2. Provision Supabase

In the Supabase SQL editor, run in order:

1. [my-expo-app/supabase-schema.sql](my-expo-app/supabase-schema.sql) — tables, RLS, triggers
2. [my-expo-app/supabase-storage-rls.sql](my-expo-app/supabase-storage-rls.sql) — bucket policies
3. [my-expo-app/supabase-add-reply-column.sql](my-expo-app/supabase-add-reply-column.sql)
4. [my-expo-app/supabase-add-dob-column.sql](my-expo-app/supabase-add-dob-column.sql)
5. [my-expo-app/supabase-add-settings-columns.sql](my-expo-app/supabase-add-settings-columns.sql)

Storage buckets used: `snaps`, `stories`, `memories`, `avatars`. Create them as private buckets — RLS in step 2 governs access.

Edge Functions (deploy with `supabase functions deploy <name>`):

- [supabase/functions/delete-account](my-expo-app/supabase/functions/delete-account) — account deletion path

### 3. Build a Dev Client (one-time, per device)

```bash
# from my-expo-app/
eas login
eas build --profile development --platform android   # or --platform ios
```

Install the resulting build on the device. Subsequent JS changes ship over the wire — no rebuild needed unless native deps change.

### 4. Run the dev server

```bash
npm start / npx expo start                  # then press 'a' / 'i', or scan QR with the dev client
npm run android            # shortcut
npm run ios                # shortcut
```

---

## Daily Scripts

| Script                            | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `npm start`                       | Expo dev server                                             |
| `npm run android` / `npm run ios` | Start + open on platform                                    |
| `npm run lint`                    | ESLint + Prettier check                                     |
| `npm run format`                  | ESLint --fix + Prettier write                               |
| `npm run prebuild`                | Generate native projects (only if leaving managed workflow) |

---

## Where to Look First

| You want to…                     | Start here                                                                                                                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Understand routing / auth gating | [app/\_layout.tsx](my-expo-app/app/_layout.tsx)                                                                                                                                                                                     |
| See the data model               | [my-expo-app/supabase-schema.sql](my-expo-app/supabase-schema.sql)                                                                                                                                                                  |
| Understand offline reads         | [src/lib/watermelondb/schema.ts](my-expo-app/src/lib/watermelondb/schema.ts)                                                                                                                                                        |
| Trace a snap end-to-end          | Camera → [src/panels/CameraMainPanel.tsx](my-expo-app/src/panels/CameraMainPanel.tsx) → [src/lib/imageManipulator/](my-expo-app/src/lib/imageManipulator/) → [src/lib/supabase/storage.ts](my-expo-app/src/lib/supabase/storage.ts) |
| Trace chat realtime              | [src/features/chat/hooks/useMessages.ts](my-expo-app/src/features/chat/hooks/useMessages.ts)                                                                                                                                        |
| Streak logic                     | [src/lib/redis/streak.ts](my-expo-app/src/lib/redis/streak.ts)                                                                                                                                                                      |
| Custom 3-panel gesture           | [src/navigation/SwipeNavigator.tsx](my-expo-app/src/navigation/SwipeNavigator.tsx)                                                                                                                                                  |

---

## Status (Lead Summary)

**Complete** — auth, profiles, friends (request/accept/decline/block), 1-on-1 realtime chat with optimistic sends, screenshot detection, streaks, stories (create/view/expire) with view throttling, memories pipeline, camera (preview/flash/zoom/focus), Skia drawing with undo, RLS on every table and bucket, gesture-driven SwipeNavigator.

**Partial** — video record path, snap viewer playback/expiry animation, some settings handlers, text-caption tool.

**Not yet** — video/voice playback, group chats, calls, Snap Map, reactions, Bitmoji, light theme, i18n, a11y pass, analytics, **tests**, **CI/CD**.

**Top risks** to flag before public release: no automated tests, client-shipped Upstash token, no resync on reconnect (realtime events missed while offline), WatermelonDB has no migration path defined yet, no push notifications. Detail and mitigations.

---

## Conventions

- **TypeScript strict** is on; do not loosen it. Decorators are enabled only inside [src/lib/watermelondb/](my-expo-app/src/lib/watermelondb/) — applying them globally breaks `expo-file-system`.
- **Path aliases**: prefer `@/`, `@features/`, `@lib/`, `@components/` over relative paths that traverse upward.
- **NativeWind first**: extend [tailwind.config.js](my-expo-app/tailwind.config.js) instead of inlining `StyleSheet.create`.
- **Zustand per feature**, **React Query for anything fetched** — keep them separated.
- **Reanimated plugin must remain last** in [babel.config.js](my-expo-app/babel.config.js).
- Block semantics are a hard reset: blocking wipes friendship, messages, and streak; RLS hides both directions; unblock starts from a blank slate.
