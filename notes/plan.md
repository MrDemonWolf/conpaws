# ConPaws - Project Plan

**Tagline:** Navigate, Connect, Enjoy
**Status:** Pre-development planning

---

## TL;DR

A **free, offline-first convention companion app** for the furry community.

- **What:** Browse schedules, track panels, set reminders. Import any con's schedule via iCal.
- **Who:** Furry convention-goers. All ages. Privacy-first.
- **How:** Expo + React Native + SQLite (local) + Cloudflare Workers/D1 (cloud for premium).
- **Money:** Free tier is fully functional. ConPaws+ ($3.99/mo or $24.99/yr) adds cloud sync + social.
- **Killer feature:** Works without WiFi. Con WiFi is terrible. We win there.
- **Target:** MVP for the winter 2026 con season (the original June 2026 target has passed — see Development Phases).
- **Competitor:** Barq added convention schedules (Feb 2026) but needs internet and is 18+ only.

---

## Quick Navigation

| Section | What's There |
|---------|-------------|
| [Platforms](#platforms) | iOS primary, Android secondary, iPad adaptive |
| [Tech Stack](#tech-stack) | Expo, NativeWind, Drizzle, Cloudflare Workers, RevenueCat |
| [Monorepo Structure](#monorepo-structure) | Folder layout, domains, env files |
| [Business Model](#business-model) | Free / Account / ConPaws+ tiers, pricing, promos |
| [Badge System](#badge-system) | Gold paw, verified, developer badges + pride name effects |
| [Screens & Navigation](#screens--navigation) | Onboarding, tabs, all screen mockups |
| [Data Model](#data-model) | SQLite schema (local) + D1 schema (cloud) |
| [Auth Flow](#auth-flow) | Apple/Google OAuth via Better-Auth, RevenueCat linking |
| [Avatar & Username Rules](#avatar--username-rules) | Icons, uploads, naming rules, blocklist |
| [Data & Sync Architecture](#data--sync-architecture) | Two-mode system, offline queue, upgrade/downgrade |
| [Local Database Migrations](#local-database-migrations) | Drizzle migrations on device |
| [iCal Import](#ical-import-core-feature) | Parser, categories, content warnings, iOS features |
| [Data Backup & Export](#data-backup--export) | OS backup, JSON export/import |
| [Crash Reporting](#crash-reporting-sentry) | Sentry setup, what to/not to track |
| [Sharing & Deep Links](#sharing--deep-links) | Universal links, Next.js preview site |
| [Testing Strategy](#testing-strategy) | Vitest, what to test vs skip |
| [CI/CD](#cicd-github-actions--eas-workflows) | GitHub Actions PR checks + EAS Workflows |
| [Localization](#localization) | i18next, English-first, community translations |
| [Component System](#component-system-shadcncn-inspired) | UI components, design tokens |
| [App Config](#app-config--production-readiness-eas) | Expo config, EAS production setup, three variants, SDK upgrade path |
| [Infrastructure](#infrastructure) | Cloudflare (Workers, D1, R2), RevenueCat, Sentry |
| [Development Phases](#development-phases) | Phase 1-5 with checklists |

---

## What Is ConPaws?

A convention companion app for the furry community. Manage your convention schedule, track panels, set reminders for meetups, and optionally share it all with friends.

**Core promise:** Works fully offline with zero login. Pay only when you want cloud sync and social features.

---

## Platforms

| Platform | Priority | Notes |
|----------|----------|-------|
| iOS | Primary | Main development target |
| iPadOS | Primary | Universal iOS app with adaptive layouts for larger screens |
| Android | Secondary | React Native gives us this for free |
| watchOS | Not needed | Live Activities on iPhone show on Apple Watch automatically |
| Web | Maybe | Nice to have the option, not a priority |

### iPad Support

Expo supports iPad natively via `supportsTablet: true` in `app.config.ts`. The app is a universal iOS binary — one build for both iPhone and iPad.

**How we make it look good on iPad:**

- **NativeWind breakpoints** — Tailwind's `md:` and `lg:` prefixes work with NativeWind. Use them to adjust layouts at iPad screen widths (e.g. side-by-side panels instead of stacked, wider cards, multi-column grids)
- **`useWindowDimensions()`** — React Native hook to get screen width, use for layout decisions
- **Split view** — On iPad, convention list on the left + detail on the right (master-detail pattern) instead of push navigation
- **Larger touch targets** — iPad has more space, so cards/buttons can be roomier
- **Multitasking** — Support Slide Over and Split View (Expo handles this if we respond to window size changes)

This doesn't require a separate codebase — just responsive classes in NativeWind. Example:

```tsx
<View className="flex-col md:flex-row md:gap-6">
  {/* Stacked on iPhone, side-by-side on iPad */}
</View>
```

---

## Tech Stack

### Mobile App

| Tool | Purpose |
|------|---------|
| Expo SDK 57 (target — repo is currently on SDK 55) | App framework |
| React Native 0.86 + React 19.2 (SDK 57) | UI runtime |
| Expo Router (SDK-aligned versioning — see note below) | File-based routing (typed routes) |
| NativeWind v5 | Tailwind CSS v4 for React Native |
| Custom UI components | ShadCN/CN-inspired, built with `cn()` (clsx + tailwind-merge) |
| Lucide React Native | Icons |
| expo-sqlite | Local-first database |
| Drizzle ORM | Type-safe ORM for expo-sqlite (mature mobile support, lightweight) |
| AsyncStorage | Key-value storage (settings, flags) |
| TanStack React Query | Server-state fetching + caching for the tRPC API |
| expo-image-manipulator | Avatar resizing/compression before upload |
| expo-image-picker | Photo selection from camera roll |
| i18next + react-i18next | Localization (English primary, i18n-ready for community translations) |
| expo-localization | Device language detection |

**Version notes (read before "fixing" anything):**

- **Expo Router versioning is SDK-aligned.** Router v6 shipped with SDK 54; from SDK 55 onward the Router major matches the SDK (`~55.0.x`, `56.x`, `57.x`). The `expo-router@~55.0.5` pin in `apps/native` is correct — do not "fix" it back to a single-digit major.
- `apps/native/package.json` pins `react: 19.0.0`, but Expo SDK 55 ships React 19.2 — this is a real mismatch to fix (run `npx expo install --fix` or align during the SDK upgrade).
- **Open risk:** Expo Router **Native Tabs is alpha** ("API subject to change") even though it appears in the SDK 55 default template. Adopting it in production means accepting refactor risk on every SDK bump — prefer classic JS tabs until it stabilizes.

### Backend (Cloudflare Workers)

The backend is a Cloudflare Worker (planned as `apps/server`, scaffolded Better-T-Stack style). No VPS, no Docker, no self-hosted services.

| Tool | Purpose |
|------|---------|
| Cloudflare Workers | API runtime (Workers Paid plan, $5/mo floor) |
| Hono | HTTP framework the Worker runs |
| tRPC | Typed API layer, types shared end-to-end with the app |
| Better-Auth (pin >=1.6.x) | Auth — Apple + Google OAuth, sessions |
| Cloudflare D1 | SQLite database (Drizzle ORM — same dialect as the app's local DB) |
| Cloudflare R2 | Avatar & file storage (zero egress fees, served via `cdn.conpaws.com`) |
| Cloudflare KV | Cache (60-second minimum TTL floor) |
| Cloudflare Queues | Background jobs (push fan-out, cleanup) — free tier: 10k ops/day |

**Platform constraints — design around these, they are not optional:**

- **No RLS.** D1 has no row-level security. Every authorization check lives in the Worker/tRPC layer: middleware asserts ownership before any query runs.
- **No interactive transactions.** D1 auto-commits each statement; `db.batch()` is the only transaction primitive. Design writes to be batched or idempotent.
- **100 bound parameters per query.** This bites ORM bulk inserts — chunk them (a 9-column insert fits at most 11 rows per statement).
- **Billing counts scanned rows, not returned rows.** An unindexed D1 query bills every row it scans. Index every column a query filters or joins on, at definition time.
- **Size limits:** 500 MB per database on the free tier (10 GB is paid-tier); 100 columns per table; 2 MB max row.
- **D1 supports FTS5** (plus the JSON extension and math functions) — full-text search needs no external service.
- **Construct Better-Auth per request** via a factory — never a module-level singleton (Workers isolates share module scope across requests).
- **`ctx.waitUntil()`** for background work after the response is sent (webhook side effects, cache warming).

### Payments

| Tool | Purpose |
|------|---------|
| RevenueCat | Subscription management, receipt validation, entitlement checks |
| Entitlement: `conpaws_plus` | Single premium tier |

### Dev Tooling

| Tool | Purpose |
|------|---------|
| TypeScript (strict) | Language |
| bun | Package manager + workspaces (pinned via `packageManager` in root `package.json`) |
| Turborepo | Monorepo task runner — `turbo.json` at root, all root scripts fan out through `turbo` |
| Biome | Lint + format (`bun lint` = `biome check .`; there is no ESLint in this repo) |
| Wrangler | Cloudflare deploys (`apps/web` via OpenNext today; `apps/server` when scaffolded) |
| EAS Build + Submit + Update | Build pipeline, store submission, OTA updates |
| Vitest | Unit testing (planned — no test files exist yet) |
| Sentry (via `@sentry/react-native`) | Crash reporting + error tracking |
| GitHub Actions + EAS Workflows | PR checks (lint + type-check + tests) and build/submit automation |

---

## Monorepo Structure

What exists today vs. what is planned. Anything marked *(planned)* does not exist on disk yet.

```
conpaws/
├── apps/
│   ├── native/                  # Expo React Native app
│   │   ├── app/                 # Expo Router routes — top-level, NOT src/app
│   │   │   ├── _layout.tsx
│   │   │   └── index.tsx
│   │   ├── src/
│   │   │   ├── lib/utils.ts     # cn() helper
│   │   │   ├── global.css       # Tailwind entry point (Metro's NativeWind input)
│   │   │   ├── components/ui/   # (empty — planned component library)
│   │   │   ├── db/              # (empty — planned Drizzle schema + migrations)
│   │   │   ├── contexts/ hooks/ locales/ services/ types/   # (empty — planned)
│   │   │   └── assets/images/
│   │   ├── app.config.ts        # Variant-based Expo config (APP_VARIANT)
│   │   ├── eas.json
│   │   ├── metro.config.js      # withNativeWind(config, { input: "./src/global.css" })
│   │   ├── postcss.config.mjs   # plugins: { tailwindcss: {} }
│   │   └── tsconfig.json        # path alias "@/*" -> "./*"
│   ├── web/                     # Next.js site — Cloudflare Workers via OpenNext
│   │   ├── src/app/             # Marketing/waitlist page + /api/waitlist (Turnstile -> D1 + Brevo)
│   │   ├── open-next.config.ts  # OpenNext adapter config
│   │   └── wrangler.jsonc       # Worker definition + bindings (deploy notes live here as comments)
│   └── server/                  # (planned) Hono + tRPC + Better-Auth Worker with D1/R2/KV/Queues bindings
├── packages/
│   ├── config/                  # Shared tsconfig base
│   ├── env/                     # Zod-validated env schemas (src/native.ts, src/web.ts)
│   └── ui/                      # Shared shadcn/ui primitives + styles (web)
├── biome.json
├── turbo.json
├── bun.lock
└── package.json                 # bun workspaces; every root script fans out through turbo
```

**Local development:** `bun dev` runs everything through Turbo; `bun dev:web` / `bun dev:native` scope to one app. The backend Worker (once scaffolded) runs locally with `wrangler dev`, which emulates D1/R2/KV/Queues on your machine. No Docker anywhere in the stack.

### Domains

| Domain | Purpose |
|--------|---------|
| `conpaws.com` | Marketing site, waitlist, sharing previews, legal pages — `apps/web` Worker (OpenNext) |
| `api.conpaws.com` | API Worker — `apps/server` (Hono + tRPC + Better-Auth) |
| `cdn.conpaws.com` | R2 public bucket custom domain (avatar/file delivery, zero egress) |
| `admin.conpaws.com` | Admin dashboard — user management, convention directory CRUD, badge assignments (Future) |

All domains on Cloudflare for DNS + CDN + DDoS protection. SSL handled automatically. Staging is a separate Worker environment / preview deployment — not a separate server.

### Environment Variables

Two separate systems. Do not mix them up:

**1. App builds — EAS Environment Variables, not `.env` files.**

`.env` files are local-dev-only: remote EAS builders never see them. Every value a build needs lives in **EAS Environment Variables**:

- Scoped per environment: `development`, `preview`, `production` (mapped from build profiles)
- Visibility levels: **plain** (readable anywhere), **sensitive** (hidden in the UI, available to builds), **secret** (never readable after creation)
- **String and file** types — file type carries things like a Play service-account JSON
- `eas env:pull --environment development` writes a local `.env` for dev; that file is the *output* of the system, not the source of truth

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_SERVER_URL` | API Worker URL — validated by `packages/env/src/native.ts` |
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` | RevenueCat SDK keys (sandbox in dev/preview, live in production) |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting (preview + production only) |
| `SENTRY_AUTH_TOKEN` | Secret — source map uploads during EAS builds |

**2. Workers — bindings and secrets, not `.env` files.**

The web and server Workers read configuration from `wrangler.jsonc` bindings (D1, R2, KV, Queues, plain vars) and `wrangler secret put` for anything sensitive. Local `wrangler dev` reads `.dev.vars`. Build-time vs runtime env for `apps/web` is documented in `packages/env/src/web.ts`.

Never commit `.env*` or `.dev.vars` — only `.env.example`.

---

## Business Model

### The Pitch

> "Everything works free, forever, on your device. You only pay when you want your data in the cloud and social features — because that costs us money to run."

### Three Tiers

**1. Free (no account)**
- Full convention management locally
- Add panels, custom events, meetup reminders
- Auto-detect convention end dates
- iCal import (.ics file or Sched URL)
- Zero data leaves the device

**2. Free Account (optional)**
- Sign in with Apple or Google
- Create profile: display name, @username, pronouns, bio, avatar
- Basic profile page visible to others
- Still no cloud sync of convention data

**3. ConPaws+ (paid subscription)**
- Monthly + Yearly via RevenueCat
- Cloud sync: conventions & schedule backed up to the cloud
- Share your convention schedule publicly
- "Next Conventions" showcase on profile
- Gold paw print badge on profile
- Name effects: pride flag gradients on your display name
- Privacy controls: custom/personal items hidden by default when sharing

### Pricing

| Plan | Price | vs Monthly | Savings |
|------|-------|-----------|---------|
| Monthly | $3.99/mo | — | — |
| Yearly | $24.99/yr | $2.08/mo effective | 48% off |

### Convention Season Promo

Run a promotional campaign timed around major furry convention season (May - September). Target the weeks leading up to the biggest cons.

**Promo ideas:**

- **"Con Season Kickoff"** — First month free for new subscribers who sign up within 2 weeks before a major con (Anthrocon, MFF, FWA, BLFC, etc.)
- **"Squad Deal"** — Share a referral code with friends at the con. When 3+ friends from the same con subscribe, everyone gets an extra free month
- **"Early Bird Yearly"** — Launch-window discount on yearly plan ($19.99 for the first year instead of $24.99). Creates urgency and locks in early adopters
- **In-app convention countdown** — "Anthrocon is in 14 days! Upgrade to ConPaws+ to share your schedule with friends" — contextual, not pushy

**Timing calendar (major US furry cons):**

| Convention | Typical Month | Promo Window |
|-----------|---------------|-------------|
| FWA (Furry Weekend Atlanta) | May | Late April |
| Anthrocon | July | Mid June |
| BLFC (Biggest Little Fur Con) | September | Late August |
| MFF (Midwest FurFest) | December | Mid November |
| FC (Further Confusion) | January | Late December |

Push marketing 2-3 weeks before each con. This is when attendees are actively planning their schedules — peak "I need this app" energy.

**RevenueCat supports all of this:**
- Promotional offers can be configured in App Store Connect / Google Play Console
- RevenueCat's Offerings system lets you swap promo pricing without app updates
- Free trial periods are built into the store subscription system

### Why This Model Works

- Zero friction to start using the app (no signup wall)
- Users fall in love with the app locally first
- Social features create natural upgrade pressure ("share your schedule with friends")
- Revenue directly tied to infrastructure costs (honest, transparent)
- Convention season promos convert users when they need the app most

---

## Badge System

Three distinct badges that can appear on user profiles:

### ConPaws+ Badge (Gold Paw Print)

- **Icon:** Lucide `PawPrint` in gold/amber color
- **Who gets it:** Any active ConPaws+ subscriber (automatic via RevenueCat entitlement)
- **Meaning:** "This person supports ConPaws"
- **Removed when:** Subscription expires or is cancelled

### Verified Badge (Blue Checkmark)

- **Icon:** Lucide `BadgeCheck` in blue
- **Who gets it:** Admin-assigned only
- **Meaning:** "This person is a notable community member"
- **Criteria:** Big-name furries — large content creators, well-known artists, popular fursuiters. Must be verified by you.
- **Not for:** Regular users, regardless of how long they've been subscribed

### Developer Badge (Gold Checkmark)

- **Icon:** Lucide `BadgeCheck` with a **gold background** (same icon as verified, different color)
- **Who gets it:** You only (`badge_role = 'developer'`)
- **Meaning:** "This person built ConPaws"
- **Why gold background:** Same recognizable checkmark shape, but the gold instantly signals "this is different from regular verified." Simple, clean, no extra icon needed.

### How They Appear on Profiles

Badges sit inline next to the display name:

```
┌──────────────────────────────────────┐
│  [Avatar]  Luna Starfall 🐾 ✓       │
│            @lunastarfall             │
│            she/her                   │
│                                      │
│  [Avatar]  MrDemonWolf 🐾 ✓(gold)   │
│            @mrdemonwolf              │
│            he/him                    │
└──────────────────────────────────────┘
  🐾 gold paw        = ConPaws+ subscriber
  ✓  blue checkmark  = Verified (notable community member)
  ✓  gold checkmark  = Developer (app creator — same icon, gold background)
```

A user can have multiple badges. Badge display order: Developer > Verified > ConPaws+.

### Name Effects (ConPaws+ Only)

ConPaws+ subscribers can apply a **pride flag gradient** to their display name. The gradient renders across the text wherever their name appears (profile, shared schedules, Find Friends, etc.). Free users see plain text.

**Available flags:**

| Key | Flag | Colors |
|-----|------|--------|
| `rainbow` | Rainbow / LGBTQ+ | Red → Orange → Yellow → Green → Blue → Violet |
| `trans` | Transgender | Light blue → Pink → White → Pink → Light blue |
| `bi` | Bisexual | Pink → Purple → Blue |
| `pan` | Pansexual | Pink → Yellow → Cyan |
| `nonbinary` | Non-Binary | Yellow → White → Purple → Black |
| `lesbian` | Lesbian | Dark orange → White → Pink |
| `ace` | Asexual | Black → Gray → White → Purple |
| `aro` | Aromantic | Green → Light green → White → Gray → Black |
| `genderfluid` | Genderfluid | Pink → White → Purple → Black → Blue |
| `genderqueer` | Genderqueer | Lavender → White → Green |
| `intersex` | Intersex | Yellow with purple circle accent |
| `progress` | Progress Pride | Chevron-inspired multi-color gradient |

**Implementation:**
- `profiles.name_effect` column (nullable TEXT, stores the flag key)
- Gated behind `conpaws_plus` entitlement — setting picker only shown to subscribers
- If subscription expires, effect is preserved in DB but stops rendering (re-subscribe to restore)
- Rendered via `MaskedView` + `LinearGradient` on React Native (or CSS gradient on web)

**How it looks:**
```
┌──────────────────────────────────────┐
│  [Avatar]  L̲u̲n̲a̲ ̲S̲t̲a̲r̲f̲a̲l̲l̲  🐾 ✓      │
│            ^^^^^^^^^^^^              │
│            (rainbow gradient text)   │
│            @lunastarfall             │
│            she/her · bi              │
└──────────────────────────────────────┘
```

This is a great monetization feature because:
- Purely cosmetic (doesn't gate functionality)
- Socially visible (others see it = motivation to subscribe)
- Identity-affirming (huge in the furry community)
- Easy to add more flags over time (flag keys ship in code; the tRPC layer validates them)

### Badge Roles in Database

The `profiles.badge_role` column controls the special badge:

| `badge_role` | Badge | Assigned by |
|---|---|---|
| `user` | None | Default |
| `verified` | Blue checkmark | Admin (you) |
| `developer` | Gold checkmark | Hardcoded (you only) |

The ConPaws+ gold paw is separate — it's driven by `is_premium` (RevenueCat entitlement), not `badge_role`. So the developer can have both the gold checkmark AND the gold paw.

---

## Screens & Navigation

### Onboarding (first launch only)

```
Welcome → Features → Get Started → Complete
```

**Screen 1: Welcome**
```
┌──────────────────────────────┐
│                              │
│                              │
│         [ConPaws Logo]       │
│                              │
│      Navigate, Connect,      │
│           Enjoy.             │
│                              │
│   Your convention companion  │
│                              │
│                              │
│                              │
│       [ Get Started ]        │
│                              │
└──────────────────────────────┘
```

**Screen 2: Features**
```
┌──────────────────────────────┐
│                              │
│   [Calendar Icon]            │
│   Track Your Schedule        │
│   Add conventions, panels,   │
│   and meetups — all offline.  │
│                              │
│   [Share Icon]               │
│   Share With Friends         │
│   Let others see your con    │
│   schedule with ConPaws+.    │
│                              │
│   [Lock Icon]                │
│   Your Data, Your Device     │
│   Everything stays local     │
│   unless you choose to sync. │
│                              │
│         [ Next ]             │
└──────────────────────────────┘
```

**Screen 3: Get Started**
```
┌──────────────────────────────┐
│                              │
│      Create an Account       │
│                              │
│   Sign in to unlock your     │
│   profile and social         │
│   features.                  │
│                              │
│   [  Sign in with Apple  ]   │
│   [  Sign in with Google ]   │
│                              │
│   By signing in you agree    │
│   to our Terms of Service    │
│   and Privacy Policy.        │
│                              │
│         Skip for now         │
│                              │
└──────────────────────────────┘
```

**Screen 4: Complete**
```
┌──────────────────────────────┐
│                              │
│                              │
│         [Checkmark]          │
│                              │
│       You're all set!        │
│                              │
│   Start adding conventions   │
│   and planning your next     │
│   adventure.                 │
│                              │
│                              │
│     [ Let's Go ]             │
│                              │
└──────────────────────────────┘
```

### Main App (tab navigation)

```
┌──────────────────────────────┐
│         [Screen]             │
│                              │
│                              │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Home (Conventions)

```
┌──────────────────────────────┐
│  My Conventions     [Browse][+]│
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ Anthrocon 2026         │  │
│  │ Jul 2 - Jul 5          │  │
│  │ [UPCOMING]             │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ MFF 2025               │  │
│  │ Dec 4 - Dec 7          │  │
│  │ [ENDED]                │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ FWA 2026               │  │
│  │ May 15 - May 18        │  │
│  │ [UPCOMING]             │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Convention Detail

```
┌──────────────────────────────┐
│  [<] Anthrocon 2026          │
├──────────────────────────────┤
│  Jul 2 - Jul 5, 2026        │
│  Status: UPCOMING            │
│  iCal: (none)                │
├──────────────────────────────┤
│  Events                  [+] │
│                              │
│  ┌────────────────────────┐  │
│  │ [PANEL] Opening        │  │
│  │ Ceremony               │  │
│  │ Thu 10:00 - 11:00      │  │
│  │ Main Stage             │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ [CUSTOM] Lunch with    │  │
│  │ @wolfheart             │  │
│  │ Thu 12:30 - 13:30      │  │
│  │ Hotel Lobby            │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ [PANEL] Fursuit Games  │  │
│  │ Thu 14:00 - 16:00      │  │
│  │ Ballroom A             │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Profile (Not Logged In)

```
┌──────────────────────────────┐
│  Profile                     │
├──────────────────────────────┤
│                              │
│                              │
│       [Person Outline]       │
│                              │
│    Create an account to      │
│    set up your profile       │
│    and share your schedule.  │
│                              │
│   [  Sign in with Apple  ]   │
│   [  Sign in with Google ]   │
│                              │
│   By signing in you agree    │
│   to our Terms of Service    │
│   and Privacy Policy.        │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Profile (Free Account)

```
┌──────────────────────────────┐
│  Profile                     │
├──────────────────────────────┤
│                              │
│         [Avatar]             │
│    Luna Starfall             │
│    @lunastarfall             │
│    she/her                   │
│                              │
│    "See you at Anthrocon!"   │
│                              │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ Upgrade to ConPaws+    │  │
│  │ Sync your schedule and │  │
│  │ share it with friends. │  │
│  │                        │  │
│  │   [ Get ConPaws+ ]     │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Profile (ConPaws+ Subscriber)

```
┌──────────────────────────────┐
│  Profile                     │
├──────────────────────────────┤
│                              │
│         [Avatar]             │
│    Luna Starfall  🐾 ✓      │
│    @lunastarfall             │
│    she/her                   │
│                              │
│    "See you at Anthrocon!"   │
│                              │
├──────────────────────────────┤
│  Next Conventions            │
│                              │
│  ┌────────────────────────┐  │
│  │ Anthrocon 2026         │  │
│  │ Jul 2 - Jul 5          │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ BLFC 2026              │  │
│  │ Sep 10 - Sep 13        │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  Shared Schedule             │
│                              │
│  Anthrocon 2026: 12 panels   │
│  BLFC 2026: 8 panels         │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Settings

```
┌──────────────────────────────┐
│  Settings                    │
├──────────────────────────────┤
│                              │
│  ACCOUNT                     │
│  ┌────────────────────────┐  │
│  │ Signed in as            │  │
│  │ @lunastarfall       [>] │  │
│  └────────────────────────┘  │
│                              │
│  SUBSCRIPTION                │
│  ┌────────────────────────┐  │
│  │ ConPaws+            [>] │  │
│  │ Yearly · Renews Jul 1  │  │
│  └────────────────────────┘  │
│                              │
│  APP                         │
│  ┌────────────────────────┐  │
│  │ Reset Onboarding    [>] │  │
│  ├────────────────────────┤  │
│  │ About               [>] │  │
│  └────────────────────────┘  │
│                              │
│  LEGAL                       │
│  ┌────────────────────────┐  │
│  │ Privacy Policy      [>] │  │
│  ├────────────────────────┤  │
│  │ Terms of Service    [>] │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │       Sign Out          │  │
│  └────────────────────────┘  │
│                              │
│  DANGER ZONE                 │
│  ┌────────────────────────┐  │
│  │    Delete Account       │  │
│  │    (red text)           │  │
│  └────────────────────────┘  │
│                              │
├──────────────────────────────┤
│  [Home]  [Profile] [Settings]│
└──────────────────────────────┘
```

#### Paywall (ConPaws+ Upgrade)

```
┌──────────────────────────────┐
│  [X]                         │
│                              │
│         [Gold Paw]           │
│        ConPaws+              │
│                              │
│  Unlock the full experience  │
│                              │
│  * Cloud sync your schedule  │
│  * Share with friends        │
│  * Next Conventions on       │
│    your profile              │
│  * Gold paw badge            │
│  * Pride flag name effects   │
│                              │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ Yearly       $24.99/yr │  │
│  │ BEST VALUE · Save 48%  │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ Monthly      $3.99/mo  │  │
│  └────────────────────────┘  │
│                              │
│     [ Subscribe Now ]        │
│                              │
│  Auto-renews. Cancel any     │
│  time in store settings.     │
│                              │
│     Restore Purchases        │
│                              │
│  Terms · Privacy             │
│                              │
└──────────────────────────────┘
```

#### Subscription Ended (Cancellation)

```
┌──────────────────────────────┐
│                              │
│     Your ConPaws+ has        │
│     ended.                   │
│                              │
│  Here's what's changing:     │
│                              │
│  SAVING TO YOUR DEVICE       │
│  ✓ 3 conventions             │
│  ✓ 27 events                 │
│                              │
│  TURNING OFF                 │
│  · Cloud sync                │
│  · Shared schedule (public)  │
│  · "Next Conventions" on     │
│    your profile              │
│  · Gold paw badge            │
│                              │
│  DELETED IN 30 DAYS          │
│  · Cloud copy of your data   │
│                              │
│  KEEPING FOREVER             │
│  · Your account & profile    │
│  · Everything on this device │
│                              │
│  ┌────────────────────────┐  │
│  │    Download My Data    │  │
│  └────────────────────────┘  │
│                              │
│     Re-subscribe anytime     │
│     to restore cloud sync.   │
│                              │
└──────────────────────────────┘
```

---

## Data Model

### Local Database (expo-sqlite + Drizzle ORM) — Everyone Gets This

```ts
// apps/native/src/db/schema.ts (planned — the db/ directory is empty today)
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// --- Conventions ---

export const conventions = sqliteTable("conventions", {
  id:        text("id").primaryKey(),         // UUID generated in app
  name:      text("name").notNull(),
  startDate: text("start_date").notNull(),    // ISO date
  endDate:   text("end_date").notNull(),      // ISO date
  icalUrl:   text("ical_url"),
  status:    text("status", { enum: ["upcoming", "active", "ended"] }).default("upcoming").notNull(),
  createdAt: text("created_at").notNull(),    // ISO datetime
  updatedAt: text("updated_at").notNull(),    // ISO datetime
  syncedAt:  text("synced_at"),               // null = never synced to cloud
});

// --- Convention Events ---

export const conventionEvents = sqliteTable("convention_events", {
  id:              text("id").primaryKey(),
  conventionId:    text("convention_id").notNull().references(() => conventions.id, { onDelete: "cascade" }),
  title:           text("title").notNull(),
  description:     text("description").default("").notNull(),
  startTime:       text("start_time").notNull(),   // ISO datetime
  endTime:         text("end_time").notNull(),      // ISO datetime
  location:        text("location").default("").notNull(),   // full location string from iCal
  room:            text("room").default("").notNull(),       // parsed room name (e.g. "Panel Room 2")
  category:        text("category").default("").notNull(),   // iCal CATEGORIES value (e.g. "GAMING", "SOCIAL")
  type:            text("type", { enum: ["panel", "custom"] }).default("panel").notNull(),
  isShareable:     integer("is_shareable", { mode: "boolean" }).default(true).notNull(),
  isAgeRestricted: integer("is_age_restricted", { mode: "boolean" }).default(false).notNull(),
  contentWarning:  text("content_warning"),    // e.g. "strobe_lights" — detected from description
  sourceUid:       text("source_uid"),         // iCal UID for dedup on re-import
  sourceUrl:       text("source_url"),         // Sched event URL for "View on Sched"
  isInSchedule:    integer("is_in_schedule", { mode: "boolean" }).default(false).notNull(),
  reminderMinutes: integer("reminder_minutes"),  // null = no reminder, 5/15/30 = minutes before
  createdAt:       text("created_at").notNull(),
  updatedAt:       text("updated_at").notNull(),
});

// --- Offline Write Queue (premium users only, used when offline) ---

export const offlineQueue = sqliteTable("offline_queue", {
  id:        text("id").primaryKey(),
  entity:    text("entity", { enum: ["convention", "event"] }).notNull(),
  entityId:  text("entity_id").notNull(),
  action:    text("action", { enum: ["create", "update", "delete"] }).notNull(),
  payload:   text("payload").notNull(),    // JSON of the full entity data
  createdAt: text("created_at").notNull(),
});
```

### Cloud Database (Cloudflare D1) — Accounts & Premium Users

D1 is SQLite, so the cloud schema uses the **same Drizzle SQLite dialect** as the on-device database — one ORM, one dialect, shared types across app and server.

Two rules are baked into the schema below:

1. **Index every column a query filters or joins on, at definition time.** D1 bills every row a query *scans*, not the rows it returns — an unindexed lookup against a 100k-row table bills 100k reads. Indexes here are a cost control, not just a performance nicety.
2. **There is no RLS.** Nothing in the database protects one user's rows from another. Every tRPC procedure asserts ownership (`where eq(table.userId, ctx.user.id)`) — the Worker is the authorization layer, full stop.

```ts
// apps/server/src/db/schema.ts (planned)
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// Better-Auth owns its own tables (user, session, account, verification),
// generated via the Better-Auth CLI. `profiles` extends its `user` table.

export const profiles = sqliteTable("profiles", {
  id:              text("id").primaryKey(),          // = Better-Auth user.id
  username:        text("username").notNull(),        // 3-20 chars, validated in tRPC (SQLite has no CHECK-by-default culture; Zod owns it)
  displayName:     text("display_name").notNull(),
  bio:             text("bio").default("").notNull(),
  pronouns:        text("pronouns"),
  avatarUrl:       text("avatar_url"),                // custom photo (ConPaws+), R2 via cdn.conpaws.com
  avatarIcon:      text("avatar_icon"),               // built-in animal icon key ('wolf', 'fox', ...)
  avatarColor:     text("avatar_color"),              // initials background hex
  badgeRole:       text("badge_role", { enum: ["user", "verified", "developer"] }).default("user").notNull(),
  nameEffect:      text("name_effect"),               // pride flag key — ConPaws+ only
  isPremium:       integer("is_premium", { mode: "boolean" }).default(false).notNull(),
  verifiedCreator: integer("verified_creator", { mode: "boolean" }).default(false).notNull(),
  createdAt:       text("created_at").notNull(),
  updatedAt:       text("updated_at").notNull(),
}, (t) => [
  uniqueIndex("profiles_username_idx").on(t.username),        // username lookups + uniqueness
]);

export const usernameBlocklist = sqliteTable("username_blocklist", {
  id:      text("id").primaryKey(),
  pattern: text("pattern").notNull(),                 // exact match or regex pattern
}, (t) => [
  uniqueIndex("username_blocklist_pattern_idx").on(t.pattern),
]);

export const conventionDirectory = sqliteTable("convention_directory", {
  id:         text("id").primaryKey(),
  name:       text("name").notNull(),
  startDate:  text("start_date").notNull(),           // ISO date
  endDate:    text("end_date").notNull(),
  location:   text("location"),
  websiteUrl: text("website_url"),
  icalUrl:    text("ical_url"),                       // Sched or other iCal feed URL
  year:       integer("year").notNull(),
  isActive:   integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt:  text("created_at").notNull(),
  updatedAt:  text("updated_at").notNull(),
}, (t) => [
  index("convention_directory_active_year_idx").on(t.isActive, t.year),  // the browse-screen filter
]);

export const sharedConventions = sqliteTable("shared_conventions", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name:      text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate:   text("end_date").notNull(),
  icalUrl:   text("ical_url"),
  updatedAt: text("updated_at").notNull(),            // doubles as the change-polling cursor
  createdAt: text("created_at").notNull(),
}, (t) => [
  index("shared_conventions_user_idx").on(t.userId),                       // every read is owner-scoped
  index("shared_conventions_user_updated_idx").on(t.userId, t.updatedAt), // ?since= polling
]);

export const sharedEvents = sqliteTable("shared_events", {
  id:                 text("id").primaryKey(),
  sharedConventionId: text("shared_convention_id").notNull().references(() => sharedConventions.id, { onDelete: "cascade" }),
  title:              text("title").notNull(),
  description:        text("description"),
  startTime:          text("start_time").notNull(),
  endTime:            text("end_time").notNull(),
  location:           text("location"),
  type:               text("type", { enum: ["panel", "custom"] }).default("panel").notNull(),
  updatedAt:          text("updated_at").notNull(),
  createdAt:          text("created_at").notNull(),
}, (t) => [
  index("shared_events_convention_idx").on(t.sharedConventionId),                        // join/fan-out path
  index("shared_events_convention_updated_idx").on(t.sharedConventionId, t.updatedAt),  // ?since= polling
]);

// Verified-creator applications (blue-check pipeline)
export const verificationRequests = sqliteTable("verification_requests", {
  id:         text("id").primaryKey(),
  userId:     text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  links:      text("links").notNull(),                // JSON array of proof links
  status:     text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reviewedAt: text("reviewed_at"),
  createdAt:  text("created_at").notNull(),
}, (t) => [
  index("verification_requests_user_idx").on(t.userId),
  index("verification_requests_status_idx").on(t.status),  // admin review queue
]);
```

**Why `text({ enum })` instead of database enums?** SQLite (and therefore D1) has no native enum type. Drizzle's `text({ enum: [...] })` enforces values at the TypeScript level on both the local and cloud databases, and the tRPC layer re-validates with Zod at the boundary. Adding a new pride flag is a code change, not a migration.

**Bulk-insert rule:** D1 caps a statement at **100 bound parameters**. A 9-column insert fits at most 11 rows per statement — chunk the upgrade migration accordingly and wrap chunks in `db.batch()`, which is the only transaction primitive D1 offers (no interactive transactions).

**Full-text search:** when user/convention search needs it, D1 supports **FTS5** natively (plus the JSON extension and math functions) — no external search service required.

---

## Auth Flow

Better-Auth runs inside the API Worker; the app uses the `@better-auth/expo` client plugin.

```
1. User taps "Sign In" (profile or settings)
2. App calls the Better-Auth endpoints on api.conpaws.com (Apple or Google OAuth)
3. Worker handles the OAuth redirect + callback, creates/finds the user in D1
4. Session token stored on device (SecureStore via the Expo plugin)
5. tRPC requests carry the session; protectedProcedure middleware resolves ctx.user
6. Every query is ownership-scoped in the Worker — there is no RLS to fall back on
```

**Three Workers-specific rules:**

1. **Construct Better-Auth per request.** A factory (`createAuth(env)`) called inside the fetch handler — never a module-level singleton. Workers isolates share module scope across requests; a singleton leaks env/bindings between them.
2. **Pin `better-auth@>=1.6.x`.** The 2025-era Expo blockers (#4203, #7124, #5452) are all closed as of Jan-May 2026, and the old "disable `cookieCache`" workaround is stale advice. Leave `cookieCache` on — but test session persistence across the cache-expiry boundary on a real device before shipping.
3. **Use `ctx.waitUntil()`** for after-response work (webhook side effects, cache warming) so responses aren't held hostage.

**Open risk (recorded, not resolved):** `@better-auth/expo` compatibility with Expo SDK 55+/New Architecture is **unverified** — no authoritative statement exists either way. Empirically test sign-in, session persistence, and sign-out on a development build *before* the backend work goes deep.

**Key rule:** Account creation is free. Premium features check RevenueCat entitlement status, not just auth status.

**Profile creation:**
- Better-Auth `databaseHooks.user.create.after` inserts the `profiles` row
- User completes profile setup (username, display name, etc.) after first sign-in; the username blocklist check runs in the tRPC procedure

**RevenueCat integration:**
- App checks entitlement `conpaws_plus` via RevenueCat SDK
- RevenueCat webhook → Hono route on the Worker (verify the webhook auth header) → updates `profiles.is_premium`; side effects run via `ctx.waitUntil()`
- This keeps D1 in sync with subscription status
- `Purchases.logIn(userId)` links the RevenueCat customer to the Better-Auth user id
- **No free trial.** Users either subscribe or they don't.
- **Developer bypass:** The app owner (you) always has full premium access without paying. Done via **RevenueCat Promotional Entitlements** — grant yourself the `conpaws_plus` entitlement from the RevenueCat dashboard with a far-future expiry (e.g. December 31, 2030). Your app's existing entitlement check just works — no separate code path, no hardcoded user IDs, no extra logic. Two minutes in the dashboard, zero code changes. Works for beta testers too.

---

## Avatar & Username Rules

### Avatars

Free users get **built-in avatars** (animal icons or 2-letter initials). Custom photo uploads are a **ConPaws+ perk** — saves storage costs since most users won't be premium.

| Tier | Avatar Options |
|------|---------------|
| **No account** | N/A (no profile) |
| **Free account** | 2-letter initials from username OR pick a built-in animal icon |
| **ConPaws+** | All of the above + upload a custom photo |

#### Built-In Animal Icons

Pre-made icons covering the most common furry species. Users pick one during profile setup.

| Category | Species |
|----------|---------|
| **Canines** | Wolf, Fox, Dog, Husky, Coyote |
| **Felines** | Cat, Tiger, Lion, Snow Leopard, Cheetah |
| **Aquatic** | Shark, Otter, Dolphin |
| **Avian** | Bird (generic), Owl, Eagle |
| **Rodents/Small** | Rabbit, Raccoon, Red Panda, Skunk, Mouse |
| **Large** | Bear, Deer, Horse |
| **Reptiles** | Dragon, Lizard, Gecko, Kobold |
| **Exotic/Fandom** | Bat, Hyena, Protogen, Sergal, Dutch Angel Dragon |

Each icon comes in a few color variants (base colors that match common fursona palettes). Stored as bundled assets in the app — no network request needed.

#### 2-Letter Initials Fallback

If no icon is selected, show the first two letters of the username in a colored circle. Default color is derived from username hash for consistency, but users can change the background color.

```
┌──────┐      ┌──────┐      ┌──────┐
│  LU  │      │  MR  │      │  PF  │
│(blue)│      │(red) │      │(teal)│
└──────┘      └──────┘      └──────┘
@lunastarfall @mrdemonwolf  @pixelfox
```

Users can pick from a preset palette of background colors (stored in profile, no extra storage cost).

#### Custom Photo Uploads (ConPaws+ Only)

| Rule | Value |
|------|-------|
| Max file size | 5 MB (before resize) |
| Accepted formats | JPEG, PNG, WebP |
| Output format | JPEG at 0.8 quality (after resize) |
| Output dimensions | 512x512 px (square, 1:1 ratio — crisp at 4x retina) |
| Target output size | <100 KB per avatar |
| Resize library | `expo-image-manipulator` (native Expo, no config plugins) |
| Storage backend | Cloudflare R2 (zero egress fees) |
| Delivery | Direct via `cdn.conpaws.com` (R2 bucket custom domain) |

**Upload flow:** User picks image via `expo-image-picker` (square crop enforced) → `expo-image-manipulator` resizes to 512x512 JPEG at 0.8 quality → upload to R2 via a presigned URL issued by the API Worker → profile updated with the `cdn.conpaws.com` URL.

If subscription expires, the custom photo stays visible (already stored) but they can't upload a new one until they re-subscribe. They can switch back to a built-in icon anytime.

### Usernames

| Rule | Value |
|------|-------|
| Min length | 3 characters |
| Max length | 20 characters |
| Allowed characters | `a-z`, `0-9`, `_` (lowercase alphanumeric + underscores) |
| Case | Stored lowercase, displayed lowercase |
| Uniqueness | Globally unique |
| Change policy | Contact support only (prevent abuse/impersonation) |

### Username Blocklist

A server-side blocklist checked on registration. Blocks:

- **Profanity & slurs** — standard profanity word list
- **Reserved words** — `admin`, `mod`, `moderator`, `conpaws`, `conpawsplus`, `support`, `help`, `official`, `staff`, `system`, `null`, `undefined`, `api`, `www`
- **Impersonation risks** — brand names, convention names (e.g., `anthrocon`, `mff`)
- **Homoglyph protection** — Reject usernames that visually mimic others (e.g., `rn` → `m`)

Blocklist is stored in D1 and checked inside the profile-creation tRPC procedure. Easy to update without app releases.

---

## Data & Sync Architecture

The app runs in two distinct modes depending on subscription status. The key principle: **free users own their data locally, premium users own their data in the cloud.**

There is **no realtime layer** — no WebSockets, no Durable Objects, no server push for data. Sync is **foreground polling + local mirror**, which is cheaper, simpler, and plenty for schedule data that changes a few times a day.

### Two Modes

| | Free | Premium |
|---|---|---|
| **Source of truth** | SQLite (full database) | D1, behind the tRPC API |
| **SQLite role** | Full database | Full local mirror + offline queue |
| **Network** | None (zero data calls) | Foreground polling + mutations |

### Free Mode (Local-Primary)

SQLite is everything. No cloud, no sync, no network calls for data.

- **Reads:** SQLite directly
- **Writes:** SQLite directly
- **Storage:** All conventions + events live on device

### Premium Mode (Cloud-Primary, Polling)

The cloud copy in D1 is the source of truth. The device keeps a full mirror in expo-sqlite and reconciles it by polling for changes.

**Change polling:**

```
GET /api/conventions/:id/changes?since=<cursor>
```

- Polled every **60-120 seconds while the app is foregrounded** — never in the background (battery + Workers request cost)
- `since` is the newest `updated_at` cursor the device has seen; the response contains only rows changed after it — this is exactly why `(user_id, updated_at)` and `(convention_id, updated_at)` are indexed in the D1 schema
- Changed rows are merged into expo-sqlite via Drizzle; screens read the local DB through Drizzle's `useLiveQuery`, so the UI updates automatically when the merge lands
- Also poll once on app foreground and after every queue drain

**Reads:** always from the local mirror (SQLite via `useLiveQuery`). Online or offline, the read path is identical — that's the point.

**Writes (online):**
```
User creates/edits/deletes
  → Write to SQLite immediately (optimistic — useLiveQuery updates the UI)
  → Push through the tRPC mutation
  → Server stamps updated_at; next poll confirms convergence
```

**Writes (offline):**
```
User creates/edits/deletes
  → Write to SQLite immediately
  → Row into offline_queue
  → When back online → drain queue → poll
```

**Push notifications:** server-initiated notices (e.g. "a shared schedule you follow changed") flow: event on the Worker → enqueue to a **Cloudflare Queue** → queue consumer calls the Expo Push API. Queues' free tier (10k ops/day) is far beyond launch-scale needs. Personal event reminders stay 100% local via `expo-notifications` — no server involved.

### Offline Queue Drain

The `offline_queue` table (in local SQLite) holds pending writes made while offline.

**Drain triggers:**
- App returns to foreground
- Network connectivity restored
- After a local write (debounced, ~5 seconds)
- Manual pull-to-refresh

**Drain cycle:**
1. Read all `offline_queue` rows, oldest first
2. Push each through the same tRPC mutations as online writes; bulk payloads are **chunked to respect D1's 100-bound-parameter limit** and applied server-side inside `db.batch()`
3. On success: remove from queue
4. On failure: leave in queue, retry next cycle (3 attempts with backoff, then dead-letter — surface "1 change couldn't sync" to the user)

### Conflict Resolution (Multi-Device)

Since this is single-user data, conflicts are rare. They only happen if the same user edits on two devices while one is offline.

**Strategy: Last-write-wins** using `updatedAt` timestamps.

- Cloud has a newer `updatedAt` than local → cloud wins
- Local has a newer `updatedAt` → local wins
- Deletes always win (if either side deleted it, it's gone)

Simple, predictable, no merge logic needed.

### Upgrade Migration (Free → Premium)

When a user subscribes to ConPaws+:

1. RevenueCat confirms `conpaws_plus` entitlement
2. Read all conventions + events from SQLite
3. Bulk upsert to the API in chunks (≤100 bound params per statement, `db.batch()` per chunk server-side)
4. Confirm everything landed in D1
5. Keep the local data as the mirror and start polling — nothing is deleted from the device

### Downgrade Migration (Premium → Free)

When a subscription expires:

1. App detects entitlement loss on launch/foreground
2. Show the cancellation screen (see below) with a clear summary
3. Run one final poll so the local mirror is current (the device already holds everything)
4. Switch to local-primary mode — stop polling, stop draining
5. Shared schedule goes private immediately
6. Badge removed, premium features gated off
7. **30-day grace period** — cloud data stays in D1
8. After 30 days — a **scheduled Worker (Cron Trigger)** deletes their `shared_conventions` + `shared_events`
9. Account + profile stay forever (free tier)

### Re-subscribe Scenarios

**Within 30 days:** Cloud data still exists. Skip migration, resume polling. Fast and seamless.

**After 30 days:** Cloud data is gone. Same as a fresh upgrade — chunked bulk upsert from the device back into D1.

### Why 30-Day Grace Period

- Covers accidental cancellations and billing hiccups
- Reduces data churn (cancel Monday, re-subscribe Friday)
- Aligns with Apple/Google subscription grace periods
- After 30 days, we're not storing data for free indefinitely

### Sync Hook (Conceptual)

```
useSyncEngine() hook
  ├── watches: RevenueCat entitlement status
  ├── watches: network connectivity (NetInfo) + AppState (foreground)
  ├── on entitlement gained: runUpgradeMigration()
  ├── on entitlement lost: runDowngradeMigration()
  ├── foreground interval (60-120s): pollChanges(sinceCursor)
  ├── on app foreground / network restored / local write (debounced):
  │     drainQueue() then pollChanges()
  └── drainQueue():
       ├── if !premium || !online → return
       ├── read offline_queue rows (oldest first)
       ├── push each through the tRPC mutation (chunked)
       ├── on success: delete queue row
       └── on error: retry next cycle (3x, then dead-letter)
```

---

## Local Database Migrations

When the app updates and the local SQLite schema needs to change, migrations must run on the user's device at app launch.

### Strategy: Drizzle ORM Migrations

Drizzle ORM has mature React Native / expo-sqlite migration support. Migrations are generated as SQL files and bundled into the app binary.

**How it works:**

1. During development: `npx drizzle-kit generate` creates SQL migration files from schema changes
2. Migration SQL files are bundled into the app via babel `inline-import` plugin
3. On app launch: `migrate(db, migrations)` runs any unapplied migrations with automatic transaction wrapping
4. Drizzle tracks applied migrations in a `__drizzle_migrations` table
5. App renders only after migrations complete (show splash screen while migrating)

**Safety rules:**

- Always use **additive migrations** (add columns, add tables) — never remove or rename columns in a migration
- New columns must be **nullable** or have **default values** — existing rows need to survive the migration
- Each migration runs inside a **transaction** — if it fails, it rolls back cleanly
- Test all migration paths: fresh install (all migrations) + upgrade from every previous version
- If a migration fails, the app shows an error screen with a "Contact Support" option

---

## iCal Import (Core Feature)

Most furry conventions publish their schedule via **Sched.com**, which provides a public iCal (.ics) feed. This means ConPaws can import any convention's schedule **without needing a partnership** — the data is already public.

### Why This Matters

- Barq needs convention partnerships to get schedule data
- ConPaws just imports the public iCal feed that already exists
- Works for ANY convention that uses Sched (most of them)
- Users can also import any .ics file manually (Google Calendar export, custom schedule, etc.)

### Real-World iCal Data Structure

Based on real convention data (IndyFurCon 2025 via Sched.com):

```
VEVENT fields → ConPaws mapping:

SUMMARY        → event title ("Opening Ceremonies")
DESCRIPTION    → event description (HTML entities, \n line breaks)
DTSTART/DTEND  → start/end time (UTC, format: 20250815T220000Z)
LOCATION       → room + venue ("Panel Room 2, Wyndham Indianapolis Airport")
CATEGORIES     → event category (see category mapping below)
UID            → unique ID (for dedup on re-import)
URL            → Sched event link (optional, for "View on Sched" button)
```

### Categories Are Dynamic

Every convention defines its own categories. IndyFurCon uses "GAMING", "FURSUITING", etc. Another con might use "Panels", "Workshops", "Dances", or something completely different. **We do NOT hardcode a category list.**

**How it works:**
1. Parser reads the `CATEGORIES` field from each VEVENT (raw string)
2. On import, collect all unique categories found in the iCal file
3. Store the raw category string on each event
4. Auto-assign a color to each unique category (rotating palette, deterministic based on category name hash)
5. Default icon: `Calendar` for all — users can customize per category later (future feature)

**Import preview shows discovered categories:**
```
Found 12 categories:
  ● CONVENTION SERVICES (18 events)
  ● GAMING (24 events)
  ● FURSUITING (3 events)
  ● MUSIC & DANCE (12 events)
  ...
```

**Filtering:** The schedule view has a category filter dropdown populated from whatever categories exist in the imported data. No hardcoded list.

### Import Flow

```
User taps "Add Convention" → "Import from iCal"
  ├── Option A: "Import .ics File"
  │   └── System file picker → select .ics file → parse → preview
  ├── Option B: "Paste Sched URL"
  │   └── Text input → extract iCal URL → fetch → parse → preview
  └── Option C: "Browse Convention Directory" (Phase 2, requires the backend)
      └── Select con → auto-import if ical_url exists

Preview Screen:
┌──────────────────────────────┐
│  Import: IndyFurCon 2025     │
│  Aug 14-17, 2025             │
│  127 events found            │
├──────────────────────────────┤
│  Categories:                 │
│  ☑ Convention Services (18)  │
│  ☑ Gaming (24)               │
│  ☑ Entertainment (15)        │
│  ☑ Meet & Greet (22)         │
│  ☑ Music & Dance (12)        │
│  ☑ Arts & Crafts (8)         │
│  ☑ Performance (7)           │
│  ...                         │
├──────────────────────────────┤
│  [Import All]  [Import Selected] │
└──────────────────────────────┘
```

### Parser Requirements

**Input handling:**
- Accept `.ics` file content (string)
- Handle multi-day `VCALENDAR` with many `VEVENT` blocks
- Parse iCal date formats: `YYYYMMDDTHHMMSSZ` (UTC) and `YYYYMMDD` (all-day)
- Decode escaped characters: `\n` → newline, `\,` → comma, `&nbsp;` → space
- Strip HTML entities from DESCRIPTION (`&amp;`, `&lt;`, `&gt;`, `&nbsp;`)
- Handle multi-line field values (iCal line folding: lines starting with space are continuations)

**Location parsing:**
- Split on last comma: `"Panel Room 2, Wyndham Indianapolis Airport"` → room: `"Panel Room 2"`, venue: `"Wyndham Indianapolis Airport"`
- Store both full location string and parsed room name (room is more useful in-app)

**Sched URL extraction:**
- Input: `https://indyfurcon2025.sched.com`
- Extract calendar name from subdomain
- Construct iCal URL: `https://indyfurcon2025.sched.com/all.ics`
- Fetch and parse

**Deduplication:**
- Use `UID` field to detect duplicate events on re-import
- On re-import: update changed events, add new ones, optionally remove deleted ones
- Show diff summary: "12 updated, 3 new, 2 removed"

### Content Warnings Detection

Some events contain warnings in their descriptions. The parser should flag these:
- "18+" or "ID required" → mark as `ageRestricted: true`
- "strobe effects" / "flashing lights" / "epilepsy" → add `contentWarning: "strobe_lights"`
- "NSFW" / "after dark" / "adults only" → mark as `ageRestricted: true`

These flags help users filter their schedule view (e.g., hide 18+ events, show warnings for photosensitive content).

### iOS Features Integration

Since ConPaws is offline-first and deeply integrated with iOS:

**Live Activities + Dynamic Island:**
- Show current/next event from personal schedule
- Countdown timer to next event
- Event name, room, and time
- Auto-updates as events pass throughout the day
- Shows on Apple Watch Smart Stack automatically (no watchOS app needed)

**Reminders:**
- User sets reminder per event (5 min, 15 min, 30 min before)
- Local notifications via `expo-notifications`
- Works offline — no server needed
- Notification shows: event name, time, room

**Widgets (Future — see ideas.md):**
- "Next Up" widget showing upcoming events
- "Today's Schedule" widget with day overview

### Tech Stack for iCal

| Concern | Solution |
|---------|----------|
| iCal parsing | `ical.js` (lightweight, well-maintained) or custom parser (iCal format is simple enough) |
| File picking | `expo-document-picker` (select .ics files) |
| URL fetching | `fetch()` with timeout (Sched URLs are public) |
| Date handling | `date-fns` (already in stack for formatting) |
| Local storage | Parsed events → SQLite via Drizzle ORM |

### Example: Sched URL → Events

```
Input:  https://indyfurcon2025.sched.com
Step 1: Fetch https://indyfurcon2025.sched.com/all.ics
Step 2: Parse VCALENDAR → extract VEVENT blocks
Step 3: Map each VEVENT to ConventionEvent:
        {
          title: "Opening Ceremonies",
          description: "You arrive at the city of Indyfurnapolis...",
          startTime: "2025-08-14T23:00:00.000Z",
          endTime: "2025-08-15T00:00:00.000Z",
          location: "Secondary Events - Golden Ballrooms 4&5",
          category: "CONVENTION SERVICES",
          sourceUid: "84f880539400c2bae31963c9f98f897e",
          sourceUrl: "http://indyfurcon2025.sched.com/event/84f880..."
        }
Step 4: Insert into local SQLite
Step 5: User sees full convention schedule, ready to build personal schedule
```

---

## Data Backup & Export

### OS Auto Backup (Zero Code)

Both platforms automatically back up app data (including SQLite databases) to the cloud. This means if a user gets a new phone and restores from backup, their ConPaws data comes along — no extra work from us.

| Platform | Backup Service | How It Works |
|----------|---------------|--------------|
| **iOS** | iCloud Backup | Automatic when device backs up to iCloud. SQLite DB included. |
| **Android** | Auto Backup (Google Drive) | Automatic on Android 6.0+. SQLite DB included. Enabled by default. |

This covers the most common "new phone" scenario. We don't need to build custom iCloud or Google Drive sync.

### JSON Export / Import (GDPR + Manual Transfer)

For GDPR compliance and manual data transfers (e.g. fresh device setup without restoring from backup).

**Export** — Settings → "Export My Data"

1. App serializes all SQLite data (conventions + events + settings) to a `.json` file
2. System share sheet opens — user can save to Files, AirDrop, email, etc.
3. Satisfies GDPR Article 20 (right to data portability)

**Import** — Settings → "Import Data"

1. `expo-document-picker` opens — user selects a `.json` file
2. App validates the file structure
3. Confirmation: "This will add X conventions and Y events. Duplicates will be skipped."
4. Data merged into SQLite (skip duplicates by ID)

### When Each Applies

| Scenario | How it's handled |
|----------|-----------------|
| New phone, restored from backup | Automatic — OS handles it (both platforms, zero code) |
| New phone, fresh setup (no restore) | JSON export/import |
| Two devices at the same time | ConPaws+ (premium cloud sync) |
| GDPR data export request | JSON export |

---

## Crash Reporting (Sentry)

Use `@sentry/react-native` for crash reporting and error tracking. Sentry's free tier (5K errors/month) is more than enough for launch.

### What to Track

- **Crashes:** Unhandled exceptions, native crashes
- **Migration failures:** If `$applyPendingMigrations()` fails, report the error with the migration name
- **Sync failures:** If the offline queue drain fails repeatedly
- **API errors:** tRPC/Worker request failures (not individual 404s, just patterns)

### What NOT to Track

- No PII (no usernames, emails, or profile data in error reports)
- No analytics events (we don't track usage)
- No breadcrumbs that reveal convention names or personal schedule data

### Setup

- Add `@sentry/react-native` Expo plugin to `app.config.ts`
- Configure DSN per environment (no Sentry in development, staging + production only)
- Source maps uploaded automatically via EAS Build hooks

```
SENTRY_DSN=https://xxx@sentry.io/yyy          # .env.preview + .env.production
SENTRY_AUTH_TOKEN=sntrys_xxx                   # EAS secret (for source map uploads)
```

---

## Sharing & Deep Links

Public URLs for profiles and conventions, with universal links that open the app if installed and show a web preview if not.

### URL Structure

| URL | Opens | Example |
|-----|-------|---------|
| `conpaws.com/@username` | User profile | `conpaws.com/@lunastarfall` |
| `conpaws.com/con/anthrocon-2026` | Convention page | `conpaws.com/con/mff-2025` |
| `conpaws://profile/lunastarfall` | App deep link (profile) | — |
| `conpaws://convention/abc123` | App deep link (convention) | — |

### How It Works

```
User shares: conpaws.com/@lunastarfall

├─ Recipient has app installed
│   → Universal link opens app directly
│   → App navigates to profile screen
│
└─ Recipient does NOT have app
    → Next.js preview page renders with:
       ├─ Profile info (name, avatar, bio)
       ├─ Open Graph tags (for social sharing cards)
       └─ Smart banner: "Open in ConPaws" / "Get ConPaws"
```

### Implementation: Next.js on Cloudflare Workers (OpenNext)

The **Next.js** app in `apps/web` handles the web preview pages, marketing/waitlist site, and legal pages. It deploys to **Cloudflare Workers via OpenNext** — same platform as the API, no server to manage.

**Why Next.js on Workers:**

| Approach | Verdict |
|----------|---------|
| WordPress (SeedProd landing page) | Being retired — a separate system to manage |
| Astro | Lightweight but can't share React components or types with the mobile app |
| Branch.io | Expensive, adds tracking, vendor lock-in |
| **Next.js via OpenNext on Workers** | Same React/TypeScript stack, shares `packages/ui` + types, SSR for OG tags, zero-server infra |

**How it works:**

1. `apps/web` runs Next.js **16.2.12 — pinned exactly.** Next 16.3 + OpenNext has an unbounded prefetch loop (opennextjs-cloudflare#1334); the pin is a workaround, not a suggestion. Do not bump Next until that issue is resolved upstream.
2. `@opennextjs/cloudflare` (1.20.2) adapts the Next build into a Worker; `open-next.config.ts` + `wrangler.jsonc` define the Worker and its bindings — deploy steps live as comments in those files
3. Dynamic routes (`/[username]/page.tsx`, `/con/[slug]/page.tsx`) fetch from the API Worker at request time (SSR) and render Open Graph meta tags for social sharing cards
4. `/api/waitlist` powers the pre-release waitlist: Turnstile verification, subscriber stored in **Cloudflare D1** (source of truth), mirrored to **Brevo** (the ESP)
5. `<meta name="apple-itunes-app">` shows the App Store smart banner
6. `.well-known/apple-app-site-association` + `assetlinks.json` served from `public/` for universal links
7. Also serves: marketing homepage, `/privacy`, `/terms`
8. Deploy: `opennextjs-cloudflare build` → `wrangler deploy`

**Cost:** covered by the $5/mo Workers Paid plan (shared with the API Worker)

### Universal Links Setup

**iOS (`apple-app-site-association`):**
- Hosted at `conpaws.com/.well-known/apple-app-site-association`
- Contains Apple Team ID + bundle identifier
- Add `ios.associatedDomains: ["applinks:conpaws.com"]` to `app.config.ts`

**Android (`assetlinks.json`):**
- Hosted at `conpaws.com/.well-known/assetlinks.json`
- Contains package name + SHA-256 certificate fingerprints
- Add `android.intentFilters` with `autoVerify: true` to `app.config.ts`

**Expo app config additions:**

```ts
// In app.config.ts
ios: {
  // ...existing config
  associatedDomains: ["applinks:conpaws.com"],
},
android: {
  // ...existing config
  intentFilters: [{
    action: "VIEW",
    autoVerify: true,
    data: [{ scheme: "https", host: "conpaws.com", pathPrefix: "/@" }],
    category: ["BROWSABLE", "DEFAULT"]
  }, {
    action: "VIEW",
    autoVerify: true,
    data: [{ scheme: "https", host: "conpaws.com", pathPrefix: "/con/" }],
    category: ["BROWSABLE", "DEFAULT"]
  }],
},
```

---

## Testing Strategy

Focus on testing business logic, not UI. No E2E testing — keep it simple for a solo developer.

### What to Test

| Category | What | How |
|----------|------|-----|
| **Database operations** | Convention/event CRUD, migration paths | Unit tests with in-memory SQLite |
| **Sync engine** | Offline queue drain, change-poll merge, upgrade/downgrade migration | Unit tests with a mocked tRPC client |
| **iCal parser** | Parsing .ics files, extracting events from Sched URLs | Unit tests with fixture files |
| **Username validation** | Blocklist check, character rules, length limits | Unit tests |
| **Data export** | JSON export format, completeness | Unit tests |
| **Utility functions** | `cn()`, date formatting, status detection | Unit tests |

### What NOT to Test

- UI rendering (too brittle, changes often)
- Navigation flows (trust Expo Router)
- Third-party SDK behavior (RevenueCat, Better-Auth)
- Visual appearance (manual QA is faster)

### Tooling

- **Vitest** — Fast, TypeScript-native test runner (works well with Expo projects)
- Test files live next to source: `foo.ts` → `foo.test.ts`
- Run with `bun test`
- **Status: planned.** No test files or `vitest.config.ts` exist yet — the Vitest setup is a Phase 1 task.

---

## CI/CD (GitHub Actions + EAS Workflows)

Two pipelines: GitHub Actions for PR checks, EAS Workflows for app builds + store submission.

### PR Checks (GitHub Actions)

CI runs **from the repo root and fans out through Turborepo** — no per-app `working-directory`. bun is pinned (1.3.10) to match the root `packageManager` field.

Every pull request runs:

1. **Lint** — `bun lint` (Biome — `biome check .`)
2. **Type check** — `bun check-types` (Turbo → per-package `tsc`)
3. **Tests** — `bun test` (Turbo → Vitest, once tests exist)
4. **Expo doctor** — `npx expo-doctor` in `apps/native` (catches dependency/SDK mismatches before they cost a build)

```yaml
# .github/workflows/ci.yml (intended shape)
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.10
      - run: bun install --frozen-lockfile
      - run: bun lint
      - run: bun check-types
      - run: bun test
      - run: cd apps/native && npx expo-doctor
```

### App Builds & Store Submission (EAS Workflows)

Build + submit automation lives in **`.eas/workflows/*.yml`** (EAS Workflows), not GitHub Actions. EAS Workflows have first-party job types for `build`, `testflight`, and `submit`, plus fingerprint-aware jobs that skip native rebuilds when only JS changed.

```yaml
# .eas/workflows/release.yml (planned)
name: Release
on:
  push:
    branches: [main]
jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: production
  submit_ios:
    needs: [build_ios]
    type: submit
    params:
      platform: ios
      build_id: ${{ needs.build_ios.outputs.build_id }}
```

### What CI Does NOT Do

- No EAS builds inside GitHub Actions — EAS Workflows own that path
- Web deploys go through OpenNext + Wrangler for `apps/web`, separate from PR checks
- No Sentry release creation (handled by EAS Build hooks)

---

## Localization

English is the primary (and only) language at launch. The app is **i18n-ready** so translations can be added later via community contributions.

### Approach

- Use `expo-localization` to detect device language
- Use `i18next` + `react-i18next` for string management
- All user-facing strings in `src/locales/en.json` (English)
- Components use `useTranslation()` hook instead of hardcoded strings

### Adding Translations

Community contributors can submit PRs with new locale files:

1. Copy `src/locales/en.json` to `src/locales/[lang].json`
2. Translate all strings
3. Submit PR — CI runs lint + type-check to validate JSON structure
4. Maintainer reviews and merges

### Launch Plan

- Phase 1-4: English only, but all strings go through `i18next` from day one
- Phase 5+: Accept community PRs for Spanish, German, Portuguese, Japanese (largest furry communities outside English)

No machine translation — community translations only, to keep quality high.

---

## Component System (ShadCN/CN-Inspired)

All custom components live in `src/components/ui/`. Built with NativeWind (Tailwind CSS v4) and the `cn()` pattern from ShadCN.

### Utility

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Core UI Components

| Component | Variants / Notes |
|-----------|-----------------|
| Button | default, secondary, outline, ghost, destructive / sizes: sm, md, lg |
| Card | CardHeader, CardContent, CardFooter (composable) |
| Input | With label, error state, helper text |
| Avatar | Image with fallback initials |
| Badge | default, conpaws-plus (gold paw), verified (blue check), developer (gold check), status |
| Switch | Toggle control |
| Separator | Horizontal/vertical divider |
| Text | Typography scale variants (h1, h2, body, caption, etc.) |

### App-Specific Components

| Component | Purpose |
|-----------|---------|
| ConventionCard | Convention list item (name, dates, status badge) |
| EventItem | Event row in convention detail (panel/custom type indicator) |
| ProfileHeader | Avatar + name + username + badges (gold paw, blue check) |
| PaywallPrompt | "Upgrade to ConPaws+" CTA card |
| OnboardingSlide | Reusable onboarding page template |
| EmptyState | Placeholder for empty lists |

### Design Tokens (NativeWind / Tailwind CSS v4)

Theme defined in `global.css` using CSS custom properties, consumed by NativeWind:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --primary: 210 100% 50%;
    --primary-foreground: 0 0% 100%;
    --gold: 45 93% 47%;           /* ConPaws+ paw + Developer checkmark */
    --verified: 210 100% 50%;     /* Verified badge (blue check) */
    /* ... semantic tokens for card, muted, destructive, border, etc. */
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --primary: 210 100% 60%;
    --primary-foreground: 0 0% 100%;
    --gold: 45 93% 58%;
    --verified: 210 100% 60%;
    /* ... dark mode overrides */
  }
}
```

Light + dark mode support. Primary color TBD (match logo).

---

## App Config & Production Readiness (EAS)

The app config is code, not docs: **`apps/native/app.config.ts` is the source of truth.** It is variant-driven (`APP_VARIANT` = `development` / `preview` / `production`) with per-variant bundle IDs (`com.mrdemonwolf.conpaws`, `.preview`, `.dev`), names, and icons; scheme `conpaws` for deep links; `supportsTablet` for iPad. This section documents the production decisions layered on top of it.

### Versioning: remote source + auto-increment

`apps/native/eas.json` already sets:

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": { "production": { "autoIncrement": true } }
}
```

- With `appVersionSource: "remote"`, EAS owns `buildNumber`/`versionCode` — any values in `app.config.ts` are **ignored**. Never hand-bump them.
- `autoIncrement: true` on the production profile bumps the store-facing build number on every production build.

### EAS Environment Variables (not `.env`)

`.env` files are invisible to remote EAS builders — they are local-dev-only. Every value a build needs lives in **EAS Environment Variables**: scoped per environment (development/preview/production), with **plain / sensitive / secret** visibility and **string / file** types (file type carries the Play service-account JSON and similar). `eas env:pull --environment <env>` materializes a local `.env` for development. See the Environment Variables section under Monorepo Structure for the variable list.

### EAS Update: fingerprint runtime policy

```ts
// app.config.ts
updates: { /* ... */ },
runtimeVersion: { policy: "fingerprint" },
```

Use the **`fingerprint`** policy, not `appVersion`. Fingerprint hashes the native container, so an OTA update can never land on an incompatible binary — it is the only policy that cannot be defeated by forgetting to bump a version after a native dependency change. Update channels map 1:1 to build profiles (`development` / `preview` / `production`). Note: on SDK 55, `eas update` requires an explicit `--environment` flag.

### EAS Submit

- **iOS:** `submit.production.ios` needs the real `ascAppId`; authenticate with an **App Store Connect API Key** configured via `eas credentials` (no Apple ID password in automation).
- **Android:** a Google Play **service-account JSON** (stored as an EAS file-type secret). The **first submission always lands on the internal track**, and Play requires the very first AAB of a new app to go through the Console UI regardless.
- **Do upload #1 manually on both stores** to de-risk the pipeline; automate from upload #2 onward.
- **Known issue:** the current `apps/native/eas.json` submit block still contains invalid placeholders (`your-apple-id@example.com`, `your-asc-app-id`, `your-team-id`). Tracked as **CON-35** (owned by another branch) — do not run a submit through it until that lands.

### Release build hardening (`expo-build-properties`)

```ts
// app.config.ts plugins
["expo-build-properties", {
  android: {
    enableMinifyInReleaseBuilds: true,     // R8 — the modern shrinker, not legacy ProGuard
    enablePngCrunchInReleaseBuilds: true,
  },
}]
```

Plus `npx expo-doctor` in CI (see CI/CD) to catch dependency/config drift before it costs a cloud build.

### SDK Upgrade Path: 55 → 56 → 57

The repo is on SDK 55; the target is **SDK 57** (current since Jun 30 2026 — RN 0.86, React 19.2). Upgrade one major at a time, running `npx expo install --fix` and `npx expo-doctor` after each hop.

**Before starting:** `grep -r "@react-navigation" apps/native` — SDK 56's Expo Router decoupled from React Navigation, so any direct `@react-navigation/*` usage must migrate. The codemod:

```bash
npx expo-codemod sdk-56-expo-router-react-navigation-replace
```

**55 → 56:**
- **Hermes v1 becomes the default.** On SDK 55 it is opt-in *and requires building Hermes from source* — explicitly not recommended in monorepos, so do not chase it early. Getting Hermes v1 for free is the concrete argument for this upgrade.
- Expo Router version follows the SDK (56.x).

**56 → 57:**
- `expo prebuild` now **clears `ios/` and `android/` by default** (pass `--no-clean` for the old incremental behavior). Harmless under CNG with gitignored native dirs, but any script assuming incremental prebuild will notice.
- RN 0.86 / React 19.2 — this hop also retires the current `react: 19.0.0` pin mismatch.

### Build Strategy

| Profile | Built where | Why |
|---------|------------|-----|
| `development` | **Local** (`eas build --local`) | Fast iteration, no build credits used |
| `preview` | **Local** (`eas build --local`) | TestFlight/internal testing, no build credits used |
| `production` | **EAS Cloud** (via EAS Workflows) | Store submission; `autoIncrement` handles version bumps |

Run locally: `eas build --profile development --local` or `eas build --profile preview --local`
Production: EAS Workflows (`.eas/workflows/*.yml`) run build → submit — see CI/CD.

This keeps the project on the EAS free plan — only production store builds use cloud credits.

### Why Three Variants

All three can be installed on the same device simultaneously (different bundle IDs):

- **Development** (`conpaws.dev`) — local API Worker (`wrangler dev`), sandbox RevenueCat, debug tools
- **Preview** (`conpaws.preview`) — staging Worker environment, TestFlight/internal builds
- **Production** (`conpaws`) — `api.conpaws.com`, App Store release

---

## Infrastructure

Everything server-side runs on Cloudflare. No VPS, no Docker, no self-hosted services.

| Service | Where | Notes |
|---------|-------|-------|
| API (`apps/server`, planned) | Cloudflare Workers | Hono + tRPC + Better-Auth |
| Database | Cloudflare D1 | SQLite; 500 MB/database on free tier, 10 GB on paid; billed per **scanned** row — index every queried column |
| File storage | Cloudflare R2 | Avatars on `cdn.conpaws.com` (bucket custom domain), zero egress fees |
| Cache | Cloudflare KV | 60-second minimum TTL floor — not for sub-minute freshness |
| Background jobs | Cloudflare Queues | Push fan-out, deletion jobs; free tier 10k ops/day |
| Scheduled jobs | Workers Cron Triggers | 30-day grace-period cleanup |
| Website | Cloudflare Workers (OpenNext) | `apps/web` — marketing, waitlist (D1 + Brevo), sharing previews, universal links, legal pages |
| Admin dashboard | Cloudflare Workers (Future) | `admin.conpaws.com` — user management, directory CRUD, badges, verification queue |
| RevenueCat | Cloud (their servers) | Subscription management, no self-host option |
| Sentry | Cloud (their servers) | Crash reporting + error tracking (free tier: 5K errors/month) |

**Cost model:** the **$5/mo Workers Paid plan** is the infrastructure floor. It covers the API Worker, the web Worker, paid-tier D1 limits, and baseline R2/KV/Queues usage. RevenueCat and Sentry ride their free tiers at launch scale.

**Local development:** `wrangler dev` emulates Workers, D1, R2, KV, and Queues on the dev machine (Miniflare). No Docker anywhere in the stack.

### Storage (Cloudflare R2)

The API Worker talks to R2 through its binding; uploads happen via presigned URLs so avatar bytes never pass through the Worker.

**Why R2:**
- Zero egress fees (serving avatars costs nothing)
- Native Workers binding (no SDK keys in app code)
- Cloudflare CDN built in (fast delivery worldwide)

**Direct access via `cdn.conpaws.com`:** the R2 bucket has a custom domain, so avatar URLs point straight at R2 — no proxy in front, no server bandwidth consumed.

---

## Marketing & Monetization Strategy

### Positioning

- "The convention companion app built by the community, for the community"
- Local-first = privacy-respecting (big deal in furry community)
- No ads, no data selling, no tracking
- Pay only for what costs money to run (transparent, honest)

### Target Audience

1. **Primary:** Furry convention attendees (people who go to 1+ cons per year)
2. **Secondary:** Convention staff/organizers (future: official partnerships?)
3. **Tertiary:** Anyone attending conventions (anime, gaming, etc. — future expansion?)

### Acquisition Funnel

```
Discover → Download → Use Free → Love It → Create Account → Hit Social Limit → Subscribe
```

The tagline maps to this:
- **Navigate** = Free tier (manage conventions locally)
- **Connect** = Account tier (create profile)
- **Enjoy** = ConPaws+ (share, sync, social features)

### Growth Channels

- Beta testers (already have them — leverage for launch reviews)
- Word of mouth at conventions (attendees showing the app to friends)
- Furry Twitter/X, Bluesky, Telegram groups, Discord servers
- Convention partnerships (featured app? Booth presence?)
- App Store Optimization (ASO): keywords around convention planning
- Convention-season marketing pushes (before big cons like Anthrocon, MFF, FWA, etc.)

### Retention

- Local-first means the app is always useful even without internet
- Convention reminders keep users coming back
- Social features create network effects (friends use it → you use it)
- Yearly subscription discount encourages long-term commitment

### Pricing Psychology

- Monthly ($3.99): "Try it for one convention" — under the $5 psychological barrier, low commitment
- Yearly ($24.99): "I go to multiple cons" — saves 48% vs monthly, under the $25 impulse threshold
- Marketing line: "Less than the cost of one convention badge"
- Convention season promos create urgency at the exact moment users need the app most

---

## Legal (Privacy Policy & Terms of Service)

Both are **required** by Apple App Store and Google Play Store before submission. They must be hosted on a public URL and linked from the app + store listings.

### Privacy Policy

Must cover:

| Topic | What to disclose |
|-------|-----------------|
| **Data collected (free, no account)** | Nothing. All data stays on device. No analytics, no tracking, no ads. |
| **Data collected (free account)** | Email (via Apple/Google OAuth), display name, username, pronouns, bio, avatar |
| **Data collected (ConPaws+)** | Same as above + convention schedules synced to cloud |
| **Third-party services** | Cloudflare (Workers API, D1 database, R2 file storage), RevenueCat (subscriptions), Apple/Google (OAuth + payments) |
| **Data storage** | Cloudflare D1 (database) and R2 (avatars), under our Cloudflare account |
| **Data sharing** | No data sold, no ads, no third-party analytics. Shared schedules are opt-in and user-controlled. |
| **Data deletion** | Self-service account deletion in Settings. Immediate removal of all cloud data (profile, conventions, events, avatar). No need to contact support. |
| **Children (COPPA)** | App is not directed at children under 13. No age-gating needed unless targeting kids. |
| **GDPR (EU users)** | Right to access, correct, delete personal data. Data processing basis: consent + contract. |
| **Contact** | Email address for privacy questions |

**Key selling point for marketing:** "We don't track you. We don't sell your data. We don't even have analytics. Your data is yours."

### Terms of Service

Must cover:

| Topic | What to include |
|-------|----------------|
| **Acceptable use** | No harassment, impersonation, illegal content, spam |
| **Account rules** | Username policy (3-20 chars, blocklist), one account per person, support-only username changes |
| **Subscriptions** | ConPaws+ pricing, billing via Apple/Google, auto-renewal, cancellation policy |
| **Data on cancellation** | 30-day grace period, cloud data deleted after, local data stays forever |
| **Content ownership** | Users own their data. ConPaws has limited license to display it (profiles, shared schedules). |
| **Termination** | Right to suspend/ban accounts for ToS violations |
| **Verification badges** | Verified and Developer badges are admin-assigned, not purchasable, can be revoked |
| **Liability** | Standard limitation of liability, no warranty, app provided "as is" |
| **Modifications** | Right to update ToS with notice to users |

### Account Deletion Flow

Self-service, no support ticket needed. Apple requires this since 2022 for any app with account creation.

```
User taps "Delete Account" in Settings
  → Confirmation dialog:
    "This will permanently delete your account
     and all cloud data. This cannot be undone.

     Your local convention data will stay on
     this device."

    [Cancel]  [Delete My Account (red)]
  → User confirms
  → tRPC `account.delete` mutation on the API Worker:
    1. Delete avatar object from R2
    2. Delete shared_events (CASCADE from shared_conventions)
    3. Delete shared_conventions
    4. Delete profile row
    5. Delete the Better-Auth user row in D1 (CASCADE handles profile)
    6. RevenueCat: anonymous-ize customer record (via ctx.waitUntil)
    7. Sign user out locally
    8. Clear local cache (SQLite premium data)
  → Show confirmation: "Account deleted."
  → Return to Home screen (app works as free/local user)
```

**What gets deleted:**
- Profile (username, display name, bio, avatar, badges, name effect)
- All cloud convention data + shared events
- Avatar file in R2
- Auth user record (Better-Auth tables in D1)
- RevenueCat customer link (subscription still managed by Apple/Google directly)

**What stays:**
- Local convention data on device (it's theirs)
- Active subscription (managed by Apple/Google — user must cancel separately in store settings)

### Where to Host

- Static pages on your website (e.g. `conpaws.com/privacy`, `conpaws.com/terms`)
- Linked from: Settings screen, App Store listing, Google Play listing, sign-up flow
- Must be accessible without logging in

### When to Write

Phase 4 (before App Store submission). Full templates with App Store compliance checklist are in **`legal.md`**. Replace all `[PLACEHOLDER]` values and consider having a lawyer review before publishing.

---

## Development Phases

> **Reality check:** the original "MVP by June 2026" target has passed. The phases below are re-cut around the Cloudflare backend and the actual repo state: the monorepo scaffold and the pre-release website exist; the app screens, local database, and backend do not.

### Phase 0: Foundation — DONE

- [x] Monorepo scaffold (Better-T-Stack: bun workspaces + Turborepo + Biome)
- [x] `apps/native` Expo SDK 55 scaffold (NativeWind v5, app variants, EAS config)
- [x] `apps/web` marketing/waitlist site on Cloudflare Workers via OpenNext (Turnstile + D1 + Brevo)
- [x] Root CI (lint + type-check fanning out through Turbo)

### Phase 1: MVP (local-first app)

The goal: **a usable app you can take to a convention.** Local-first convention management with iCal import. No accounts, no cloud — just a tool that works. Realistic flag in the ground: the winter 2026 con season (MFF in December).

- [ ] SDK upgrade 55 → 56 → 57 (see the upgrade path — do this before screens multiply)
- [ ] Fix the `react: 19.0.0` pin mismatch (`npx expo install --fix`)
- [ ] ShadCN-inspired native component library (Button, Card, Input, Avatar, Badge, etc.)
- [ ] Theme system (light + dark mode via NativeWind CSS variables)
- [ ] expo-sqlite + Drizzle ORM setup (`apps/native/src/db/` — empty today)
- [ ] Onboarding flow (Welcome → Features → Get Started → Complete)
- [ ] Tab navigation (Home, Profile, Settings — classic JS tabs; Native Tabs is alpha)
- [ ] Local convention management (CRUD), detail with events, status detection
- [ ] iCal import — two methods:
  - [ ] Import .ics file from device (primary)
  - [ ] Paste Sched URL → app extracts iCal link and parses events (secondary)
- [ ] Settings screen (reset onboarding, about, legal links)
- [ ] JSON data export/import (share sheet)
- [ ] i18next setup (English strings, `useTranslation()` from day one)
- [ ] Vitest setup + initial unit tests (iCal parser, utility functions) — none exist yet
- [ ] App icons and splash screen

**Milestone:** App works 100% offline with iCal import.

### Phase 2: Backend & Accounts

Scaffold the Cloudflare backend, add accounts and profiles, browse the convention directory.

- [ ] **Spike first:** verify `@better-auth/expo` against SDK 55+/New Architecture on a dev build — compatibility is unverified and this gates the rest of the phase
- [ ] Scaffold `apps/server` (Hono + tRPC + Better-Auth on Workers; D1/R2/KV/Queues bindings in `wrangler.jsonc`)
- [ ] D1 schema + Drizzle migrations (every queried column indexed at definition time)
- [ ] Better-Auth config (Apple Sign-In + Google OAuth; per-request factory; pin `>=1.6.x`; test session persistence across the cookieCache boundary)
- [ ] Auth flow in mobile app (sign in, session management, sign out)
- [ ] Profile creation via Better-Auth database hook + setup screen (display name, @username, pronouns, bio, avatar picker)
- [ ] Built-in animal icon avatar picker + 2-letter initials fallback
- [ ] Username validation + blocklist (tRPC-side check against D1)
- [ ] Profile screen, Account section in Settings
- [ ] Self-service account deletion (GDPR/CCPA compliant, required by App Store)
- [ ] Convention directory table + admin seeding; "Browse Conventions" screen
- [ ] Sentry crash reporting setup (`@sentry/react-native`, preview + production only)

**Milestone:** Users can create accounts, have profiles, and browse the convention directory.

### Phase 3: Premium (ConPaws+)

Add RevenueCat and all premium features.

- [ ] RevenueCat SDK integration
- [ ] Developer premium access (RevenueCat Promotional Entitlements — no code needed)
- [ ] Paywall UI (monthly + yearly options)
- [ ] `Purchases.logIn(userId)` after auth
- [ ] RevenueCat webhook → Hono route on the Worker (verify auth header; `is_premium` sync; side effects via `ctx.waitUntil`)
- [ ] Polling sync: `changes?since=` endpoint + local mirror merge (`useLiveQuery`)
- [ ] Offline queue + drain engine (chunked ≤100 bound params, `db.batch()` server-side)
- [ ] Cron Trigger: 30-day grace-period deletion job
- [ ] Custom photo avatar upload (ConPaws+ only — R2 presigned upload, resized with expo-image-manipulator)
- [ ] Share convention schedule, "Next Conventions" on profile
- [ ] Gold paw + developer badges; privacy controls (shareable toggle)
- [ ] Entitlement gating throughout the app
- [ ] Name effects — pride flag gradient picker (premium)
- [ ] Subscription cancellation flow (30-day grace period, data download)

**Milestone:** Full free-to-paid funnel working end to end.

### Phase 4: Polish & Launch

Get ready for the App Store.

- [ ] Verification requests pipeline (`verification_requests` + `verified_creator`; manual review for now)
- [ ] Push notifications via Cloudflare Queue → Expo Push API (optional)
- [ ] Accessibility pass (VoiceOver, Dynamic Type)
- [ ] Performance optimization
- [ ] Sharing preview pages live in `apps/web` (`conpaws.com/@username`, `conpaws.com/con/slug` — SSR against the API Worker)
- [ ] Universal links setup (iOS `apple-app-site-association` + Android `assetlinks.json`)
- [ ] Privacy Policy + Terms of Service (conpaws.com/privacy, /terms)
- [ ] Fix `eas.json` submit placeholders (CON-35), ASC API Key via `eas credentials`, Play service-account JSON
- [ ] First store upload done **manually** on both stores; EAS Workflows automate from #2 on
- [ ] App Store assets (screenshots, description, keywords)
- [ ] TestFlight beta → gather feedback → iterate
- [ ] App Store submission (iOS first, then Android)

**Milestone:** App live on the App Store and Play Store.

### Phase 5: Future Ideas

Not committed, just possibilities.

- [ ] Live Activities (next event countdown on lock screen + Apple Watch Smart Stack)
- [ ] Web app (view shared profiles/schedules)
- [ ] Convention partnerships (official app for specific cons?)
- [ ] Friends / following system
- [ ] In-app messaging between attendees
- [ ] Convention maps integration
- [ ] Fandom-specific features (fursuit meetup tracking?)

---

## Open Questions

Things to decide before or during development:

1. ~~**Exact pricing**~~ — **Decided: $3.99/mo + $24.99/yr** with convention season promos
2. ~~**Backend stack**~~ — **Decided: Cloudflare Workers + D1 + R2, with Hono + tRPC + Better-Auth** — one platform for API, database, storage, and the website
3. ~~**Premium plan name**~~ — **Decided: ConPaws+** with gold paw badge + blue check verified badge
4. ~~**Free trial**~~ — **Decided: No free trial.** Users either subscribe or they don't.
5. ~~**Avatar limits**~~ — **Decided: 5 MB max.** JPEG/PNG/WebP. Stored on Cloudflare R2 (zero egress fees), served via `cdn.conpaws.com`.
6. ~~**Username rules**~~ — **Decided: 3-20 chars, lowercase alphanumeric + underscores.** Changes require contacting support. Server-side blocklist for profanity, reserved words, and impersonation.
7. ~~**Verification criteria**~~ — **Decided: Notable community members only** — big content creators, well-known artists, popular fursuiters. Admin-assigned blue checkmark. Developer gets gold checkmark (same icon, gold background).
8. ~~**iCal priority**~~ — **Decided: Phase 1 (MVP).** Most furry cons use Sched which provides iCal links. Import is core functionality, not a nice-to-have. Two methods: .ics file import + Sched URL parser.
9. ~~**Theme colors**~~ — **Decided: Dark mode + light mode only.** Brand colors TBD to match the logo.
10. ~~**watchOS scope**~~ — **Decided: No watchOS app.** Use Live Activities instead — they show on iPhone lock screen AND Apple Watch Smart Stack automatically. Shows next event countdown, name, location, and time. Updates as events pass throughout the day.
11. ~~**Offline → Online sync**~~ — **Decided: Two-mode architecture** — free = local-primary (SQLite is the full DB), premium = cloud-primary (D1 is the source of truth; the device keeps a polled local mirror). Last-write-wins conflict resolution. 30-day grace period on cancellation. No realtime layer — polling only.
12. ~~**Convention data source**~~ — **Decided: Hybrid.** Admin-curated convention directory in D1 (browse & add), plus user self-import via iCal/Sched URLs, plus manual entry. Most furry cons use Sched which provides iCal feeds.

---

## README.md

The repo root `README.md` is the canonical README, maintained in the MrDemonWolf house format (generated with the `mrdw-readme` skill). It is written from the real repo state — this plan deliberately carries no inline README template, because a duplicated template drifts from reality.

---

*This is a living document. Update as decisions are made.*
