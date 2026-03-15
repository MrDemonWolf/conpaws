# ConPaws - Gemini CLI Context

This project is a modern TypeScript monorepo built for the **ConPaws** convention companion app. It is an offline-first mobile application designed for the furry community to manage convention schedules, track panels, and share experiences.

## Project Overview

- **Architecture:** Monorepo managed by **bun workspaces** and **Turborepo**.
- **Mobile App (`apps/native`):** Built with **Expo (SDK 55)** and **React Native (0.83)**. It uses **Expo Router** for file-based navigation and **expo-sqlite** with **Drizzle ORM** for offline-first data management.
- **Web App (`apps/web`):** A **Next.js** site for marketing, legal pages, and public profile/convention previews.
- **Shared UI (`packages/ui`):** A collection of shadcn-inspired components using **Tailwind CSS v4** and **NativeWind v5** for cross-platform styling.
- **Data & Sync:** Uses **Supabase** (self-hosted via Coolify) for authentication and cloud synchronization (premium feature). **RevenueCat** manages subscriptions.

## Tech Stack

- **Frameworks:** React 19, Next.js, Expo.
- **Styling:** Tailwind CSS v4, NativeWind v5 (v5.0.0-preview.2).
- **State & Data:** TanStack Query v5, Drizzle ORM, expo-sqlite.
- **Backend:** Supabase (Auth, PostgreSQL, Storage), Cloudflare R2.
- **Testing:** Vitest.
- **Monorepo:** bun, Turborepo.

## Building and Running

### Prerequisites

- **bun** installed globally.
- **iOS Simulator** or **Android Emulator** (for mobile development).
- **Expo Go** app on a physical device (optional).

### Key Commands

- `bun install`: Install all dependencies across the monorepo.
- `bun dev`: Start both the web and native applications in development mode.
- `bun dev:web`: Start only the Next.js application (accessible at `http://localhost:3001`).
- `bun dev:native`: Start the Expo development server.
- `bun build`: Build all applications and packages.
- `bun check-types`: Run TypeScript type-checking across the entire project.
- `bun test`: Run unit tests in `apps/native` using Vitest.

## Project Structure

- `apps/native`: The primary React Native/Expo application.
  - `src/app`: Expo Router screens.
  - `src/db`: SQLite schema and migrations (Drizzle).
  - `src/components/ui`: Native UI components.
- `apps/web`: Next.js marketing and preview site.
- `packages/ui`: Shared UI primitives and Tailwind configuration.
- `packages/env`: Zod-validated environment variable schemas.
- `packages/config`: Shared TSConfig and linting rules.
- `notes/`: Project planning, legal, and marketing documentation.

## Development Conventions

- **Shared UI:** Prefer adding reusable components to `packages/ui`. Use the `cn()` utility (clsx + tailwind-merge) for styling.
- **Styling:** Use Tailwind CSS utility classes. For mobile, NativeWind v5 allows using Tailwind v4 classes directly in `className`.
- **Data Management:** Follow an offline-first approach. All convention data should be stored in the local SQLite database via Drizzle ORM before syncing to the cloud.
- **Environment Variables:** Use `@conpaws/env` to access validated environment variables. Never hardcode secrets.
- **Testing:** Add unit tests for business logic (iCal parsing, database operations, sync engine) in `apps/native` using Vitest.
- **Git:** Follow a feature-branch workflow. Ensure `bun check-types` and `bun lint` pass before committing.
