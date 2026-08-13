# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConPaws is a furry convention companion app — an Expo/React Native mobile app plus a Next.js website, in a bun/Turborepo monorepo. The app is **local-first** (all core features work offline). Premium features ("ConPaws+") will be powered by RevenueCat. The cloud backend target is **Cloudflare Workers + D1 + R2 with Hono, tRPC, and Better-Auth** — no Supabase, no VPS, no Docker.

**Repo reality check:** this repo is early. The native app is a scaffold (two route files), and there is **no backend code, no Supabase/RevenueCat code, no Drizzle schema, and no test files** yet. The full product design lives in `notes/plan.md`. Anything marked *(planned)* below does not exist on disk — do not reference planned files as if they exist.

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
bun test                  # turbo test (Vitest — planned; no test files exist yet)
bun prebuild              # Generate native projects
bun prebuild:clean        # Clean and regenerate native projects
```

## Architecture

- **Native app:** Expo SDK **55** (React Native 0.83) — upgrade target is SDK **57** (RN 0.86); see the upgrade path in `notes/plan.md`
- **Known mismatch:** `apps/native/package.json` pins `react: 19.0.0`, but SDK 55 expects React 19.2 — a real bug to fix (`npx expo install --fix`), not a doc typo
- **Routing:** Expo Router `~55.0.x` — file-based routes in **`apps/native/app/`** (top level, NOT `src/app/`)
  - **Router versioning note:** Expo Router uses SDK-aligned versions (v6 = SDK 54; then 55.x/56.x/57.x). `expo-router@~55.0.5` is correct — do not "fix" it to a single-digit major.
- **Styling:** NativeWind v5 (Tailwind CSS v4) with `clsx` + `tailwind-merge` (`cn()` in `apps/native/src/lib/utils.ts`)
- **Local database (planned):** expo-sqlite + Drizzle ORM (`apps/native/src/db/` is empty today; no `drizzle.config.ts` exists)
- **Backend (planned, `apps/server`):** Cloudflare Worker — Hono + tRPC + Better-Auth (pin >=1.6.x, per-request factory), D1 (SQLite/Drizzle), R2 storage, KV cache, Queues. **No RLS in D1** — all authorization happens in the Worker/tRPC layer.
- **Website (`apps/web`):** Next.js **16.2.12, pinned exactly** — Next 16.3 + OpenNext has an unbounded prefetch loop (opennextjs-cloudflare#1334). Do not bump Next; the pin is not an upgrade candidate until that issue is fixed. Deploys to Cloudflare Workers via `@opennextjs/cloudflare` (1.20.2) — see `apps/web/wrangler.jsonc` and `open-next.config.ts`. Waitlist API: Turnstile → D1 (source of truth) + Brevo (ESP).
- **Auth (planned):** Better-Auth on the Worker, `@better-auth/expo` on the client — **open risk:** Expo SDK 55+/New Architecture compatibility is unverified; test on a dev build before building on it
- **Payments (planned):** RevenueCat, entitlement `conpaws_plus`
- **Language:** TypeScript strict mode
- **Lint/format:** Biome (`biome.json` at repo root) — there is no ESLint config in this repo
- **Monorepo:** bun workspaces + Turborepo (`turbo.json`); CI runs from the root, not per-app
- **Entry point:** `expo-router/entry` (in `apps/native/package.json` `main`)

### Monorepo Structure

Verified against disk, with one caveat: `biome.json` and `apps/web`'s OpenNext/`wrangler.jsonc` config land from the pre-release-site branch — if they are missing on your checkout, that branch has not merged yet.

```
conpaws/
├── apps/
│   ├── native/              # Expo app
│   │   ├── app/             # Expo Router routes (only _layout.tsx + index.tsx today)
│   │   ├── src/
│   │   │   ├── lib/utils.ts # cn() helper
│   │   │   ├── global.css   # Tailwind entry point (Metro's NativeWind input)
│   │   │   └── components/ contexts/ db/ hooks/ locales/ services/ types/ assets/  # empty (.gitkeep)
│   │   ├── app.config.ts    # Variant-based Expo config
│   │   ├── eas.json         # NOTE: submit block has placeholder values (tracked as CON-35)
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
- **eas.json** — `appVersionSource: "remote"`, production `autoIncrement: true`; submit block still has invalid placeholders (CON-35, owned by another branch — do not edit here)
- **metro.config.js** — `withNativeWind(config, { input: "./src/global.css" })` (the input arg IS passed)
- **postcss.config.mjs** — plugin is `tailwindcss` (NOT `@tailwindcss/postcss`)
- **tsconfig.json** — Extends `expo/tsconfig.base`; path alias `@/*` maps to `./*` (NOT `./src/*`)
- There is **no** `drizzle.config.ts` and **no** `vitest.config.ts` — both are planned

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

### Planned Screen Structure (NOT built — 0 of these routes exist)

The MVP screen plan (onboarding flow, tabs for Home/Profile/Settings, convention CRUD + detail, event CRUD + detail, iCal import + preview, settings/about) is specified in `notes/plan.md` §Screens & Navigation and §Development Phases. Today `apps/native/app/` contains only `_layout.tsx` and `index.tsx`. When building screens, put routes in `apps/native/app/` (top level) and use classic JS tabs — Expo Router Native Tabs is alpha and its API is subject to change.

### Planned Database Schema (NOT built)

Local (expo-sqlite + Drizzle, planned in `apps/native/src/db/`): `conventions`, `convention_events`, `offline_queue`. Cloud (D1 + Drizzle, planned in `apps/server`): `profiles`, `username_blocklist`, `convention_directory`, `shared_conventions`, `shared_events`, `verification_requests`. Full schemas with indexing rationale are in `notes/plan.md` §Data Model. D1 rules that shape the schema: index every queried column (billing counts scanned rows), 100 bound params per query (chunk bulk inserts), `db.batch()` is the only transaction primitive, no RLS.

### iCal Import (planned, core feature)

Import .ics files and Sched convention URLs — parser design (VEVENT mapping, category discovery, content-warning detection, `sourceUid` dedup on re-import) is in `notes/plan.md` §iCal Import. Test fixtures already exist in `test-data/`.

## Planning Notes

All planning and design documents live in `notes/` — these are **pre-development docs**, not shipped code.

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
