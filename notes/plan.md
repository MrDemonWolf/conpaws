# ConPaws - Project Plan

**Tagline:** Navigate, Connect, Enjoy
**Status:** Pre-development planning

---

## TL;DR

A **free, offline-first convention companion app** for the furry community.

- **What:** Browse schedules, track panels, set reminders. Import any con's schedule via iCal.
- **Who:** Furry convention-goers. All ages. Privacy-first.
- **How:** Expo + React Native + SQLite (local) + Supabase (cloud for premium).
- **Money:** Free tier is fully functional. ConPaws+ ($3.99/mo or $24.99/yr) adds cloud sync + social.
- **Killer feature:** Works without WiFi. Con WiFi is terrible. We win there.
- **Target:** MVP by June 2026 for convention season.
- **Competitor:** Barq added convention schedules (Feb 2026) but needs internet and is 18+ only.

---

## Quick Navigation

| Section | What's There |
|---------|-------------|
| [Platforms](#platforms) | iOS primary, Android secondary, iPad adaptive |
| [Tech Stack](#tech-stack) | Expo, NativeWind, Drizzle, Supabase, RevenueCat |
| [Monorepo Structure](#monorepo-structure) | Folder layout, domains, env files |
| [Business Model](#business-model) | Free / Account / ConPaws+ tiers, pricing, promos |
| [Badge System](#badge-system) | Gold paw, verified, developer badges + pride name effects |
| [Screens & Navigation](#screens--navigation) | Onboarding, tabs, all screen mockups |
| [Data Model](#data-model) | SQLite schema (local) + PostgreSQL schema (cloud) |
| [Auth Flow](#auth-flow) | Apple/Google OAuth via Supabase, RevenueCat linking |
| [Avatar & Username Rules](#avatar--username-rules) | Icons, uploads, naming rules, blocklist |
| [Data & Sync Architecture](#data--sync-architecture) | Two-mode system, offline queue, upgrade/downgrade |
| [Local Database Migrations](#local-database-migrations) | Drizzle migrations on device |
| [iCal Import](#ical-import-core-feature) | Parser, categories, content warnings, iOS features |
| [Data Backup & Export](#data-backup--export) | OS backup, JSON export/import |
| [Crash Reporting](#crash-reporting-sentry) | Sentry setup, what to/not to track |
| [Sharing & Deep Links](#sharing--deep-links) | Universal links, Next.js preview site |
| [Testing Strategy](#testing-strategy) | Vitest, what to test vs skip |
| [CI/CD](#cicd-github-actions) | GitHub Actions on PRs |
| [Localization](#localization) | i18next, English-first, community translations |
| [Component System](#component-system-shadcncn-inspired) | UI components, design tokens |
| [App Config](#app-config-appconfigts) | Expo config, EAS, three variants |
| [Infrastructure](#infrastructure) | Coolify, R2, RevenueCat, Sentry |
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
| Expo SDK 54 | App framework |
| React Native 0.81 + React 19 | UI runtime |
| Expo Router v6 | File-based routing (typed routes) |
| NativeWind v5 | Tailwind CSS v4 for React Native |
| Custom UI components | ShadCN/CN-inspired, built with `cn()` (clsx + tailwind-merge) |
| Lucide React Native | Icons |
| expo-sqlite | Local-first database |
| Drizzle ORM | Type-safe ORM for expo-sqlite (mature mobile support, lightweight) |
| AsyncStorage | Key-value storage (settings, flags) |
| TanStack React Query | Data fetching, caching, sync layer |
| expo-image-manipulator | Avatar resizing/compression before upload |
| expo-image-picker | Photo selection from camera roll |
| i18next + react-i18next | Localization (English primary, i18n-ready for community translations) |
| expo-localization | Device language detection |

### Backend

| Tool | Purpose |
|------|---------|
| Supabase (self-hosted on Coolify) | Database (PostgreSQL), auth, real-time, edge functions — all-in-one |
| Cloudflare R2 (via Supabase Storage) | Avatar & file storage (S3-compatible, zero egress fees) |

### Payments

| Tool | Purpose |
|------|---------|
| RevenueCat | Subscription management, receipt validation, entitlement checks |
| Entitlement: `conpaws_plus` | Single premium tier |

### Dev Tooling

| Tool | Purpose |
|------|---------|
| TypeScript (strict) | Language |
| pnpm | Package manager + monorepo workspaces |
| pnpm workspaces | Monorepo structure (no Turborepo — pnpm scripts are sufficient) |
| ESLint (Expo config) | Linting |
| EAS Build + Submit | Build pipeline + store submission |
| Supabase CLI | Local development (runs Supabase locally via Docker for dev only) |
| Vitest | Unit testing (fast, TypeScript-native) |
| Sentry (via `@sentry/react-native`) | Crash reporting + error tracking |
| GitHub Actions | CI/CD (lint + type-check + tests on PRs) |

---

## Monorepo Structure

```
conpaws/
├── apps/
│   └── mobile/                  # Expo React Native app
│       ├── src/
│       │   ├── app/             # Expo Router (file-based screens)
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx
│       │   │   ├── (onboarding)/
│       │   │   └── (tabs)/
│       │   ├── components/
│       │   │   └── ui/          # ShadCN-inspired components
│       │   ├── contexts/
│       │   ├── hooks/
│       │   ├── lib/
│       │   │   ├── utils.ts     # cn() helper
│       │   │   ├── constants.ts
│       │   │   └── supabase.ts  # Supabase client
│       │   ├── db/
│       │   │   ├── schema.ts    # Drizzle schema for local SQLite
│       │   │   └── migrations/  # Drizzle migration SQL files
│       │   ├── types/
│       │   ├── locales/
│       │   │   └── en.json      # English strings (primary)
│       │   ├── assets/
│       │   └── global.css       # Tailwind entry point
│       ├── app.config.ts
│       └── package.json
│
├── apps/
│   └── web/                      # Next.js marketing + sharing site (conpaws.com, hosted on Coolify)
│       ├── src/
│       │   └── app/
│       │       ├── [@username]/page.tsx  # Public profile preview
│       │       └── con/[slug]/page.tsx   # Convention preview
│       └── public/
│           └── .well-known/
│               ├── apple-app-site-association
│               └── assetlinks.json
│
├── apps/
│   └── admin/                    # Next.js admin dashboard (admin.conpaws.com, hosted on Coolify) — Future
│
├── packages/
│   └── supabase/                # Supabase configuration
│       ├── migrations/          # SQL migration files
│       ├── seed.sql             # Seed data (optional)
│       └── config.toml          # Supabase project config
│
├── .env.example
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

**Local development:** Supabase CLI runs a local Supabase instance via Docker on your machine for development. This is the only Docker usage — production runs on Coolify which handles deployment for you.

### Domains

| Domain | Purpose |
|--------|---------|
| `conpaws.com` | Marketing website, legal pages (`/privacy`, `/terms`) |
| `api.conpaws.com` | Supabase API (PostgREST, Auth, Edge Functions) |
| `cdn.conpaws.com` | Cloudflare R2 bucket custom domain (avatar/file delivery, bypasses Supabase proxy, zero egress) |
| `dev.conpaws.com` | Staging/preview Supabase instance (for testing before production) |
| `admin.conpaws.com` | Admin dashboard — user management, convention directory CRUD, badge assignments (Future) |

All domains on Cloudflare for DNS + CDN + DDoS protection. SSL handled automatically.

### Environment Files (Expo App Variants)

Expo supports `.env` files per app variant. Three environments:

**`.env.development`** — Local dev, points at Supabase CLI instance
```
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
EXPO_PUBLIC_CDN_URL=http://localhost:54321/storage/v1
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=<sandbox-key>
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=<sandbox-key>
EXPO_PUBLIC_APP_ENV=development
```

**`.env.preview`** — Staging builds (TestFlight, internal testing), points at dev Supabase
```
EXPO_PUBLIC_SUPABASE_URL=https://dev.conpaws.com
EXPO_PUBLIC_SUPABASE_ANON_KEY=<dev-anon-key>
EXPO_PUBLIC_CDN_URL=https://cdn.conpaws.com
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=<sandbox-key>
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=<sandbox-key>
EXPO_PUBLIC_SENTRY_DSN=<sentry-dsn>
EXPO_PUBLIC_APP_ENV=preview
```

**`.env.production`** — App Store / Play Store releases
```
EXPO_PUBLIC_SUPABASE_URL=https://api.conpaws.com
EXPO_PUBLIC_SUPABASE_ANON_KEY=<prod-anon-key>
EXPO_PUBLIC_CDN_URL=https://cdn.conpaws.com
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=<prod-apple-key>
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=<prod-google-key>
EXPO_PUBLIC_SENTRY_DSN=<sentry-dsn>
EXPO_PUBLIC_APP_ENV=production
```

**How it works in Expo:**
- `npx expo start` → loads `.env.development`
- `eas build --profile preview` → loads `.env.preview`
- `eas build --profile production` → loads `.env.production`
- Access in code via `process.env.EXPO_PUBLIC_*`
- Never commit `.env.*` files — only `.env.example`

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
- Cloud sync: conventions & schedule backed up to Supabase
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
- Easy to add more flags over time without app updates (store flag definitions in Supabase)

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
// src/db/schema.ts
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

### Cloud Database (Supabase PostgreSQL) — Accounts & Premium Users

```sql
-- === Enums ===

CREATE TYPE badge_role AS ENUM ('user', 'verified', 'developer');

CREATE TYPE name_effect AS ENUM (
  'rainbow', 'trans', 'bi', 'pan', 'nonbinary',
  'lesbian', 'ace', 'aro', 'genderfluid',
  'genderqueer', 'intersex', 'progress'
);

CREATE TYPE event_type AS ENUM ('panel', 'custom');

-- === Tables ===

-- profiles (linked to auth.users via id)
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 20),
  display_name TEXT NOT NULL,
  bio          TEXT DEFAULT '' CHECK (char_length(bio) <= 256),
  pronouns     TEXT,
  avatar_url   TEXT,              -- custom photo URL (ConPaws+ only, stored on R2 via cdn.conpaws.com)
  avatar_icon  TEXT,              -- built-in animal icon key (e.g. 'wolf', 'fox', 'dragon')
  avatar_color TEXT,              -- initials background color hex (e.g. '#3B82F6')
  badge_role   badge_role  DEFAULT 'user',
  name_effect  name_effect,            -- pride flag gradient — ConPaws+ only
  is_premium   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- username blocklist (checked on profile creation)
CREATE TABLE username_blocklist (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL UNIQUE -- exact match or regex pattern
);

-- convention directory (admin-curated, browsable by all users)
CREATE TABLE convention_directory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  location    TEXT,              -- city/venue
  website_url TEXT,
  ical_url    TEXT,              -- Sched or other iCal feed URL
  year        INT NOT NULL,
  is_active   BOOLEAN DEFAULT true, -- hide cancelled/past cons from browse
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- shared_conventions (premium users — cloud-synced conventions)
CREATE TABLE shared_conventions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  ical_url   TEXT,
  synced_at  TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- shared_events (premium users — shareable events within conventions)
CREATE TABLE shared_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_convention_id  UUID NOT NULL REFERENCES shared_conventions(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT,
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ NOT NULL,
  location              TEXT,
  type                  event_type DEFAULT 'panel',
  synced_at             TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

**Why enums?**
- PostgreSQL enforces valid values at the database level — no bad data gets in
- Drizzle's `text({ enum: [...] })` enforces at the TypeScript level for SQLite (which doesn't have native enums)
- Adding a new value (e.g. a new pride flag) is a simple `ALTER TYPE name_effect ADD VALUE 'new_flag'` migration
- Type-safe all the way from database → Supabase API → TypeScript client

**Row Level Security (RLS):**
- `profiles`: Users can read any profile, but only update their own
- `convention_directory`: Public read for everyone, insert/update/delete restricted to admin (you)
- `shared_conventions`: Users can only read/write their own; public read for premium users who share
- `shared_events`: Same as shared_conventions — scoped by user, public read when shared

Supabase auto-generates a REST API (PostgREST) from these tables — no custom API endpoints needed.

---

## Auth Flow

```
1. User taps "Sign In" (profile or settings)
2. App opens Supabase Auth OAuth (Apple or Google)
3. Supabase handles OAuth redirect + callback
4. Supabase creates/finds user, issues session
5. @supabase/supabase-js stores session automatically (AsyncStorage)
6. All Supabase queries now include auth context
7. RLS policies control data access at the database level
```

No separate auth server. No JWTs to manage manually. No JWKS endpoints. Supabase handles it all.

**Key rule:** Account creation is free. Premium features check RevenueCat entitlement status, not just auth status.

**Profile creation trigger:**
- Supabase database trigger on `auth.users` insert → auto-creates a `profiles` row
- User completes profile setup (username, display name, etc.) after first sign-in

**RevenueCat integration:**
- App checks entitlement `conpaws_plus` via RevenueCat SDK
- RevenueCat webhook → Supabase Edge Function → updates `profiles.is_premium`
- This keeps Supabase in sync with subscription status
- `Purchases.logIn(supabaseUserId)` links RevenueCat customer to Supabase user
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
| Storage backend | Cloudflare R2 via Supabase Storage (S3-compatible, zero egress fees) |
| Delivery | Direct via `cdn.conpaws.com` (R2 custom domain, bypasses Supabase proxy) |

**Upload flow:** User picks image via `expo-image-picker` (square crop enforced) → `expo-image-manipulator` resizes to 512x512 JPEG at 0.8 quality → upload to R2 via Supabase Storage → profile updated with `cdn.conpaws.com` URL.

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

Blocklist is stored in Supabase and checked via a database function or Edge Function on profile creation. Easy to update without app releases.

---

## Data & Sync Architecture

The app runs in two distinct modes depending on subscription status. The key principle: **free users own their data locally, premium users own their data in the cloud.**

### Two Modes

| | Free | Premium |
|---|---|---|
| **Source of truth** | SQLite (full database) | Supabase (cloud) |
| **SQLite role** | Full database | Cache + offline queue |
| **Storage footprint** | Full (all data on device) | Minimal (recent/active data only) |

### Free Mode (Local-Primary)

SQLite is everything. No cloud, no sync, no network calls for data.

- **Reads:** SQLite directly
- **Writes:** SQLite directly
- **Storage:** All conventions + events live on device

### Premium Mode (Cloud-Primary)

Supabase is the source of truth. SQLite is a lightweight cache for performance and offline access.

**Reads (online):**
```
UI needs data
  → TanStack Query has it in memory? → use it
  → No? → fetch from Supabase → cache in TanStack Query + SQLite
```

**Reads (offline):**
```
UI needs data
  → TanStack Query has it in memory? → use it
  → No? → read from SQLite cache (may be stale)
```

**Writes (online):**
```
User creates/edits/deletes
  → Optimistic UI update (TanStack Query)
  → Push to Supabase immediately
  → Success → cache updated, done
```

**Writes (offline):**
```
User creates/edits/deletes
  → Optimistic UI update (TanStack Query)
  → Write to SQLite OfflineQueue
  → When back online → drain queue to Supabase → clear queue
```

### What Gets Cached Locally (Premium)

Not everything — just enough to work offline without bloating device storage:

- Conventions they've viewed recently
- Events for upcoming/active conventions
- Their own profile data
- The offline write queue (pending changes)

Old ended conventions? Don't cache those unless they open them.

### Offline Queue Drain

The `OfflineQueue` table (in local SQLite) holds pending writes when premium users are offline.

**Drain triggers:**
- App returns to foreground
- Network connectivity restored
- After a local write (debounced, ~5 seconds)
- Manual pull-to-refresh

**Drain cycle:**
1. Read all `OfflineQueue` rows, oldest first
2. For each: push to Supabase (`upsert` for create/update, `delete` for delete)
3. On success: remove from queue
4. On failure: leave in queue, retry next cycle

### Conflict Resolution (Multi-Device)

Since this is single-user data, conflicts are rare. They only happen if the same user edits on two devices while one is offline.

**Strategy: Last-write-wins** using `updatedAt` timestamps.

- Supabase has a newer `updatedAt` than local → cloud wins
- Local has a newer `updatedAt` → local wins
- Deletes always win (if either side deleted it, it's gone)

Simple, predictable, no merge logic needed.

### Upgrade Migration (Free → Premium)

When a user subscribes to ConPaws+:

1. RevenueCat confirms `conpaws_plus` entitlement
2. Read all conventions + events from SQLite
3. Bulk insert into Supabase (`shared_conventions` + `shared_events`)
4. Confirm everything landed in the cloud
5. Clear full SQLite data (it's all in Supabase now)
6. Switch to cloud-primary mode — SQLite is now just a cache

### Downgrade Migration (Premium → Free)

When a subscription expires:

1. App detects entitlement loss on launch/foreground
2. Show the cancellation screen (see below) with a clear summary
3. Pull all their cloud data down into SQLite (auto-start + manual trigger)
4. Confirm download complete
5. Switch to local-primary mode — SQLite is now the full database again
6. Shared schedule goes private immediately
7. Badge removed, premium features gated off
8. **30-day grace period** — cloud data stays in Supabase
9. After 30 days — Supabase Edge Function cron job deletes their `shared_conventions` + `shared_events`
10. Account + profile stay forever (free tier)

### Re-subscribe Scenarios

**Within 30 days:** Cloud data still exists. Skip migration, just flip back to cloud-primary mode. Fast and seamless.

**After 30 days:** Cloud data is gone. Same as a fresh upgrade — migrate local SQLite data back up to Supabase.

### Why 30-Day Grace Period

- Covers accidental cancellations and billing hiccups
- Reduces data churn (cancel Monday, re-subscribe Friday)
- Aligns with Apple/Google subscription grace periods
- After 30 days, we're not storing data for free indefinitely

### Sync Hook (Conceptual)

```
useSyncEngine() hook
  ├── watches: RevenueCat entitlement status
  ├── watches: network connectivity (NetInfo)
  ├── on entitlement gained: runUpgradeMigration()
  ├── on entitlement lost: runDowngradeMigration()
  ├── on app foreground: drainQueue()
  ├── on network restored: drainQueue()
  ├── on local write (debounced): drainQueue()
  └── drainQueue():
       ├── if !premium || !online → return
       ├── read OfflineQueue rows
       ├── for each: supabase.from('shared_...').upsert(...)
       ├── on success: delete queue row
       └── on error: log, retry next cycle
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
  └── Option C: "Browse Convention Directory" (Phase 2, requires Supabase)
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
- **API errors:** Supabase request failures (not individual 404s, just patterns)

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

### Implementation: Next.js on Coolify

A **Next.js** app handles the web preview pages, marketing site, and legal pages. Hosted on the same Coolify VPS as Supabase — keeps everything under one roof.

**Why Next.js:**

| Approach | Verdict |
|----------|---------|
| WordPress | Too heavy, separate system to manage |
| Supabase Edge Functions | Can't serve HTML (returns `text/plain`) — dealbreaker |
| Astro | Lightweight but can't share React components or types with the mobile app |
| Branch.io | Expensive, adds tracking, vendor lock-in |
| **Next.js on Coolify** | Same React/TypeScript stack, shares types with mobile app, SSR for OG tags, self-hosted |

**How it works:**

1. Next.js app lives in `apps/web/` in the monorepo
2. Dynamic routes (`/[username]/page.tsx`, `/con/[slug]/page.tsx`) fetch data from Supabase at request time (SSR)
3. Pages render with Open Graph meta tags for social sharing cards
4. `<meta name="apple-itunes-app">` shows the App Store smart banner
5. `.well-known/apple-app-site-association` + `assetlinks.json` served from `public/` for universal links
6. Also serves: marketing homepage, `/privacy`, `/terms`
7. Deployed to Coolify (same VPS as Supabase, auto-deploy on push to main)

**Cost:** $0 incremental (already paying for the VPS)

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
| **Sync engine** | Offline queue drain, upgrade/downgrade migration | Unit tests with mocked Supabase |
| **iCal parser** | Parsing .ics files, extracting events from Sched URLs | Unit tests with fixture files |
| **Username validation** | Blocklist check, character rules, length limits | Unit tests |
| **Data export** | JSON export format, completeness | Unit tests |
| **Utility functions** | `cn()`, date formatting, status detection | Unit tests |

### What NOT to Test

- UI rendering (too brittle, changes often)
- Navigation flows (trust Expo Router)
- Third-party SDK behavior (RevenueCat, Supabase Auth)
- Visual appearance (manual QA is faster)

### Tooling

- **Vitest** — Fast, TypeScript-native test runner (works well with Expo projects)
- Test files live next to source: `foo.ts` → `foo.test.ts`
- Run with `pnpm test`

---

## CI/CD (GitHub Actions)

Lightweight CI pipeline on every PR. No deployment automation — EAS handles builds and submissions.

### PR Checks (GitHub Actions)

Every pull request runs:

1. **Lint** — `pnpm lint` (ESLint across all packages)
2. **Type check** — `pnpm type-check` (TypeScript strict mode)
3. **Tests** — `pnpm test` (Vitest unit tests)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test
```

### What CI Does NOT Do

- No EAS builds on CI (use `eas build` manually or from local machine)
- No deployment (Coolify auto-deploys the Next.js site on push to main)
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

## App Config (`app.config.ts`)

Based on the MrDemonWolf app pattern, adapted for ConPaws with three variants.

```ts
import { ConfigContext, ExpoConfig } from "expo/config";

const APP_VARIANT = process.env.APP_VARIANT || "development";
const IS_PRODUCTION = APP_VARIANT === "production";
const IS_PREVIEW = APP_VARIANT === "preview";

const getBundleId = () => {
  if (IS_PRODUCTION) return "com.mrdemonwolf.conpaws";
  if (IS_PREVIEW) return "com.mrdemonwolf.conpaws.preview";
  return "com.mrdemonwolf.conpaws.dev";
};

const getAppName = () => {
  if (IS_PRODUCTION || IS_PREVIEW) return "ConPaws";
  return "ConPaws (Dev)";
};

const getIcon = () => {
  return "./src/assets/images/icon.png";
};

const getAndroidForegroundIcon = () => {
  return "./src/assets/images/android-icon-foreground.png";
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  owner: "mrdemonwolf-org",
  name: getAppName(),
  slug: "conpaws",
  version: "1.0.0",
  orientation: "default",
  icon: getIcon(),
  scheme: "conpaws",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleId(),
    buildNumber: "1",
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSMotionUsageDescription:
        "This app uses haptic feedback to enhance your experience.",
    },
  },
  android: {
    package: getBundleId(),
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#ffffff",
      foregroundImage: getAndroidForegroundIcon(),
      backgroundImage: "./src/assets/images/android-icon-background.png",
      monochromeImage: "./src/assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    output: "static",
    favicon: "./src/assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    [
      "expo-splash-screen",
      {
        image: "./src/assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-document-picker",
      {
        iCloudContainerEnvironment: "Production",
      },
    ],
    [
      "@sentry/react-native/expo",
      {
        organization: "mrdemonwolf",
        project: "conpaws",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "",
    },
    appVariant: APP_VARIANT,
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
```

### Changes From MrDemonWolf App

| What | MrDemonWolf App | ConPaws |
|------|----------------|---------|
| Variants | 2 (dev/prod) | 3 (dev/preview/prod) |
| Bundle ID | `com.mrdemonwolf.OfficialApp` | `com.mrdemonwolf.conpaws` |
| App name | `MrDemonWolf` / `MDW (Dev)` | `ConPaws` / `ConPaws (Dev)` (preview + prod share the same name) |
| Slug | `official-app` | `conpaws` |
| Scheme | `mrdemonwolf` | `conpaws` (deep links: `conpaws://`) |
| Orientation | `portrait` | `default` (allows landscape on iPad for split-view) |
| Plugins | router, splash | + `expo-sqlite`, `expo-document-picker` |
| Extra | just EAS ID | + `appVariant` exposed to code |

### EAS Config (`eas.json`)

```json
{
  "cli": {
    "version": ">= 16.28.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": { "APP_VARIANT": "development" },
      "ios": { "buildConfiguration": "Debug" },
      "local": true
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": { "APP_VARIANT": "preview" },
      "local": true
    },
    "production": {
      "distribution": "store",
      "channel": "production",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "",
        "ascAppId": "",
        "appleTeamId": ""
      }
    }
  }
}
```

**Build strategy:**

| Profile | Built where | Why |
|---------|------------|-----|
| `development` | **Local** (`local: true`) | Fast iteration, no build credits used |
| `preview` | **Local** (`local: true`) | TestFlight/internal testing, no build credits used |
| `production` | **EAS Cloud** | Store submission, `autoIncrement` handles version bumps |

Run locally: `eas build --profile development --local` or `eas build --profile preview --local`
Run on EAS: `eas build --profile production` (cloud) → `eas submit --profile production`

This keeps you on the EAS free plan — only production store builds use cloud credits.

### Why Three Variants

All three can be installed on the same device simultaneously (different bundle IDs):

- **Development** (`conpaws.dev`) — Local Supabase, sandbox RevenueCat, debug tools
- **Preview** (`conpaws.preview`) — Staging Supabase (`dev.conpaws.com`), TestFlight/internal builds
- **Production** (`conpaws`) — Live Supabase (`api.conpaws.com`), App Store release

---

## Infrastructure

| Service | Where | Notes |
|---------|-------|-------|
| Supabase | Self-hosted on Coolify | PostgreSQL + Auth + Real-time + Edge Functions |
| Cloudflare R2 | Cloudflare | Avatar/file storage via Supabase Storage (S3-compatible, zero egress fees) |
| RevenueCat | Cloud (their servers) | Subscription management, no self-host option |
| Next.js site | Coolify (same VPS) | Marketing site, sharing preview pages (`conpaws.com/@user`), universal links, OG tags, legal pages |
| Next.js admin | Coolify (same VPS) | Admin dashboard (`admin.conpaws.com`) — user management, convention directory, badges (Future) |
| Sentry | Cloud (their servers) | Crash reporting + error tracking (free tier: 5K errors/month) |

**How it works:**
- **Production:** Coolify deploys and manages Supabase for you. No manual Docker setup — Coolify handles the deployment, SSL, and updates.
- **Local development:** Supabase CLI (`supabase start`) runs a local instance via Docker on your dev machine. This is the only time Docker is used directly.
- **No separate backend services.** No auth server, no API server, no additional databases. Just Supabase + your Expo app.

### Storage (Cloudflare R2)

Supabase Storage is S3-compatible. When self-hosted, you point it at R2 via env vars:

```
STORAGE_BACKEND=s3
STORAGE_S3_BUCKET=conpaws-avatars
STORAGE_S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_REGION=auto
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
```

**Why R2:**
- Zero egress fees (serving avatars costs nothing)
- S3-compatible (drop-in replacement, no code changes)
- Cloudflare CDN built in (fast delivery worldwide)

**Direct access via `cdn.conpaws.com`:** R2 bucket has a custom domain (`cdn.conpaws.com`) so avatar URLs point directly to R2, bypassing the Supabase proxy entirely. Faster delivery, no server bandwidth consumed.

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
| **Third-party services** | Supabase (auth, database, storage), RevenueCat (subscriptions), Cloudflare R2 (file storage), Apple/Google (OAuth + payments) |
| **Data storage** | Self-hosted Supabase (you control the server), Cloudflare R2 for avatars |
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
  → Supabase Edge Function or client call:
    1. Delete avatar from R2 storage
    2. Delete shared_events (CASCADE from shared_conventions)
    3. Delete shared_conventions
    4. Delete profile row
    5. Delete auth.users row (CASCADE handles profile)
    6. RevenueCat: anonymous-ize customer record
    7. Sign user out locally
    8. Clear local cache (SQLite premium data)
  → Show confirmation: "Account deleted."
  → Return to Home screen (app works as free/local user)
```

**What gets deleted:**
- Profile (username, display name, bio, avatar, badges, name effect)
- All cloud convention data + shared events
- Avatar file in R2
- Auth record in Supabase
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

### Phase 1: MVP (Target: June 2026)

The goal: **a usable app you can take to a convention in June.** Local-first convention management with iCal import. No accounts, no cloud — just a tool that works.

- [ ] Monorepo structure (pnpm workspace, tsconfig, eslint)
- [ ] Expo app scaffolding with NativeWind v5 + Tailwind CSS v4
- [ ] ShadCN-inspired component library (Button, Card, Input, Avatar, Badge, etc.)
- [ ] Theme system (light + dark mode via NativeWind CSS variables)
- [ ] expo-sqlite + Drizzle ORM setup for local database
- [ ] Onboarding flow (Welcome → Features → Get Started → Complete)
- [ ] Tab navigation (Home, Profile, Settings)
- [ ] Local convention management (CRUD with expo-sqlite + Drizzle ORM)
- [ ] Convention detail with events (panels + custom items)
- [ ] Convention status detection (upcoming/active/ended)
- [ ] iCal import — two methods:
  - [ ] Import .ics file from device (primary — user downloads from Sched/con website, imports into app)
  - [ ] Paste Sched URL → app extracts iCal link and parses events (secondary — convenience feature)
- [ ] Settings screen (reset onboarding, about, legal links)
- [ ] App variants (development, preview, production) + .env files
- [ ] App icons and splash screen
- [ ] JSON data export/import (Settings → Export/Import My Data, cross-platform via share sheet)
- [ ] i18next setup (English strings in `src/locales/en.json`, `useTranslation()` from day one)
- [ ] Vitest setup + initial unit tests (iCal parser, utility functions)
- [ ] GitHub Actions CI (lint + type-check + test on PRs)

**Milestone:** App works 100% offline with iCal import. Ready to use at a con in June.

### Phase 2: Auth & Accounts

Deploy Supabase on Coolify, add accounts and profiles, browse convention directory.

- [ ] Supabase deployment on Coolify (+ R2 storage config)
- [ ] Supabase database schema + migrations (profiles, convention_directory, RLS policies)
- [ ] Supabase Auth config (Apple Sign-In + Google OAuth)
- [ ] Supabase local dev setup (Supabase CLI)
- [ ] Auth flow in mobile app (sign in, session management, sign out)
- [ ] Database trigger: auto-create profile row on auth.users insert
- [ ] Profile creation screen (display name, @username, pronouns, bio, avatar picker)
- [ ] Built-in animal icon avatar picker (bundled assets, no network needed)
- [ ] 2-letter initials fallback avatar (color derived from username hash)
- [ ] Username validation + blocklist (server-side check)
- [ ] Profile screen (view your own profile)
- [ ] Account section in Settings
- [ ] Self-service account deletion (GDPR/CCPA compliant, also required by App Store)
- [ ] Convention directory table + admin seeding (curated list of furry cons)
- [ ] "Browse Conventions" screen (search/filter the directory, add to your list)

- [ ] Sentry crash reporting setup (`@sentry/react-native`, preview + production only)

**Milestone:** Users can create accounts, have profiles, and browse the convention directory.

### Phase 3: Premium (ConPaws+)

Add RevenueCat and all premium features.

- [ ] RevenueCat SDK integration
- [ ] Developer premium access (grant `conpaws_plus` via RevenueCat Promotional Entitlements dashboard — no code needed)
- [ ] Paywall UI (monthly + yearly options)
- [ ] `Purchases.logIn(supabaseUserId)` after auth
- [ ] RevenueCat webhook → Supabase Edge Function (sync subscription status)
- [ ] Cloud sync: two-mode architecture (cloud-primary for premium, local-primary for free)
- [ ] Offline queue + drain engine
- [ ] Custom photo avatar upload (ConPaws+ only, R2 storage, resized with expo-image-manipulator)
- [ ] Share convention schedule (public profile feature)
- [ ] "Next Conventions" on profile
- [ ] ConPaws+ gold paw badge on profile
- [ ] Developer gold checkmark badge
- [ ] Privacy controls (shareable toggle on events)
- [ ] Entitlement gating throughout the app
- [ ] "Find Friends" — search users by username, discover who's attending same conventions (premium)
- [ ] Name effects — pride flag gradient picker for display names (premium)
- [ ] Subscription cancellation flow (30-day grace period, data download)

**Milestone:** Full free-to-paid funnel working end to end.

### Phase 4: Polish & Launch

Get ready for the App Store.

- [ ] Verified badge system (admin panel or manual for now)
- [ ] Push notifications for convention reminders (optional)
- [ ] Accessibility pass (VoiceOver, Dynamic Type)
- [ ] Performance optimization
- [ ] Sharing URLs — Next.js site on Coolify (`conpaws.com/@username`, `conpaws.com/con/slug`)
- [ ] Universal links setup (iOS `apple-app-site-association` + Android `assetlinks.json`)
- [ ] Privacy Policy (hosted at conpaws.com/privacy)
- [ ] Terms of Service (hosted at conpaws.com/terms)
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
2. ~~**Backend stack**~~ — **Decided: Supabase (self-hosted on Coolify)** — auth, database, storage, API all-in-one
3. ~~**Premium plan name**~~ — **Decided: ConPaws+** with gold paw badge + blue check verified badge
4. ~~**Free trial**~~ — **Decided: No free trial.** Users either subscribe or they don't.
5. ~~**Avatar limits**~~ — **Decided: 5 MB max.** JPEG/PNG/WebP. Stored on Cloudflare R2 via Supabase Storage (S3-compatible, zero egress fees).
6. ~~**Username rules**~~ — **Decided: 3-20 chars, lowercase alphanumeric + underscores.** Changes require contacting support. Server-side blocklist for profanity, reserved words, and impersonation.
7. ~~**Verification criteria**~~ — **Decided: Notable community members only** — big content creators, well-known artists, popular fursuiters. Admin-assigned blue checkmark. Developer gets gold checkmark (same icon, gold background).
8. ~~**iCal priority**~~ — **Decided: Phase 1 (MVP).** Most furry cons use Sched which provides iCal links. Import is core functionality, not a nice-to-have. Two methods: .ics file import + Sched URL parser.
9. ~~**Theme colors**~~ — **Decided: Dark mode + light mode only.** Brand colors TBD to match the logo.
10. ~~**watchOS scope**~~ — **Decided: No watchOS app.** Use Live Activities instead — they show on iPhone lock screen AND Apple Watch Smart Stack automatically. Shows next event countdown, name, location, and time. Updates as events pass throughout the day.
11. ~~**Offline → Online sync**~~ — **Decided: Two-mode architecture** — free = local-primary (SQLite is full DB), premium = cloud-primary (Supabase is source of truth, SQLite is cache). Last-write-wins conflict resolution. 30-day grace period on cancellation.
12. ~~**Convention data source**~~ — **Decided: Hybrid.** Admin-curated convention directory in Supabase (browse & add), plus user self-import via iCal/Sched URLs, plus manual entry. Most furry cons use Sched which provides iCal feeds.

---

## README.md Template

Copy this into `README.md` after initializing the Expo project.

````markdown
# ConPaws

Navigate, Connect, Enjoy.

A convention companion app for the furry community -- manage your convention schedule, track panels, set reminders for meetups, and share it all with friends. Built with a local-first approach: everything works offline with zero login required. Pay only when you want cloud sync and social features.

Built with modern native technologies for a smooth, native-feeling experience on every platform.

## Features

- **Conventions** -- Add and manage conventions with start/end dates, status tracking (upcoming/active/ended), and iCal import from Sched or .ics files.
- **Events** -- Track panels, meetups, and custom events within each convention with type indicators and shareable toggles.
- **Convention Directory** -- Browse an admin-curated list of furry conventions and add them to your schedule with one tap.
- **Profiles** -- Display name, @username, pronouns, bio, and avatar. Choose from 30+ built-in animal icons or upload a custom photo (ConPaws+).
- **ConPaws+** -- Premium subscription for cloud sync, schedule sharing, pride flag name effects, Find Friends, and the gold paw badge.
- **Badges** -- Gold paw (subscriber), blue checkmark (verified), and gold checkmark (developer).
- **Name Effects** -- Pride flag gradients on your display name with 12 flags to choose from (ConPaws+).
- **Offline First** -- Full functionality with no internet connection. Local SQLite database is the source of truth for free users.
- **Dark Mode** -- Automatic light/dark mode support across the entire app.
- **iPad Optimized** -- Responsive layouts with master-detail split view on larger screens.

## Tech Stack

- **Framework:** Expo SDK 54 with React Native 0.81 (New Architecture)
- **Navigation:** Expo Router v6 with native tabs and file-based routing
- **Styling:** NativeWind v5 (Tailwind CSS v4) with light/dark mode support
- **Local Database:** expo-sqlite with Drizzle ORM
- **Backend:** Supabase (self-hosted on Coolify) -- PostgreSQL, Auth, Storage, Edge Functions
- **Storage:** Cloudflare R2 via Supabase Storage (S3-compatible, zero egress)
- **Payments:** RevenueCat for subscription management
- **Data Fetching:** TanStack React Query
- **Icons:** Lucide React Native
- **Testing:** Vitest
- **CI/CD:** GitHub Actions (lint + type-check + tests)
- **Crash Reporting:** Sentry
- **Localization:** i18next (English primary, community translations)
- **Monorepo:** pnpm workspaces
- **Platforms:** iOS, iPadOS, Android

## Project Structure

```
conpaws/
├── apps/
│   └── mobile/              # Expo React Native app
│       ├── src/
│       │   ├── app/         # Expo Router (file-based screens)
│       │   ├── components/  # UI components
│       │   ├── contexts/    # React contexts
│       │   ├── hooks/       # Custom hooks
│       │   ├── lib/         # Utilities, constants, clients
│       │   ├── db/          # Drizzle schema + migrations
│       │   ├── types/       # TypeScript types
│       │   └── assets/      # Images, icons
│       └── app.config.ts
├── apps/
│   └── web/               # Next.js site (marketing, sharing, legal) — hosted on Coolify
├── packages/
│   └── supabase/            # Supabase config + migrations
├── pnpm-workspace.yaml
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 20.x or later
- pnpm 9.x
- Xcode (for iOS development)
- Android Studio (for Android development)
- Docker (for local Supabase via Supabase CLI)

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/MrDemonWolf/conpaws.git
   cd conpaws
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.example .env.development
   ```

4. Configure your environment variables in `.env.development`

5. Start local Supabase (requires Docker):

   ```bash
   pnpm supabase:start
   ```

6. Start the development server:

   ```bash
   pnpm dev
   ```

### Development Scripts

- `pnpm dev` -- Start Expo dev server
- `pnpm ios` -- Run on iOS simulator
- `pnpm android` -- Run on Android emulator
- `pnpm lint` -- Run ESLint across all packages
- `pnpm type-check` -- Run TypeScript type checking
- `pnpm test` -- Run unit tests with Vitest
- `pnpm supabase:start` -- Start local Supabase instance
- `pnpm supabase:stop` -- Stop local Supabase instance
- `pnpm supabase:reset` -- Reset local database with migrations + seed
- `pnpm prebuild` -- Generate native projects
- `pnpm prebuild:clean` -- Clean and regenerate native projects

### Environment Files

| File | Purpose |
|------|---------|
| `.env.development` | Local dev (Supabase CLI, sandbox RevenueCat) |
| `.env.preview` | Staging builds (dev.conpaws.com) |
| `.env.production` | App Store releases (api.conpaws.com) |

### Code Quality

This project uses:

- **ESLint** for code linting
- **TypeScript** (strict mode) for type safety
- **React Compiler** for automatic optimization
- **Typed Routes** for compile-time route checking
- **Vitest** for unit testing
- **Drizzle ORM** for type-safe database access
- **PostgreSQL Enums** for database-level type safety
- **Sentry** for crash reporting and error tracking

## Building

Development and preview builds run locally to conserve EAS build credits. Production builds use [EAS Build](https://docs.expo.dev/build/introduction/).

```bash
# Development (local)
eas build --profile development --local

# Preview / TestFlight (local)
eas build --profile preview --local

# Production (EAS cloud)
eas build --profile production

# Submit to App Store
eas submit --platform ios --profile production

# Submit to Play Store
eas submit --platform android --profile production
```

## License

![GitHub license](https://img.shields.io/github/license/MrDemonWolf/conpaws.svg?style=for-the-badge&logo=github)

## Contact

If you have any questions, suggestions, or feedback, feel free to reach out!

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with <3 by <a href="https://www.mrdemonwolf.com">MrDemonWolf, Inc.</a>
````

---

*This is a living document. Update as decisions are made.*
