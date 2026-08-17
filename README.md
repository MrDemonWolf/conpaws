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
- **iCal Import** - Import any convention's schedule from a `.ics` file
  or a Sched URL. No convention partnership required (planned).
- **Conventions and Events** - Track conventions with status detection
  (upcoming/active/ended), panels, meetups, and custom events (planned).
- **ConPaws+** - Premium subscription via RevenueCat for cloud sync,
  schedule sharing, badges, and pride flag name effects (planned).
- **Cloud Sync** - Polling-based sync against a Cloudflare Workers API
  with D1 storage — no accounts required for core features (planned).
- **Website and Waitlist** - Marketing site and pre-release waitlist at
  [conpaws.com](https://conpaws.com), deployed to Cloudflare Workers.
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
| Mobile app       | Expo SDK 55 (target: SDK 57), React Native, Expo Router          |
| Styling          | NativeWind v5 (Tailwind CSS v4), shared shadcn/ui primitives     |
| Local database   | expo-sqlite with Drizzle ORM (planned)                           |
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
- `bun test` - Run unit tests (Vitest — planned, no tests yet)
- `bun prebuild` / `bun prebuild:clean` - Generate native projects

### Code Quality

- TypeScript in strict mode across every package
- Biome for linting and formatting (no ESLint in this repo)
- Turborepo-driven CI: lint + type-check on every pull request
- Vitest for unit tests (planned alongside the first business logic)

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
