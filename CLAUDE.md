# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConPaws is an Expo/React Native mobile application — a furry convention companion app. It targets **Android, iOS, and Web**. The app is **local-first** (all core features work offline). Premium features ("ConPaws+") are powered by RevenueCat. Auth and profiles are stored in a self-hosted Supabase instance.

It uses app variants (`development`, `preview`, `production`) controlled via the `APP_VARIANT` environment variable, with bundle ID `com.mrdemonwolf.conpaws` (production) / `com.mrdemonwolf.conpaws.dev` (development).

## Development Commands

```bash
pnpm install              # Install dependencies (uses hoisted node linker)
pnpm start                # Start dev server (development variant)
pnpm start:preview        # Start dev server (preview variant)
pnpm start:prod           # Start dev server (production variant)
pnpm android              # Run on Android (development)
pnpm ios                  # Run on iOS (development)
pnpm web                  # Run web version
pnpm lint                 # Run ESLint
pnpm type-check           # Run TypeScript type checking
pnpm test                 # Run tests (Vitest)
pnpm prebuild             # Generate native projects (development)
pnpm prebuild:clean       # Clean and regenerate native projects
```

## Architecture

- **Framework:** Expo SDK 54 with React Native and React 18
- **Routing:** Expo Router v4 (file-based routing in `src/app/`)
- **Styling:** NativeWind v4 (Tailwind CSS v4 for React Native) with `clsx` and `tailwind-merge`
- **Local Database:** expo-sqlite with Drizzle ORM
- **Data Fetching:** TanStack React Query
- **i18n:** i18next + react-i18next with expo-localization
- **Testing:** Vitest
- **Auth:** Supabase (Google OAuth + Apple Sign-In) — Phase 2
- **Payments:** RevenueCat (in-app subscriptions for "ConPaws+") — Phase 3
- **Website:** Next.js on Coolify (same VPS as Supabase) — Phase 4
- **Language:** TypeScript with strict mode
- **Package Manager:** pnpm workspaces (monorepo with `nodeLinker: hoisted`)
- **Entry Point:** `expo-router/entry` (configured in package.json `main`)

### Monorepo Structure

```
conpaws/
├── apps/mobile/        # Expo React Native app (MVP focus)
│   └── src/
│       ├── app/        # Expo Router (file-based screens)
│       ├── components/ # UI components
│       ├── contexts/   # React contexts
│       ├── hooks/      # Custom hooks
│       ├── lib/        # Utilities, constants, i18n, parsers
│       ├── db/         # Drizzle schema + repositories
│       ├── types/      # TypeScript types
│       ├── locales/    # i18n translation files
│       ├── assets/     # Images, icons
│       └── global.css  # Tailwind CSS entry point + design tokens
├── apps/web/           # Next.js site (placeholder until Phase 4)
├── packages/supabase/  # Supabase config + migrations (Phase 2)
└── pnpm-workspace.yaml
```

### Key Configuration (apps/mobile/)

- **app.config.ts** — Dynamic Expo config with variant-based bundle IDs and icons
- **eas.json** — EAS Build configuration for production builds
- **metro.config.js** — Metro bundler with NativeWind wrapper
- **postcss.config.mjs** — PostCSS with `@tailwindcss/postcss` plugin
- **tsconfig.json** — Extends `expo/tsconfig.base`, path alias `@/*` maps to `./src/*`
- **drizzle.config.ts** — Drizzle Kit config for migration generation
- **vitest.config.ts** — Vitest config with `@/` alias resolution

### Environment Variables

Required in `.env.local`:
- `EXPO_PUBLIC_SUPABASE_URL` — Self-hosted Supabase URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` — RevenueCat Apple API key (optional)
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` — RevenueCat Google API key (optional)

### Experimental Features Enabled

- `reactCompiler: true` — React Compiler for automatic memoization
- `typedRoutes: true` — Type-safe routing with Expo Router

### App Variants

The `APP_VARIANT` env var controls build configuration:
- `development` (default) — Bundle ID: `com.mrdemonwolf.conpaws.dev`
- `preview` — Bundle ID: `com.mrdemonwolf.conpaws.preview`
- `production` — Bundle ID: `com.mrdemonwolf.conpaws`

### App Flow

1. **Root layout** (`_layout.tsx`) wraps the app in ColorSchemeProvider > QueryClientProvider > OnboardingProvider
2. **Onboarding gate:** If onboarding not complete, redirects to `(onboarding)/welcome`
3. **Onboarding flow:** welcome → features → auth (skip for now) → complete
4. **Main app:** Tab navigation with Home (convention list), Profile (placeholder), Settings
5. Conventions are stored locally (expo-sqlite via Drizzle ORM). Profiles sync to Supabase (Phase 2+).

### Screen Structure

```
src/app/
├── _layout.tsx                     # Root: providers, splash, routing
├── index.tsx                       # Redirect to (tabs)
├── (onboarding)/
│   ├── _layout.tsx                 # Stack
│   ├── welcome.tsx                 # Logo + Get Started
│   ├── features.tsx                # Feature cards
│   ├── auth.tsx                    # Placeholder auth + Skip
│   └── complete.tsx                # Success + Let's Go
├── (tabs)/
│   ├── _layout.tsx                 # Tab bar (Home, Profile, Settings)
│   ├── index.tsx                   # Convention list + empty state
│   ├── profile.tsx                 # Placeholder
│   └── settings.tsx                # Theme, export/import, legal, reset
├── convention/
│   ├── _layout.tsx                 # Stack
│   ├── new.tsx                     # Create convention form
│   ├── import.tsx                  # File picker or Sched URL
│   ├── import-preview.tsx          # Event selection + import
│   ├── [id].tsx                    # Convention detail + events
│   └── [id]/
│       ├── edit.tsx                # Edit convention
│       └── event/
│           ├── new.tsx             # Create event form
│           └── [eventId]/
│               ├── index.tsx       # Event detail
│               └── edit.tsx        # Edit event
└── settings/
    ├── _layout.tsx                 # Stack
    └── about.tsx                   # About screen
```

### iOS-First File Convention

- Default `.tsx` = iOS/Web rendering
- `.android.tsx` = Android-specific UI variant (add when UI needs to diverge)
- React Native resolves the correct file per platform at build time

### Database Schema

Two main tables in SQLite via Drizzle ORM:
- **conventions** — id, name, startDate, endDate, icalUrl, status, timestamps
- **convention_events** — id, conventionId (FK cascade), title, description, times, location, room, category, type, flags (shareable, ageRestricted, contentWarning), schedule state (isInSchedule, reminderMinutes), source tracking (sourceUid, sourceUrl), timestamps
- **offline_queue** — reserved for Phase 2+ cloud sync

### iCal Import

Core feature: import .ics files and Sched convention URLs.
- `src/lib/ical-parser.ts` — parses VEVENT components, extracts room/venue from location, detects 18+ content and strobe/flash warnings
- `src/lib/sched-url.ts` — validates Sched URLs, constructs .ics download URL
- Re-import matches by `sourceUid` to avoid duplicates, preserves user schedule state

## Planning Notes

All planning and design documents live in `notes/` — these are **temporary pre-development docs**, not shipped code.

| File | What's Inside |
|------|--------------|
| `notes/plan.md` | Full technical blueprint — tech stack, data models, screens, sync architecture, iCal import, dev phases |
| `notes/marketing.md` | Marketing strategy — website, social media, YouTube, profitability projections |
| `notes/pitchdeck.md` | Market research — fandom stats, convention data, competitive analysis (Barq), revenue projections |
| `notes/ideas.md` | Future feature brainstorms + pre-launch gap analysis |
| `notes/legal.md` | Privacy Policy and Terms of Service templates + App Store compliance checklist |

Each file has a **TL;DR** at the top for quick scanning. `plan.md` also has a table of contents.

Test data for iCal import development lives in `test-data/`:
- `test-data/indyfurcon2025.ics` — Real convention data (IndyFurCon 2025, 16 events)
- `test-data/small-test.ics` — Clean test fixture (10 events, 3-day fictional con)
