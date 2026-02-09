# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConPaws is an Expo/React Native mobile application — a furry convention companion app. It targets **Android, iOS, and Web**. The app is **local-first** (all core features work offline). Premium features ("Paw Pass") are powered by RevenueCat. Auth and profiles are stored in a self-hosted Supabase instance.

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
pnpm prebuild             # Generate native projects (development)
pnpm prebuild:clean       # Clean and regenerate native projects
```

## Architecture

- **Framework:** Expo SDK 54 with React Native 0.81 and React 19
- **Routing:** Expo Router v6 (file-based routing in `src/app/`)
- **Styling:** NativeWind v5 (Tailwind CSS v4 for React Native) with `clsx` and `tailwind-merge`
- **Auth:** Supabase (Google OAuth + Apple Sign-In)
- **Payments:** RevenueCat (in-app subscriptions for "Paw Pass")
- **Data:** TanStack React Query with AsyncStorage persistence via `expo-sqlite`
- **Language:** TypeScript with strict mode
- **Package Manager:** pnpm (workspace configured with `nodeLinker: hoisted`)
- **Entry Point:** `expo-router/entry` (configured in package.json `main`)

### Project Structure

All source code lives under `src/`:
- `src/app/` — File-based routing (Expo Router screens and layouts)
- `src/app/(onboarding)/` — Onboarding flow (welcome, features, auth, complete)
- `src/app/(tabs)/` — Main tab navigation (Home, Profile, Settings)
- `src/components/ui/` — Reusable UI components (Button, Card, Avatar, Badge, Input)
- `src/contexts/` — React contexts (AuthContext, OnboardingContext, PremiumContext)
- `src/hooks/` — Custom hooks (useAuth, useOnboarding, usePremium, useConventions)
- `src/lib/` — Utilities (cn helper, constants, Supabase client)
- `src/types/` — Shared TypeScript types (Profile, Convention, etc.)
- `src/assets/` — Images, icons, and static assets
- `src/global.css` — Tailwind CSS entry point (imported in root layout)

### Key Configuration

- **app.config.ts** — Dynamic Expo config with variant-based bundle IDs and icons
- **eas.json** — EAS Build configuration for production builds
- **metro.config.js** — Metro bundler with NativeWind integration
- **postcss.config.mjs** — PostCSS with `@tailwindcss/postcss` plugin
- **tsconfig.json** — Extends `expo/tsconfig.base`, path alias `@/*` maps to `./src/*`

### Environment Variables

Required in `.env.local`:
- `EXPO_PUBLIC_SUPABASE_URL` — Self-hosted Supabase URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` — RevenueCat Apple API key (optional)
- `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` — RevenueCat Google API key (optional)

### Experimental Features Enabled

- `newArchEnabled: true` — React Native New Architecture (TurboModules, Fabric)
- `reactCompiler: true` — React Compiler for automatic memoization
- `typedRoutes: true` — Type-safe routing with Expo Router

### App Variants

The `APP_VARIANT` env var controls build configuration:
- `development` (default) — Bundle ID: `com.mrdemonwolf.conpaws.dev`
- `production` — Bundle ID: `com.mrdemonwolf.conpaws`

### App Flow

1. **Root layout** (`_layout.tsx`) wraps the app in OnboardingProvider > AuthProvider > PremiumProvider
2. **Onboarding gate:** If onboarding not complete, redirects to `(onboarding)/welcome`
3. **Onboarding flow:** welcome → features → auth (sign-in) → complete
4. **Main app:** Tab navigation with Home (convention list), Profile, Settings
5. Conventions are stored locally (AsyncStorage). Profiles sync to Supabase.

### iOS-First File Convention

- Default `.tsx` = iOS/Web rendering
- `.android.tsx` = Android-specific UI variant (add when UI needs to diverge)
- React Native resolves the correct file per platform at build time
