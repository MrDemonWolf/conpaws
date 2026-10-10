# Repository layout

ConPaws follows Better-T Stack's Bun workspace and Turborepo layout:
deployable applications live in `apps/`, and shared code lives in `packages/`.
The original scaffold settings are recorded in `bts.jsonc`; they are historical,
not a complete recipe for the custom native targets and Worker deployments.

| Workspace | Responsibility |
| --- | --- |
| `apps/native` | Expo app, local SQLite, native modules, Widget and Watch targets |
| `apps/api` | Public API Worker on api.conpaws.com: the published catalog today, tRPC and auth later |
| `apps/web` | Marketing, legal pages and the waitlist |
| `apps/admin` | Private catalog editing, publishing and audit history |
| `packages/config` | Shared TypeScript configuration |
| `packages/env` | Web and deployment environment validation |
| `packages/infra` | Alchemy deployment programs, Worker bindings and the cdn.conpaws.com bucket |
| `packages/ui` | Shared web components, styling and icons |
| `docs` | Product-specific technical notes and review reports |
| `infra/xprem` | Planned OTA hosting descriptor and operator runbook |
| `test-data` | Fictional import fixtures |

## Ownership rules

- Keep routes and feature code inside the application that owns them.
- Share code when multiple applications actually use it. Do not create empty
  API, auth or server packages to mirror optional scaffold features.
- Keep native routes in `apps/native/app`; web/admin use Next.js `src/app`.
- Keep database schemas and migration histories app-local. The native store,
  waitlist D1 database and catalog D1 database have separate lifecycles.
- Public catalog APIs expose published snapshots. Private drafts remain admin-only.
- Native cloud sync, account authentication and RevenueCat are planned work
  that lands in `apps/api`; there is no separate `apps/server` application.

## Commands

Run commands from the repository root:

```sh
bun install --frozen-lockfile
```

Use `bun dev:web`, `bun dev:admin` or `bun dev:native` to start only the app you
need. `bun dev` starts all three. See the admin README for local database setup.
The website preview command builds first and shares the admin local D1 state:

```sh
bun run --filter @conpaws/web preview
```

Validation uses `bun run lint`, `bun run check-types` and `bun run test`.
Use `bun run test`, not bare `bun test`: the suites run under Vitest.
Use the pinned Node and Bun versions for parity with CI.

## Deployment boundaries

`bun run deploy` manages everything: the website, the API Worker, the catalog
and waitlist databases, the CDN bucket, the waitlist reconciler and, once
Zero Trust is enabled, the Access-protected admin console. Wrangler
configurations contain local placeholder database IDs; production resources
are owned by Alchemy.

The current admin roles grant catalog-wide access. Organization isolation,
convention-scoped host invitations and installable PWA support are future work.
Keep the console restricted to trusted internal editors until those gates exist.

Never move migration histories or regenerate native projects merely to tidy
the tree. Back up custom targets before a clean native prebuild.
