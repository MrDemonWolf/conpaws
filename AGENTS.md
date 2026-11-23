# AGENTS.md

## Skills and documentation

For every task, first discover the installed skills and plugin capabilities that are relevant to the request. Use each relevant skill that materially improves correctness or execution, including the applicable Expo and platform skills for native app work. Read and follow each selected skill before acting, and use its official documentation workflow when APIs, configuration, or platform rules may have changed. Announce skill use when the skill requires it. Do not load or invoke unrelated skills simply to increase the count.

## Scoped instructions

Read the guidance for every area a task touches, including callers and shared configuration. Nested instructions refine root guidance within their directory; keep repository-wide safety and deployment rules intact.

| Area | Instructions |
| --- | --- |
| Native app, iOS/Android phone widgets, Swift Watch | [apps/native/AGENTS.md](apps/native/AGENTS.md) |
| Website, waitlist and email | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| Private catalog console | [apps/admin/AGENTS.md](apps/admin/AGENTS.md) |
| Public API and catalog boundary | [apps/api/AGENTS.md](apps/api/AGENTS.md) |
| Alchemy resources and deployment configuration | [packages/infra/AGENTS.md](packages/infra/AGENTS.md) |
| Environment schemas and bindings | [packages/env/AGENTS.md](packages/env/AGENTS.md) |
| Shared web components | [packages/ui/AGENTS.md](packages/ui/AGENTS.md) |
| Fictional import fixtures | [test-data/AGENTS.md](test-data/AGENTS.md) |

Keep durable, cross-agent instructions in `AGENTS.md` files. Keep project plans, audit findings and release notes in Notion. Do not recreate a parallel `CLAUDE.md` instruction tree.

## Design system

Use the [Notion design system](https://app.notion.com/p/408d61481c7b8117bbc9c6a114755eb3) for token sources, platform differences, component states, and accessibility checks. Reuse paired foreground/background tokens; preserve native semantic colors and Dynamic Type. Shared web color changes must keep `apps/web/src/lib/theme-contrast.test.ts` passing. Keep test evidence, grades and project notes on the [ConPaws Notion page](https://app.notion.com/p/3c8d61481c7b819d9d25c742524b4dc1), not as new report files in Git.

## Browser and visual testing

Use the agent's built-in browser for localhost viewers and browser-based test surfaces, including serve-sim. Do not open Safari, Chrome, or another external browser unless the user explicitly requests it. Reuse existing local servers and ports instead of starting duplicates.

## Project Overview

ConPaws is a furry convention companion app — an Expo/React Native mobile app plus a Next.js website, in a bun/Turborepo monorepo. The app is **local-first** (all core features work offline). Premium features ("ConPaws+") will be powered by RevenueCat. The cloud backend target is **Cloudflare Workers + D1 + R2 with Hono, tRPC, and Better-Auth** — no Supabase, no VPS, no Docker.

**Repo reality check:** the native MVP is in active development. It has Expo Router screens, a SQLite/Drizzle schema and repositories, ICS/Sched import, convention-timezone handling, local reminders, backup import/export, a catalog download from the public API, and Vitest coverage. `apps/api` exists as the public API Worker (Hono, api.conpaws.com) and serves the read-only catalog today; the premium/cloud backend (tRPC, Better-Auth, sync) and RevenueCat integration grow out of it and remain planned. Do not reference planned backend files as if they exist.

## Development Commands

All commands run from the **repo root** and fan out through Turborepo:

```bash
bun install               # Install dependencies (bun is pinned via packageManager: bun@1.4.4)
bun dev                   # Start web + admin + native dev servers
bun dev:admin             # Private console only (http://localhost:3003)
bun run admin:invite -- you@example.com --remote --role owner --confirm-email you@example.com  # Recover owner access; laptop only
bun dev:web               # Next.js only (http://localhost:3001)
bun dev:native            # Expo dev server only
bun start                 # Expo dev server (development variant)
bun start:preview         # Expo dev server (preview variant)
bun start:prod            # Expo dev server (production variant)
bun android / bun ios     # Run on device/simulator
bun run build             # turbo build
bun lint                  # Biome (`biome check .`) — this repo uses Biome, NOT ESLint
bun check-types           # TypeScript type checking across packages
bun run test              # Run the workspace Vitest suites — NOT `bun test`
bun prebuild              # Update native projects while preserving local folders
bun prebuild:clean        # Clean and regenerate native projects
bun ship:prep             # Local build prep; CI assigns store build numbers automatically
bun run build-number:check # Confirm ios/ and android/ carry the current BUILD_NUMBER
```

**`bun test` is not the test command.** `test` is a Bun builtin, so bare `bun test`
runs Bun's own runner instead of the `test` script and collapses with
`vi.hoisted is not a function` plus a pile of unrelated module-resolution errors —
none of which mean anything is wrong with the code. Always `bun run test`. The
other scripts have no builtin of the same name, so `bun lint` and `bun check-types`
are fine as written.

## Shared architecture and toolchains

- **Website and admin (`apps/web`, `apps/admin`):** Next.js **16.4.5, pinned exactly**, with `@opennextjs/cloudflare` **1.20.14, pinned exactly**. OpenNext 1.20.7 fixed the Next 16.3 prefetch loop; the current adapter supports Next 16.4. Keep Cache Components disabled until OpenNext's Cloudflare support is confirmed for this app. Keep Next and `@next/mdx` versions aligned.
- **Language:** TypeScript strict mode
- **Lint/format:** Biome (`biome.json` at repo root) — there is no ESLint config in this repo
- **Monorepo:** bun workspaces + Turborepo (`turbo.json`); CI runs from the root, not per-app
- **Actions toolchains:** Linux jobs pin `ubuntu-26.04`; native CI compiles an Android arm64 debug app as well as validating config and production JavaScript bundles. Swift tests and iOS releases use `xcode-27` with Xcode 27.1 selected explicitly. Check GitHub's hosted-runner reference and run hosted CI whenever an image changes. Debug compilation does not establish store signing or device behavior.

### Monorepo Structure

Verified against disk:

```
conpaws/
├── apps/
│   ├── api/                 # Public API Worker (Hono) at api.conpaws.com
│   ├── native/              # Expo app
│   │   ├── app/             # Expo Router routes: onboarding, tabs, conventions, import, settings
│   │   ├── src/
│   │   │   ├── db/          # SQLite/Drizzle schema, bootstrap, migrations, repositories
│   │   │   ├── lib/         # ICS parsing, timezone, import policy, schedule selectors
│   │   │   ├── services/    # Local reminders, backup import/export, widget snapshot
│   │   │   ├── global.css   # Tailwind entry point
│   │   │   └── components/ hooks/ locales/ fixtures/ widgets/
│   │   ├── targets/         # Watch targets via @bacons/apple-targets (NOT hand-written pbxproj)
│   │   │   ├── watch/       # watchOS app
│   │   │   ├── watch-widget/ # watchOS Smart Stack complication
│   │   │   └── _shared/     # Watch snapshot/countdown models and canonical widget strings
│   │   ├── modules/         # Local Expo module: Watch snapshot/strings, shortcuts, Android widget updates
│   │   ├── app.config.ts    # Variant-based Expo config
│   │   ├── eas.json         # Preview sideload and production store-build profiles
│   │   ├── metro.config.js
│   │   ├── postcss.config.mjs
│   │   └── tsconfig.json
│   ├── web/                 # Next.js site (Cloudflare Workers via OpenNext)
│   └── admin/               # Private convention catalog console
├── packages/
│   ├── config/              # Shared tsconfig base
│   ├── env/                 # Zod env schemas (src/web.ts for the site build, src/deploy.ts for alchemy.run.ts)
│   ├── infra/               # alchemy.run.ts — D1, Worker bindings/secrets, cron
│   └── ui/                  # Shared shadcn/ui primitives (web)
├── infra/                   # xprem OTA descriptor/runbook; application not deployed
├── biome.json
├── turbo.json
└── package.json
```

## Project documentation — Notion

Project docs, design notes, release guides, plans, report cards and audit history live under the **ConPaws** page in Nathanial's Notion. The repository contains the app, tests, configuration and minimal README/agent entry points:
<https://app.notion.com/p/3c8d61481c7b819d9d25c742524b4dc1>

[Project documentation library](https://app.notion.com/p/408d61481c7b818fb113ee3e0d930cb8) contains the migrated documents and a verified exact-source archive of the removed prototypes and historical notes.

| Notion page | What's Inside |
|------|--------------|
| Prerelease Site | **Decision record for the live site** — version pins and their expiry conditions, Alchemy deployment, ESP, waitlist, Cloudflare mail, config runbook, and a *Traps* section. Read before touching deploy or DNS |
| OTA Updates | xprem OTA host decision and the pre-production gate checklist |
| App Store Release | Versioning policy, why a preview build can never be submitted, the free-1.0 decision |
| Technical Blueprint | Full blueprint, split into sub-pages — stack, data model, sync, iCal import, engineering practices, roadmap |
| Marketing | Website, social media, YouTube, profitability projections |
| Pitch Deck | Market research — fandom stats, convention data, competitive analysis (Barq), revenue projections |
| Ideas | Future feature brainstorms + pre-launch gap analysis |
| Legal | Privacy Policy and Terms of Service templates + App Store compliance checklist |

They mix implemented decisions with future scope; verify claims against the
current code before changing behavior.

Inspect available Notion connector capabilities before asking for missing
planning context. Verify planning claims against current code and deployment
evidence; ask for the relevant page only when it cannot be accessed.

Keep implementation comments beside the code and runnable configuration in Git. Put long-form explanations, release instructions and audit snapshots in Notion. Do not recreate a project `docs/` tree or duplicate the Notion report card in README files.

## Deploy rule

**Never deploy from a laptop.** Production changes only reach Cloudflare through `.github/workflows/deploy-web.yml`, on `main`, after CI has passed on the pull request and on the merge commit. `main` is protected (pull request required, `CI / Verify` must pass, admins included), and the `production` environment accepts deployments only from `main`. `alchemy.run.ts` exits before reading any credential unless `GITHUB_ACTIONS=true` and `GITHUB_REF=refs/heads/main`; `alchemy dev` stays allowed. Do not run `wrangler deploy`, `wrangler d1 migrations apply --remote` or any other production write from a laptop, and never weaken these guards to get a change out — open a pull request. Rollback is the `workflow_dispatch` on the same workflow, run from `main`. The only laptop exception is owner recovery with `bun run admin:invite`.

## Workspace ownership and admin safety

See the [Notion repository layout](https://app.notion.com/p/408d61481c7b81919101c4eab3109ab4) for the current Better-T Stack layout. Keep deployable apps in `apps/` and reusable configuration, environment validation, infrastructure, and UI in `packages/`. App-specific database schemas and migrations stay with their owning apps; native SQLite and Worker D1 have different lifecycles.

- Back up custom native targets before a clean prebuild. Preserve unrelated worktrees and ignored local files.
- Generated Android `gradle.properties` can contain local upload-signing passwords. Never dump that file or include it in evidence archives; inspect approved non-secret keys or presence only.

## Production and defensive testing

- Default pentests and end-to-end checks to local previews and disposable D1 or SQLite data. Explicit authorization is required for staging, physical-device or store builds, the live waitlist, admin email/code flow, listmonk, and app stores.
- Never log real email addresses, real authentication codes, invite links, signing material, secrets, or unpublished catalog data. Synthetic local codes must stay out of CI artifacts.
- Changes to authentication or data boundaries need negative tests for signed-out, disabled, wrong-role, rate-limited, and draft/public cases that apply to the change.
- Security-audit exceptions must record the advisory, current reachability, owner or upstream issue, and an expiry date.
- Report build and unit-test evidence separately from browser, simulator, physical-device, store-delivered, and live-deployment evidence. One level does not prove another.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
