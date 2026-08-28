# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills and documentation

For every task, first discover the installed skills and plugin capabilities that are relevant to the request. Use each relevant skill that materially improves correctness or execution, including the applicable Expo and platform skills for native app work. Read and follow each selected skill before acting, and use its official documentation workflow when APIs, configuration, or platform rules may have changed. Announce skill use when the skill requires it. Do not load or invoke unrelated skills simply to increase the count.

## Browser and visual testing

Use the agent's built-in browser for localhost viewers and browser-based test surfaces, including serve-sim. Do not open Safari, Chrome, or another external browser unless the user explicitly requests it. Reuse existing local servers and ports instead of starting duplicates.

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
bun run test              # Run the workspace Vitest suites — NOT `bun test`
bun prebuild              # Generate native projects
bun prebuild:clean        # Clean and regenerate native projects
bun ship:prep             # Bump BUILD_NUMBER, prebuild, verify — before every store or device build
bun build-number:check    # Confirm ios/ and android/ carry the current BUILD_NUMBER
```

**`bun test` is not the test command.** `test` is a Bun builtin, so bare `bun test`
runs Bun's own runner instead of the `test` script and collapses with
`vi.hoisted is not a function` plus a pile of unrelated module-resolution errors —
none of which mean anything is wrong with the code. Always `bun run test`. The
other scripts have no builtin of the same name, so `bun lint` and `bun check-types`
are fine as written.

## Architecture

- **Native app:** Expo SDK **57.0.15** (React Native 0.86.2, React 19.2.3). Keep Expo at `>=57.0.9`; earlier SDK 57 patches contain the Hermes/Reanimated/Worklets memory regression.
- **Routing:** Expo Router `~57.0.15` — file-based routes in **`apps/native/app/`** (top level, NOT `src/app/`)
  - **Router versioning note:** Expo Router uses SDK-aligned versions from SDK 55 onward. The current `expo-router@~57.0.15` major is correct — do not "fix" it to a single-digit major.
- **Styling:** NativeWind v5 (Tailwind CSS v4) with `clsx` + `tailwind-merge` (`cn()` in `apps/native/src/lib/utils.ts`)
- **Local database:** expo-sqlite + Drizzle ORM in `apps/native/src/db/`, with bootstrap/migration logic and repositories for conventions and events
- **Backend (planned, `apps/server`):** Cloudflare Worker — Hono + tRPC + Better-Auth (pin >=1.6.x, per-request factory), D1 (SQLite/Drizzle), R2 storage, KV cache, Queues. **No RLS in D1** — all authorization happens in the Worker/tRPC layer.
- **Website (`apps/web`):** Next.js **16.2.12, pinned exactly** — Next 16.3 + OpenNext has an unbounded prefetch loop (opennextjs-cloudflare#1334). Do not bump Next; the pin is not an upgrade candidate until that issue is fixed. It ships to Cloudflare Workers through `@opennextjs/cloudflare` (1.20.2, also pinned exactly).
- **Infrastructure (`packages/infra`):** **Alchemy** (`alchemy.run.ts`) owns production — the D1 database, the Worker bindings and secrets, migrations, and the hourly waitlist reconciler Worker. `bun run deploy` / `bun run destroy` from the repo root. `apps/web/wrangler.jsonc` is **local dev and CI preview only**; never put a real `database_id` in it. `alchemy` and the Effect packages are pinned exactly because 2.0 is still beta. Alchemy does not do canary or automatic rollback — rollback is manual. See the **Prerelease Site** page in Notion (§Deployment).
- **Waitlist:** the route is implemented but **no ESP is connected**, so the whole path is dormant by design. Flow: `honeypot + timing gate → Turnstile siteverify → D1 insert → ESP double opt-in in ctx.waitUntil`, with `apps/web/workers/reconcile.ts` replaying `synced_at IS NULL` rows hourly. D1 is the source of truth and the row **is** the consent record; the ESP owns confirmation tokens, so there is deliberately no `confirm_token` column. The public form is closed (`WAITLIST_ACCEPTING_SIGNUPS` in `apps/web/src/components/waitlist.tsx`) and the route fails closed with 503 whenever the bindings or secrets are absent — CI asserts that 503.
- **The ESP is listmonk** — self-hosted listmonk v5 at `lists.mrdemonwolf.com` (Dokploy on ash-01, sending via Amazon SES us-east-1). Brevo was never provisioned, was never wanted, and is gone from the codebase as of 2026-08-28. The client is `apps/web/src/lib/listmonk.ts`, wired into the signup route and the hourly reconciler. Config is `LISTMONK_BASE_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_ID` (list **3**, the private double opt-in "ConPaws Waitlist"); any missing value makes `readListmonkConfig` return `null`, which is the 503/no-op fail-closed signal. `/api` sits outside Cloudflare Access deliberately, so the API token is the only credential — no Access service token.
- **Signup is one API call, and that is deliberate.** `POST /api/subscribers` with `preconfirm_subscriptions: false` **already sends the opt-in email** — listmonk's `InsertSubscriber` calls `SendOptinConfirmation` itself for double opt-in lists. Do not add a follow-up `POST /api/subscribers/{id}/optin`; it sends a second email. A **409** (address already known — every one of the six imported subscribers, if they use the form again) is treated as success, because the only way to reach it is an earlier create, and that create already sent the opt-in. Do not "improve" this by looking the subscriber up to re-send: listmonk has no lookup-by-email route, so it would need the `query=` SQL parameter and therefore the **`subscribers:sql_query`** permission — arbitrary read SQL that supersedes all list and subscriber permissions — on a token that lives at the edge. Two further dependencies worth knowing: listmonk's "send opt-in confirmation" setting must stay **on** or signups silently stop mailing anyone, and the API user needs **manage** permission on list 3 or listmonk filters the list out and creates the subscriber with no list and no email, returning 200. Also note listmonk v5 supports only hCaptcha and Altcha, **not Turnstile** — Turnstile stays verified by our own route.
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
│   │   │   ├── services/    # Local reminders, backup import/export, widget snapshot
│   │   │   ├── global.css   # Tailwind entry point
│   │   │   └── components/ hooks/ locales/ fixtures/ assets/
│   │   ├── targets/         # Apple targets via @bacons/apple-targets (NOT hand-written pbxproj)
│   │   │   ├── widget/      # iOS Home Screen + Lock Screen widget extension
│   │   │   ├── watch/       # watchOS app
│   │   │   ├── watch-widget/ # watchOS Smart Stack complication
│   │   │   └── _shared/     # Swift shared across all four targets (snapshot, countdown)
│   │   ├── modules/         # Local Expo module: conpaws-widgets (App Group + WatchConnectivity)
│   │   ├── app.config.ts    # Variant-based Expo config
│   │   ├── eas.json         # Preview sideload and production store-build profiles
│   │   ├── metro.config.js
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   ├── web/                 # Next.js site (Cloudflare Workers via OpenNext)
│   └── server/              # (planned — does not exist) Hono/tRPC/Better-Auth Worker
├── packages/
│   ├── config/              # Shared tsconfig base
│   ├── env/                 # Zod env schemas (src/web.ts is used; src/native.ts is not imported)
│   ├── infra/               # alchemy.run.ts — D1, Worker bindings/secrets, cron
│   └── ui/                  # Shared shadcn/ui primitives (web)
├── docs/                    # Widget and Watch design docs, mockups, UX opportunities
├── infra/                   # xprem OTA descriptor and runbook (not deployed)
├── biome.json
├── turbo.json
└── package.json
```

### Key Configuration (apps/native/)

- **app.config.ts** — Dynamic Expo config with variant-based bundle IDs and icons
- **Releases are built locally, not on EAS** (decided 2026-08-27 — EAS Build is paid per build). Xcode Organizer archive for iOS, `./gradlew bundleRelease` for Android, manual upload to both stores. `bun run ship:prep` bumps `BUILD_NUMBER` in `app.config.ts`, prebuilds, and verifies the native projects picked the number up; that constant is the only build counter, on both platforms. Android signing comes from `android.injected.signing.*` in **`~/.gradle/gradle.properties`** pointing at `~/.keystores/conpaws-upload.jks` — the generated `build.gradle` still says `signingConfigs.debug`, and that is fine because AGP's injected properties override it. Verify the signer before every Play upload. Full process: `apps/native/RELEASING.md`.
- **eas.json** — kept but unused by the release path. EAS CLI 22.x, committed-tree guard, `appVersionSource: "local"` and no `autoIncrement`, so an EAS build would read the same `BUILD_NUMBER` rather than a stale remote counter. Its `preview-device` profile is the only easy route to an ad-hoc iOS build; running any profile costs money. Do not add auto-submit.
- **metro.config.js** — `withNativeWind(config)`. No `input` argument is passed; NativeWind resolves `global.css` itself. Metro is also wrapped in `getSentryExpoConfig`.
- **postcss.config.mjs** — plugin is `@tailwindcss/postcss`
- **tsconfig.json** — Extends `expo/tsconfig.base`; path alias `@/*` maps to `./src/*`. `vitest.config.ts` mirrors it.
- **OTA is required for the MVP but remains fail-closed:** the chosen host is one shared MrDemonWolf, Inc. xprem **3.1.1** control plane on Dokploy at `updates.mrdemonwolf.com`, not EAS Update. Do not create a ConPaws-only duplicate. Every product needs an isolated xprem app UUID, signing material, branches/channels, publisher token, and runtime; ConPaws client configuration must use only its record. The runtime MCP at `/mcp` is unavailable until deployment, authenticates dashboard users through OAuth rather than publisher tokens, and can reach multiple apps: list apps and confirm the exact app UUID before any mutation. The hardened descriptor and runbook are in `infra/xprem/`, but no service is deployed and the SDK 57 app still has no `expo-updates`, update URL, runtime version, or channel configuration. Enable staging only after xprem is deployed, then pass physical iOS/Android cold-start, offline-start, and rollback tests before production. See the **OTA Updates** page in Notion.

### Environment Variables

`.env` files are local-dev-only; EAS builds use **EAS Environment Variables** (`eas env:pull` to materialize locally). Workers use `wrangler.jsonc` bindings + `wrangler secret`, never `.env`.

- `EXPO_PUBLIC_SERVER_URL` — API Worker URL. A Zod schema for it exists at `packages/env/src/native.ts`, but **nothing in `apps/native` imports it**, so this variable is currently unvalidated at runtime. Either wire the schema in or delete it; do not describe it as validated.
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` — RevenueCat (optional; premium disabled without them)
- `EXPO_PUBLIC_SENTRY_DSN` — crash reporting (preview/production)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Turnstile widget (public; server verify uses the secret below)

Worker-side waitlist config is read at **deploy time** by `packages/infra/alchemy.run.ts` and bound onto the Workers — it never lives in `process.env` at build time, which is why `packages/env/src/web.ts` deliberately omits it: `TURNSTILE_SECRET_KEY`, `LISTMONK_BASE_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_ID`. `ALCHEMY_PASSWORD` encrypts Alchemy state.

Only `TURNSTILE_SECRET_KEY` and `LISTMONK_API_TOKEN` are real credentials, wrapped in `alchemy.secret(...)`; the other three listmonk values are plain configuration. That is why `.github/workflows/deploy-web.yml` carries them as repository **variables** and only the token as a secret. All four are required together — a partial set fails closed rather than half-opening the waitlist.

Which file supplies those depends on how the Worker is being run, and the three are not interchangeable:

| Running | Reads |
|---|---|
| `bunx opennextjs-cloudflare preview` / `wrangler dev` in `apps/web` | `apps/web/.dev.vars` (gitignored) |
| `bun run deploy` from the repo root (Alchemy) | `packages/infra/.env` and `apps/web/.env`, loaded by dotenv at the top of `alchemy.run.ts` |
| GitHub Actions production deploy | repo secrets and variables — see `.github/workflows/deploy-web.yml` |

Putting the values only in `.dev.vars` and then running `bun run deploy` locally yields unresolved `Config` values, not a useful error.

There is no `preview` script — run the two steps CI runs, from `apps/web`:
`bunx opennextjs-cloudflare build` then `bunx opennextjs-cloudflare preview -- --port 8787`.
The preview does not build for you, so a stale `.open-next/` silently serves the
previous code. **`bun dev:web` is not a substitute for testing the waitlist**: it is
plain `next dev` with no Cloudflare bindings at all, so `getCloudflareContext()`
throws and `/api/waitlist` returns 503 no matter how the ESP is configured. Local
D1 also needs `bun run db:migrate:local` in `apps/web` before the route can insert.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` goes the other way: it is a **build-time client** var, so it has to be present wherever the OpenNext build runs (`apps/web/.env` locally, a repo variable in CI). Without it the widget never renders, the client posts an empty token, and every real signup is rejected.

### App Variants

`APP_VARIANT` controls build configuration:
- `development` — `com.mrdemonwolf.conpaws.dev`, layered `ConPaws-development.icon` with a DEV badge, Expo dev client
- `preview` — `com.mrdemonwolf.conpaws`, the clean `ConPaws.icon` (there is no preview-badged icon; `assets/images/` holds only `ConPaws.icon` and `ConPaws-development.icon`), owner debug tools, TestFlight/Play internal only
- `production` (default) — `com.mrdemonwolf.conpaws`, clean `ConPaws.icon`, no debug tools

Build badges apply only to app/launcher icons. Keep the splash, notification,
favicon, Play Store icon, and production icon unbadged.

Preview and production are two builds of the same store app and cannot be
installed side by side. Never promote a preview build publicly.

### Native MVP Screens

The current routes cover onboarding, the Home, Schedule, and Settings tabs, convention detail, create, edit, and schedule import, plus About, appearance, language, licenses, technology, the UI system gallery, and debug tools. The Schedule tab pools starred events from every saved convention into one day-grouped list; per-convention schedules stay on the convention screen. Put new routes in `apps/native/app/` (top level).

The tab bar uses **`NativeTabs` from `expo-router/unstable-native-tabs`** (`app/(tabs)/_layout.tsx`). That API is still marked unstable upstream, so pin expectations to the installed version and re-check it on every Expo upgrade — but do not "fix" it back to classic JS tabs. The **Technical Blueprint** in Notion remains the source for unfinished MVP and later product scope.

### Database Schema

The local expo-sqlite/Drizzle schema in `apps/native/src/db/` contains `conventions`, `convention_events`, and `offline_queue`, plus versioned bootstrap/migration and repository tests. The planned cloud D1 schema includes `profiles`, `username_blocklist`, `convention_directory`, `shared_conventions`, `shared_events`, and `verification_requests`. Full cloud indexing rationale is in the Technical Blueprint's **Data Model, Auth & Profiles** page in Notion. D1 rules that shape the planned schema: index every queried column (billing counts scanned rows), 100 bound params per query (chunk bulk imports), `db.batch()` is the only transaction primitive, no RLS.

### Schedule Import

ICS files and Sched convention URLs are implemented. The importer handles convention IANA timezones/DST, recurring-event identities, cancellations and re-import reconciliation, simultaneous events, categories, rooms, and content warnings. Keep re-import behavior covered with fixtures in `test-data/` and tests next to the parser, import policy, repositories, and services.

## Planning Notes — moved to Notion (2026-08-26)

**The planning docs are no longer in this repo.** They live under the **ConPaws**
page in Nathanial's Notion, which is now the source of truth:
<https://app.notion.com/p/3c8d61481c7b819d9d25c742524b4dc1>

| Notion page | What's Inside |
|------|--------------|
| Prerelease Site | **Decision record for the live site** — version pins and their expiry conditions, Alchemy deployment, ESP, waitlist, Cloudflare mail, config runbook, and a *Traps* section. Read before touching deploy or DNS |
| OTA Updates | xprem OTA host decision and the pre-production gate checklist |
| App Store Release | Versioning policy, why a preview build can never be submitted, the free-1.0 decision |
| Technical Blueprint | Full blueprint, split into sub-pages — stack, data model, sync, iCal import, engineering practices, roadmap |
| Marketing | Website, social media, YouTube, profitability projections |
| Pitch Deck | Market research — fandom stats, convention data, competitive analysis (Barq), revenue projections |
| Ideas | Future feature brainstorms + pre-launch gap analysis |
| Legal | Privacy Policy and Terms of Service templates + App Store compliance checklist |

They mix implemented decisions with future scope; verify claims against the
current code before changing behavior.

**What this means for a Claude Code session.** You cannot read Notion unless the
Notion connector is attached to this session — it is not attached by default. If
you need the reasoning behind a decision (the D1 constraints, the Next pin, the
OTA gate, the GPLv3 App Store exception), ask Nathanial to paste the relevant
page rather than guessing or re-deriving it. Several of these documents record
traps that cost real time to find, and re-discovering them is expensive.

Anything that describes how the code itself works still belongs in this repo,
next to the code: `apps/native/RELEASING.md`, `infra/xprem/`, and the comments in
`app.config.ts`, `eas.json` and `wrangler.jsonc`.

Test data for iCal import development lives in `test-data/`:
- `test-data/indyfurcon2025.ics` — Real convention data (IndyFurCon 2025)
- `test-data/small-test.ics` — Clean test fixture (10 events, 3-day fictional con)
