# ConPaws - Gemini CLI Context

This project is a modern TypeScript monorepo built for the **ConPaws** convention companion app. It is an offline-first mobile application designed for the furry community to manage convention schedules, track panels, and share experiences.

## Project Overview

- **Architecture:** Monorepo managed by **bun workspaces** and **Turborepo**.
- **Mobile App (`apps/native`):** Built with **Expo (SDK 55; upgrade target SDK 57)** and **React Native (0.83)**. It uses **Expo Router** (routes live in top-level `app/`, not `src/app/`) and will use **expo-sqlite** with **Drizzle ORM** for offline-first data (planned — `src/db/` is empty today).
- **Web App (`apps/web`):** A **Next.js** site (16.2.12, pinned exactly — do not upgrade; Next 16.3 + OpenNext has a known prefetch-loop bug) deployed to **Cloudflare Workers via OpenNext** for marketing, the waitlist, legal pages, and public profile/convention previews.
- **Shared UI (`packages/ui`):** A collection of shadcn-inspired components using **Tailwind CSS v4** and **NativeWind v5** for cross-platform styling.
- **Data & Sync (planned):** A **Cloudflare Worker** backend (`apps/server`) with **Hono + tRPC + Better-Auth** for authentication, and **Cloudflare D1** for cloud synchronization (premium feature). Sync is polling-based — no realtime layer. **RevenueCat** manages subscriptions.

## Tech Stack

- **Frameworks:** React 19, Next.js, Expo.
- **Styling:** Tailwind CSS v4, NativeWind v5 (v5.0.0-preview.2).
- **State & Data:** TanStack Query v5, Drizzle ORM, expo-sqlite (planned).
- **Backend (planned):** Cloudflare Workers (Hono, tRPC, Better-Auth), Cloudflare D1, Cloudflare R2. No RLS — authorization lives in the Worker/tRPC layer.
- **Lint/Format:** Biome (repo root `biome.json`) — no ESLint.
- **Testing:** Vitest (planned — no test files exist yet).
- **Monorepo:** bun, Turborepo.

## Building and Running

### Prerequisites

- **bun** installed globally (repo pins `bun@1.3.10`).
- **iOS Simulator** or **Android Emulator** (for mobile development).

### Key Commands

- `bun install`: Install all dependencies across the monorepo.
- `bun dev`: Start both the web and native applications in development mode.
- `bun dev:web`: Start only the Next.js application (accessible at `http://localhost:3001`).
- `bun dev:native`: Start the Expo development server.
- `bun build`: Build all applications and packages.
- `bun lint`: Run Biome (`biome check .`).
- `bun check-types`: Run TypeScript type-checking across the entire project.
- `bun test`: Run unit tests via Turbo (Vitest — once tests exist).

## Project Structure

- `apps/native`: The primary React Native/Expo application.
  - `app/`: Expo Router routes (top level — currently only `_layout.tsx` and `index.tsx`).
  - `src/lib`: Utilities (`cn()` helper); `src/global.css` is the Tailwind entry point.
  - `src/db`, `src/components/ui`, `src/locales`, etc.: empty placeholders (planned).
  - `tsconfig.json`: path alias `@/*` maps to `./*`.
- `apps/web`: Next.js marketing/waitlist site (OpenNext + `wrangler.jsonc` for Cloudflare deploys).
- `packages/ui`: Shared UI primitives and Tailwind configuration.
- `packages/env`: Zod-validated environment variable schemas (`EXPO_PUBLIC_SERVER_URL` for native).
- `packages/config`: Shared TSConfig.
- `notes/`: Project planning, legal, and marketing documentation (`notes/plan.md` is the blueprint).

## Development Conventions

- **Shared UI:** Prefer adding reusable web components to `packages/ui`. Use the `cn()` utility (clsx + tailwind-merge) for styling.
- **Styling:** Use Tailwind CSS utility classes. For mobile, NativeWind v5 allows Tailwind v4 classes directly in `className`.
- **Data Management:** Follow an offline-first approach. All convention data lives in the local SQLite database via Drizzle ORM; premium cloud sync polls the tRPC API and merges into the local mirror.
- **Authorization:** D1 has no row-level security — every server-side query must be ownership-scoped in the tRPC procedure.
- **Environment Variables:** Use `@conpaws/env` to access validated environment variables. `.env` files are local-dev-only; EAS builds use EAS Environment Variables, Workers use bindings/secrets. Never hardcode secrets.
- **Testing:** Add unit tests for business logic (iCal parsing, database operations, sync engine) in `apps/native` using Vitest.
- **Git:** Follow a feature-branch workflow. Ensure `bun check-types` and `bun lint` pass before committing.
