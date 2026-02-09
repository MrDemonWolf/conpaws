# ConPaws

A furry convention companion app built with Expo/React Native. Manage convention schedules, find events, and connect with friends — all offline-first.

**Targets:** iOS, Android, Web

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- For iOS: macOS with Xcode installed
- For Android: Android Studio with an emulator or physical device

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```bash
cp .env.example .env.local
```

Fill in the values:

```env
# Supabase (self-hosted)
EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-instance.com
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# RevenueCat (in-app purchases)
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=your-apple-api-key
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=your-google-api-key
```

### 3. Start the dev server

```bash
pnpm start             # Development variant
pnpm start:preview     # Preview variant
pnpm start:prod        # Production variant
```

### 4. Run on a platform

```bash
pnpm ios               # iOS simulator (development)
pnpm android           # Android emulator (development)
pnpm web               # Web browser
```

> **Note:** RevenueCat requires a development build (`expo-dev-client`), not Expo Go. Use `pnpm prebuild` to generate native projects, then build with EAS or locally.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Your self-hosted Supabase instance URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` | No* | RevenueCat Apple API key (for iOS in-app purchases) |
| `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` | No* | RevenueCat Google API key (for Android in-app purchases) |

\* RevenueCat keys are only required for premium subscription features (Paw Pass). The app works without them — premium features are gracefully disabled.

## App Variants

The `APP_VARIANT` environment variable controls build configuration:

| Variant | Bundle ID | Usage |
|---|---|---|
| `development` (default) | `com.mrdemonwolf.conpaws.dev` | Local development |
| `preview` | `com.mrdemonwolf.conpaws.dev` | TestFlight / Internal Testing |
| `production` | `com.mrdemonwolf.conpaws` | App Store / Play Store |

## Project Structure

```
src/
├── app/                        # Expo Router file-based routing
│   ├── _layout.tsx             # Root layout (providers, onboarding gate)
│   ├── index.tsx               # Entry redirect
│   ├── (onboarding)/           # Onboarding flow
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── features.tsx
│   │   ├── auth.tsx
│   │   └── complete.tsx
│   └── (tabs)/                 # Main tab navigation
│       ├── _layout.tsx         # Tab bar (Home, Profile, Settings)
│       ├── index.tsx           # Home — convention list
│       ├── profile.tsx         # Profile screen
│       └── settings.tsx        # Settings screen
├── components/
│   └── ui/                     # Reusable UI components
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── contexts/                   # React contexts
│   ├── auth-context.tsx        # Supabase auth state
│   ├── onboarding-context.tsx  # Onboarding completion state
│   └── premium-context.tsx     # RevenueCat premium state
├── hooks/                      # Custom hooks
│   ├── use-auth.ts
│   ├── use-conventions.ts
│   ├── use-onboarding.ts
│   └── use-premium.ts
├── lib/                        # Utilities and config
│   ├── constants.ts            # Theme colors, storage keys
│   ├── supabase.ts             # Supabase client initialization
│   └── utils.ts                # cn() helper (clsx + tailwind-merge)
├── types/                      # Shared TypeScript types
│   └── index.ts
├── assets/                     # Images, icons, static files
└── global.css                  # Tailwind CSS entry point
```

## Scripts

| Command | Description |
|---|---|
| `pnpm start` | Start dev server (development variant) |
| `pnpm start:preview` | Start dev server (preview variant) |
| `pnpm start:prod` | Start dev server (production variant) |
| `pnpm ios` | Run on iOS simulator |
| `pnpm android` | Run on Android emulator |
| `pnpm web` | Run web version |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm prebuild` | Generate native projects (development) |
| `pnpm prebuild:clean` | Clean and regenerate native projects |

## Tech Stack

- **Framework:** Expo SDK 54, React Native 0.81, React 19
- **Routing:** Expo Router v6 (file-based, typed routes)
- **Styling:** NativeWind v5 (Tailwind CSS v4 for React Native)
- **Auth:** Supabase (Google OAuth + Apple Sign-In)
- **Payments:** RevenueCat (in-app subscriptions)
- **Data:** TanStack React Query + AsyncStorage + expo-sqlite
- **Language:** TypeScript (strict mode)
- **Package Manager:** pnpm

## Supabase Setup

ConPaws uses a self-hosted Supabase instance. You'll need these tables:

### `profiles` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, references `auth.users.id` |
| `username` | text | Unique, set once |
| `display_name` | text | |
| `avatar_url` | text | Nullable |
| `bio` | text | Max 256 chars |
| `pronouns` | text | Nullable |
| `verified` | boolean | Default `false`, admin-only |
| `created_at` | timestamptz | Default `now()` |

### `conventions` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `ical_url` | text | Nullable |

### `user_conventions` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | References `profiles.id` |
| `convention_id` | uuid | References `conventions.id` |

### Auth providers

Enable these in your Supabase dashboard (Authentication > Providers):
- **Google OAuth** — for Android users
- **Apple Sign-In** — for iOS users

Set the redirect URL to `conpaws://auth/callback` for both providers.

## RevenueCat Setup

1. Create a project at [RevenueCat](https://www.revenuecat.com/)
2. Add your App Store and Play Store apps
3. Create an entitlement called `paw_pass`
4. Create offerings with monthly ($2.99) and yearly ($19.99) products
5. Copy the platform API keys into your `.env.local`

## License

See [LICENSE](LICENSE) for details.
