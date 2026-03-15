# conpaws

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
bunx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@conpaws/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
conpaws/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   ├── native/      # Mobile application (React Native, Expo)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
```

## Available Scripts

### Root (Monorepo)

- `bun run dev` — Start all applications in development mode
- `bun run build` — Build all applications
- `bun run check-types` — Check TypeScript types across all apps
- `bun run dev:native` — Start the React Native/Expo development server
- `bun run dev:web` — Start only the web application

### Native App (`apps/native`)

- `bun start` — Start Expo dev server (development variant)
- `bun start:preview` — Start Expo dev server (preview variant)
- `bun start:prod` — Start Expo dev server (production variant)
- `bun android` — Run on Android
- `bun ios` — Run on iOS
- `bun web` — Run web version
- `bun run lint` — Run ESLint
- `bun run type-check` — Run TypeScript type checking
- `bun test` — Run tests (Vitest)
- `bun run prebuild` — Generate native projects
- `bun run prebuild:clean` — Clean and regenerate native projects

### Web App (`apps/web`)

- `bun run dev` — Start Next.js dev server
- `bun run build` — Build for production
- `bun run start` — Start production server
