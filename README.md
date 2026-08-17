# ConPaws - Navigate, Connect, Enjoy

ConPaws is a convention companion app for the furry community — manage
your convention schedule, track panels, set reminders for meetups, and
optionally share it all with friends. It is built local-first: everything
works offline with zero login required, because con WiFi is a myth. The
project is currently pre-release; the monorepo holds the Expo mobile app,
the Next.js website, and the planning docs that drive development.

Never miss a panel again.

## Features

- **Offline First** - Full convention management with no internet
  connection. The local SQLite database is the source of truth for free
  users.
- **iCal Import** - Import a convention schedule from a `.ics` file or a
  Sched URL, then safely re-import updates and cancellations.
- **Conventions and Events** - Track conventions with status detection
  (upcoming/active/ended), pick simultaneous or overlapping events, and
  view the schedule in the convention's timezone.
- **Local Reminders** - Schedule per-event reminders that work without a
  ConPaws account or push server.
- **ConPaws+** - Premium subscription via RevenueCat for cloud sync,
  schedule sharing, badges, and pride flag name effects (planned).
- **Cloud Sync** - Polling-based sync against a Cloudflare Workers API
  with D1 storage — no accounts required for core features (planned).
- **Website and Waitlist** - The marketing site and waitlist are prepared
  for Cloudflare Workers, but production routes are intentionally disabled.
  The website has not launched yet.
- **Dark Mode** - Automatic light/dark theme support across the app.

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/MrDemonWolf/conpaws.git
   cd conpaws
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Start everything in development mode:

   ```bash
   bun dev
   ```

   The web app serves at `http://localhost:3001`; the Expo dev server
   starts for the native app.

## Tech Stack

| Layer            | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Mobile app       | Expo SDK 57, React Native 0.86, React 19.2, Expo Router             |
| Styling          | NativeWind v5 (Tailwind CSS v4), native component primitives     |
| Local database   | expo-sqlite with Drizzle ORM                                     |
| Backend (target) | Cloudflare Workers — Hono, tRPC, Better-Auth                     |
| Cloud database   | Cloudflare D1 (SQLite) with Drizzle ORM                          |
| File storage     | Cloudflare R2 (zero egress)                                      |
| Website          | Next.js 16.2.12 on Cloudflare Workers via OpenNext               |
| Payments         | RevenueCat (planned)                                             |
| Crash reporting  | Sentry (planned)                                                 |
| Monorepo         | bun workspaces, Turborepo, Biome                                 |

## Development

### Prerequisites

- bun (repo pins `bun@1.3.10`)
- Node.js `22.13.1` (pinned in `.node-version`)
- Xcode (for iOS development)
- Android Studio (for Android development)

### Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment example and fill in values:

   ```bash
   cp .env.example .env
   ```

   Note: `.env` files are local-development-only. EAS builds read EAS
   Environment Variables (`eas env:pull`), and Cloudflare Workers read
   bindings from `wrangler.jsonc` plus `wrangler secret`.

3. Start the dev servers:

   ```bash
   bun dev
   ```

### Development Scripts

All scripts run from the repo root and fan out through Turborepo:

- `bun dev` - Start web and native in development mode
- `bun dev:web` - Start only the Next.js app (`http://localhost:3001`)
- `bun dev:native` - Start only the Expo dev server
- `bun start` / `bun start:preview` / `bun start:prod` - Expo dev server
  per app variant
- `bun android` / `bun ios` - Run on emulator/simulator
- `bun web` - Run the Expo app's web target
- `bun build` - Build all applications and packages
- `bun lint` - Run Biome (`biome check .`)
- `bun check-types` - TypeScript type checking across all packages
- `bun test` - Run the Vitest suites across the workspace
- `bun prebuild` / `bun prebuild:clean` - Generate native projects

### Code Quality

- TypeScript in strict mode across every package
- Biome for linting and formatting (no ESLint in this repo)
- CI gates pull requests with lint, type checks, unit tests, web build
  checks, Expo Doctor, native prebuild, and native export checks
- Vitest coverage for database migration/reconciliation, ICS and timezone
  behavior, reminders, backup import, schedule selection, and web APIs

### Mobile Releases and OTA Updates

Store releases remain operator-controlled. EAS creates signed production
IPA/AAB artifacts, then the exact tested artifacts are uploaded to TestFlight
and Play Internal Testing and promoted manually. There is no auto-submit.

- [Mobile release guide](apps/native/RELEASING.md)
- [Self-hosted OTA decision guide](notes/ota-updates.md)

OTA updates are required for the MVP. The selected path is signed
[xprem 3.1.1](https://github.com/mercuretechnologies/xprem) hosted on Dokploy,
not EAS Update. The app now meets the Expo SDK 57 prerequisite, but OTA remains
fail-closed until the signed staging path passes cold-start, offline-start, and
rollback tests on physical iOS and Android devices. No OTA service has been
deployed or enabled in a production binary yet.

## Project Structure

```
conpaws/
├── apps/
│   ├── native/      # Expo React Native app (routes in app/, not src/app)
│   ├── web/         # Next.js site on Cloudflare Workers via OpenNext
│   └── server/      # (planned) Hono + tRPC + Better-Auth Worker
├── packages/
│   ├── config/      # Shared tsconfig base
│   ├── env/         # Zod-validated environment schemas
│   └── ui/          # Shared shadcn/ui components and styles
├── notes/           # Planning docs (plan.md is the technical blueprint)
└── test-data/       # iCal fixtures for import development
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/conpaws.svg?style=for-the-badge&logo=github)

## Contact

If you have any questions, suggestions, or feedback, feel free to reach
out!

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
