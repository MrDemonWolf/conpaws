# ConPaws

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/MrDemonWolf/conpaws/blob/main/LICENSE)

ConPaws is an open source furry convention companion app built by [MrDemonWolf](https://github.com/MrDemonWolf), coming soon to the Apple App Store and Google Play Store. Feel free to fork it and adapt it for your own conventions or fandom community.

## What it does

- **Local-first** — all core features work offline on iOS, Android, and Web
- **Import schedules** — pull in convention events via iCal files or Sched.com URLs
- **Build your schedule** — mark events you want to attend and get reminders
- **ConPaws+** — premium features via RevenueCat (Phase 3+)

## Project Structure

```
conpaws/
├── apps/mobile/   # Expo React Native app (iOS, Android, Web)
├── apps/web/      # Next.js static site → conpaws.com
├── apps/server/   # Hono API → api.conpaws.com (Cloudflare Workers)
└── apps/docs/     # Fumadocs → docs.conpaws.com
```

## Getting Started

```bash
bun install
```

### Mobile app (`apps/mobile`)

```bash
bun start            # Start Expo dev server (development variant)
bun start:preview    # Start Expo dev server (preview variant)
bun start:prod       # Start Expo dev server (production variant)
bun android          # Run on Android
bun ios              # Run on iOS
bun web              # Run web version
bun lint             # Run ESLint
bun type-check       # Run TypeScript type checking
bun test             # Run tests (Vitest)
bun prebuild         # Generate native projects
bun prebuild:clean   # Clean and regenerate native projects
```

## Want to use this for your own fandom?

Fork it. The app is built to be self-hostable — swap in your own Supabase instance, configure your RevenueCat keys, and point it at your conventions. The iCal import works with any standard `.ics` file, so it should work with most convention schedule tools out of the box.
