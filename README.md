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
- **Pooled Schedule** - The Schedule tab gathers starred events from every
  saved convention into one day-grouped list.
- **Local Reminders** - Schedule per-event reminders that work without a
  ConPaws account or push server.
- **Backup and Restore** - Export and re-import your conventions and
  events as a file you control.
- **Home Screen and Lock Screen Widgets** - Convention countdown, next
  event, and leave reminders in the small and medium Home Screen families
  plus all three Lock Screen families.
- **Apple Watch** - A watchOS app and a Smart Stack complication, fed by
  the same cached schedule as the widgets.
- **ConPaws+** - Premium subscription via RevenueCat for cloud sync,
  schedule sharing, badges, and pride flag name effects (planned).
- **Cloud Sync** - Polling-based sync against a Cloudflare Workers API
  with D1 storage — no accounts required for core features (planned).
- **Website and Waitlist** - The marketing site and waitlist are prepared
  for Cloudflare Workers. Production routes are intentionally disabled and
  the public signup form is closed; the website has not launched yet.
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

| Layer             | Technology                                                   |
| ----------------- | ------------------------------------------------------------ |
| Mobile app        | Expo SDK 57, React Native 0.86, React 19.2, Expo Router      |
| Styling           | NativeWind v5 (Tailwind CSS v4), native component primitives |
| Local database    | expo-sqlite with Drizzle ORM                                 |
| Backend (target)  | Cloudflare Workers — Hono, tRPC, Better-Auth                 |
| Cloud database    | Cloudflare D1 (SQLite) with Drizzle ORM                      |
| File storage      | Cloudflare R2 (zero egress)                                  |
| Website           | Next.js 16.2.12 on Cloudflare Workers via OpenNext           |
| Infrastructure    | Alchemy — D1, Worker bindings and secrets, cron              |
| Bot protection    | Cloudflare Turnstile (server-side siteverify)                |
| Widgets and Watch | WidgetKit and SwiftUI via @bacons/apple-targets              |
| Payments          | RevenueCat (planned)                                         |
| Crash reporting   | Sentry — wired up; the production DSN is not yet set         |
| Monorepo          | bun workspaces, Turborepo, Biome                             |

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
   Environment Variables (`eas env:pull`). Cloudflare Workers read their
   bindings and secrets from `packages/infra/alchemy.run.ts` at deploy
   time — `apps/web/wrangler.jsonc` is local development and CI preview
   only, and is never used to deploy.

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
- `bun lint:fix` - Run Biome with `--write`
- `bun format` - Format with Biome
- `bun check-types` - TypeScript type checking across all packages
- `bun test` - Run the Vitest suites across the workspace
- `bun prebuild` / `bun prebuild:clean` - Generate native projects
- `bun run deploy` / `bun run destroy` - Apply or tear down the Alchemy
  stack
- `bun run infra:dev` - Run the Alchemy stack in development
- `bun run db:generate` - Generate Drizzle migrations for the web D1
  database
- `bun run db:migrate:local` - Apply those migrations to the local D1

### Code Quality

- TypeScript in strict mode across every package
- Biome for linting and formatting (no ESLint in this repo)
- CI gates pull requests with lint, type checks, unit tests, web build
  checks, Expo Doctor, native prebuild, and native export checks
- Vitest coverage for database migration/reconciliation, ICS and timezone
  behavior, reminders, backup import, schedule selection, and web APIs

### Website Deployment

Production is owned by Alchemy (`packages/infra/alchemy.run.ts`), which
provisions the D1 database, both Workers, their bindings, and the hourly
reconciler cron from one typed program.

Deploys run from CI on a push to `main`, gated behind two repository
variables and a manual approval on the `production` environment:

- `PRODUCTION_DEPLOY_ENABLED` - the master switch; nothing deploys while
  it is `false`
- `PRODUCTION_ROUTES_ENABLED` - attaches `conpaws.com` (with
  `www.conpaws.com` redirecting to it). Deploy with this `false` first so
  Cloudflare holds a known-good version before the apex points anywhere

There is no automatic rollback. Roll back by hand:

```bash
cd apps/web && bunx wrangler rollback
```

The full going-live runbook lives on the **Prerelease Site** page in Notion.

### Mobile Releases and OTA Updates

Store releases remain operator-controlled. EAS creates signed production
IPA/AAB artifacts, then the exact tested artifacts are uploaded to
TestFlight and Play Internal Testing and promoted manually. There is no
auto-submit.

- [Mobile release guide](apps/native/RELEASING.md)
- Self-hosted OTA decision guide — **OTA Updates** page in Notion
- [Dokploy xprem deployment runbook](infra/xprem/README.md)

OTA updates are required for the MVP. The selected path is signed
[xprem 3.1.1](https://github.com/mercuretechnologies/xprem) hosted once for
MrDemonWolf, Inc. at `updates.mrdemonwolf.com`, not EAS Update. ConPaws
receives its own xprem app UUID, signing material, branches/channels,
publisher token, and runtime inside that shared control plane. The app
meets the Expo SDK 57 prerequisite, but OTA remains fail-closed until
signed staging passes cold-start, offline-start, and rollback tests on
physical iOS and Android devices. The deployment bundle is ready, but no
service is deployed or enabled in a store binary.

## Project Structure

```
conpaws/
├── apps/
│   ├── native/      # Expo React Native app (routes in app/, not src/app)
│   │   ├── targets/ # Widget, Watch app, and Watch complication (Swift)
│   │   └── modules/ # Local Expo module bridging the App Group and Watch
│   ├── web/         # Next.js site on Cloudflare Workers via OpenNext
│   │   └── workers/ # Hourly waitlist reconciler (a separate Worker)
│   └── server/      # (planned) Hono + tRPC + Better-Auth Worker
├── packages/
│   ├── config/      # Shared tsconfig base
│   ├── env/         # Zod environment schemas
│   ├── infra/       # Alchemy — D1, Worker bindings and secrets, cron
│   └── ui/          # Shared shadcn/ui components and styles
├── docs/            # Widget and Watch design docs and mockups
├── infra/
│   ├── listmonk/    # Shared mailing list descriptor (not deployed)
│   └── xprem/       # xprem OTA descriptor and runbook (not deployed)
└── test-data/       # iCal fixtures for import development
```

## License

![GitHub license](https://img.shields.io/github/license/mrdemonwolf/conpaws.svg?style=for-the-badge&logo=github)

ConPaws is free software licensed under the **GNU General Public License v3.0
or later** (see [LICENSE](LICENSE)). Copyright © 2026 MrDemonWolf, Inc.

**Apple App Store / Google Play additional permission (GPLv3 §7).** As an
additional permission under section 7 of the GPLv3, MrDemonWolf, Inc. grants
permission to convey the Program (or a work based on it) through the Apple App
Store, the Mac App Store, and Google Play, notwithstanding the additional terms
imposed by Apple's Usage Rules, Google Play's Terms of Service, or comparable
app store terms that would otherwise be incompatible with the GPLv3. This
permission applies to verbatim copies and to copies whose only modifications
are those reasonably necessary for app store distribution.

**Names and logos are not covered by the GPL.** The GPL grants rights to the
code, not to the project's identity. The names "ConPaws" and "MrDemonWolf,"
the wolf mark, and the associated logos are not licensed along with it. If you
fork and redistribute, please use a different name and logo — you are welcome
to say your build is "based on ConPaws".

## Contact

If you have any questions, suggestions, or feedback, feel free to reach
out!

- Discord: [Join my server](https://mrdwolf.net/discord)

Made with love by [MrDemonWolf, Inc.](https://www.mrdemonwolf.com)
