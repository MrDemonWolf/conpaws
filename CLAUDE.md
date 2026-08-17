# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConPaws is a furry convention companion app — an Expo/React Native mobile app plus a Next.js website, in a bun/Turborepo monorepo. The app is **local-first** (all core features work offline). Premium features ("ConPaws+") will be powered by RevenueCat. The cloud backend target is **Cloudflare Workers + D1 + R2 with Hono, tRPC, and Better-Auth** — no Supabase, no VPS, no Docker.

**Repo reality check:** the native MVP is in active development. It has Expo Router screens, a SQLite/Drizzle schema and repositories, ICS/Sched import, convention-timezone handling, local reminders, backup import/export, and Vitest coverage. The premium/cloud backend, RevenueCat integration, and `apps/server` remain planned. Do not reference planned backend files as if they exist.

## Development Commands

All commands run from the **repo root** and fan out through Turborepo:

```bash
bun install               # Install dependencies (bun is pinned via packageManager: bun@1.3.10)
bun dev                   # Start web + native dev servers
bun dev:web               # Next.js only (http://localhost:3001)
bun dev:native            # Expo dev server only
bun start                 # Expo dev server (development variant)
bun start:preview         # Expo dev server (preview variant)
bun start:prod            # Expo dev server (production variant)
bun android / bun ios     # Run on device/simulator
bun build                 # turbo build
bun lint                  # Biome (`biome check .`) — this repo uses Biome, NOT ESLint
bun check-types           # TypeScript type checking across packages
bun test                  # Run the workspace Vitest suites
bun prebuild              # Generate native projects
bun prebuild:clean        # Clean and regenerate native projects
```

## Architecture

- **Native app:** Expo SDK **57.0.14** (React Native 0.86.2, React 19.2.3). Keep Expo at `>=57.0.9`; earlier SDK 57 patches contain the Hermes/Reanimated/Worklets memory regression.
- **Routing:** Expo Router `~57.0.14` — file-based routes in **`apps/native/app/`** (top level, NOT `src/app/`)
  - **Router versioning note:** Expo Router uses SDK-aligned versions from SDK 55 onward. The current `expo-router@~57.0.14` major is correct — do not "fix" it to a single-digit major.
- **Styling:** NativeWind v5 (Tailwind CSS v4) with `clsx` + `tailwind-merge` (`cn()` in `apps/native/src/lib/utils.ts`)
- **Local database:** expo-sqlite + Drizzle ORM in `apps/native/src/db/`, with bootstrap/migration logic and repositories for conventions and events
- **Backend (planned, `apps/server`):** Cloudflare Worker — Hono + tRPC + Better-Auth (pin >=1.6.x, per-request factory), D1 (SQLite/Drizzle), R2 storage, KV cache, Queues. **No RLS in D1** — all authorization happens in the Worker/tRPC layer.
- **Website (`apps/web`):** Next.js **16.2.12, pinned exactly** — Next 16.3 + OpenNext has an unbounded prefetch loop (opennextjs-cloudflare#1334). Do not bump Next; the pin is not an upgrade candidate until that issue is fixed. It is prepared for Cloudflare Workers through `@opennextjs/cloudflare` (1.20.2), but production routes are intentionally disabled and the site has not launched. See `apps/web/wrangler.jsonc` and `open-next.config.ts`. The intended waitlist flow is Turnstile → D1 → Brevo; valid submissions currently fail closed with HTTP 503 until those dependencies and route logic are implemented.
- **Auth (planned):** Better-Auth on the Worker, `@better-auth/expo` on the client — **open risk:** Expo SDK 57/New Architecture compatibility is unverified; test on a dev build before building on it
- **Payments (planned):** RevenueCat, entitlement `conpaws_plus`
- **Language:** TypeScript strict mode
- **Lint/format:** Biome (`biome.json` at repo root) — there is no ESLint config in this repo
- **Monorepo:** bun workspaces + Turborepo (`turbo.json`); CI runs from the root, not per-app
- **Entry point:** `expo-router/entry` (in `apps/native/package.json` `main`)

### Monorepo Structure

Verified against disk:

```
conpaws/
├── apps/
│   ├── native/              # Expo app
│   │   ├── app/             # Expo Router routes: onboarding, tabs, conventions, import, settings
│   │   ├── src/
│   │   │   ├── db/          # SQLite/Drizzle schema, bootstrap, migrations, repositories
│   │   │   ├── lib/         # ICS parsing, timezone, import policy, schedule selectors
│   │   │   ├── services/    # Local reminders and backup import/export
│   │   │   ├── global.css   # Tailwind entry point (Metro's NativeWind input)
│   │   │   └── components/ hooks/ locales/ assets/
│   │   ├── app.config.ts    # Variant-based Expo config
│   │   ├── eas.json         # Preview sideload and production store-build profiles
│   │   ├── metro.config.js
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   ├── web/                 # Next.js site (Cloudflare Workers via OpenNext)
│   └── server/              # (planned — does not exist) Hono/tRPC/Better-Auth Worker
├── packages/
│   ├── config/              # Shared tsconfig base
│   ├── env/                 # Zod-validated env schemas (src/native.ts: EXPO_PUBLIC_SERVER_URL; src/web.ts)
│   └── ui/                  # Shared shadcn/ui primitives (web)
├── biome.json
├── turbo.json
└── package.json
```

### Key Configuration (apps/native/)

- **app.config.ts** — Dynamic Expo config with variant-based bundle IDs and icons
- **eas.json** — EAS CLI 22.x, committed-tree guard, remote app-version counters, and production `autoIncrement`. `preview` creates private sideload artifacts; `production` creates store IPA/AAB artifacts. Store upload and release are manual; do not add auto-submit. See `apps/native/RELEASING.md`.
- **metro.config.js** — `withNativeWind(config, { input: "./src/global.css" })` (the input arg IS passed)
- **postcss.config.mjs** — plugin is `tailwindcss` (NOT `@tailwindcss/postcss`)
- **tsconfig.json** — Extends `expo/tsconfig.base`; path alias `@/*` maps to `./*` (NOT `./src/*`)
- **OTA is required for the MVP but remains fail-closed:** the chosen host is signed xprem **3.1.1** on Dokploy, not EAS Update. The SDK 57 app still has no `expo-updates`, update URL, runtime version, or channel configuration. Enable staging only after xprem is deployed, then pass physical iOS/Android cold-start, offline-start, and rollback tests before any production OTA path. See `notes/ota-updates.md`.

### Environment Variables

`.env` files are local-dev-only; EAS builds use **EAS Environment Variables** (`eas env:pull` to materialize locally). Workers use `wrangler.jsonc` bindings + `wrangler secret`, never `.env`.

- `EXPO_PUBLIC_SERVER_URL` — API Worker URL (validated by `packages/env/src/native.ts`)
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` — RevenueCat (optional; premium disabled without them)
- `EXPO_PUBLIC_SENTRY_DSN` — crash reporting (preview/production)

### App Variants

`APP_VARIANT` controls build configuration:
- `development` (default) — `com.mrdemonwolf.conpaws.dev`
- `preview` — `com.mrdemonwolf.conpaws.preview`
- `production` — `com.mrdemonwolf.conpaws`

### Native MVP Screens

The current routes cover onboarding, Home/Profile/Settings tabs, convention detail and schedule import, About, and language settings. Put new routes in `apps/native/app/` (top level) and use classic JS tabs — Expo Router Native Tabs is alpha and its API is subject to change. `notes/plan.md` remains the source for unfinished MVP and later product scope.

### Database Schema

The local expo-sqlite/Drizzle schema in `apps/native/src/db/` contains `conventions`, `convention_events`, and `offline_queue`, plus versioned bootstrap/migration and repository tests. The planned cloud D1 schema includes `profiles`, `username_blocklist`, `convention_directory`, `shared_conventions`, `shared_events`, and `verification_requests`. Full cloud indexing rationale is in `notes/plan.md` §Data Model. D1 rules that shape the planned schema: index every queried column (billing counts scanned rows), 100 bound params per query (chunk bulk imports), `db.batch()` is the only transaction primitive, no RLS.

### Schedule Import

ICS files and Sched convention URLs are implemented. The importer handles convention IANA timezones/DST, recurring-event identities, cancellations and re-import reconciliation, simultaneous events, categories, rooms, and content warnings. Keep re-import behavior covered with fixtures in `test-data/` and tests next to the parser, import policy, repositories, and services.

## Planning Notes

Planning and design documents live in `notes/`. They mix implemented decisions with future scope; verify claims against the current code before changing behavior.

| File | What's Inside |
|------|--------------|
| `notes/plan.md` | Full technical blueprint — tech stack (Cloudflare Workers/D1/R2), data models, screens, polling sync, iCal import, EAS production setup, dev phases |
| `notes/marketing.md` | Marketing strategy — website, social media, YouTube, profitability projections |
| `notes/pitchdeck.md` | Market research — fandom stats, convention data, competitive analysis (Barq), revenue projections |
| `notes/ideas.md` | Future feature brainstorms + pre-launch gap analysis |
| `notes/legal.md` | Privacy Policy and Terms of Service templates + App Store compliance checklist |

Each file has a **TL;DR** at the top for quick scanning. `plan.md` also has a table of contents.

Test data for iCal import development lives in `test-data/`:
- `test-data/indyfurcon2025.ics` — Real convention data (IndyFurCon 2025)
- `test-data/small-test.ics` — Clean test fixture (10 events, 3-day fictional con)
