# AGENTS.md

Private catalog console and its database/migrations. Root [AGENTS.md](../../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Next/OpenNext pins and production guards are in root guidance. Read [API guidance](../api/AGENTS.md) when changing public catalog data and [infrastructure guidance](../../packages/infra/AGENTS.md) for bindings and migrations.

## Catalog ownership

- **Catalog:** `published_slug` has a unique index. The catalog D1 (`conpaws-admin-catalog-db`) is declared in `packages/infra/alchemy.run.ts`, created empty on first deploy with `apps/admin/drizzle/migrations` applied before the Workers that read it, and bound to both the admin console and the API by resource reference, so no database ID is configured anywhere. Public code accesses `CATALOG_DB` only through `apps/api/src/catalog.ts`; a test enforces that boundary.

## Access and publication

- `apps/admin` is the private catalog console. Invite-only email-code sign-in and active catalog membership protect it; there is no Cloudflare Access. Owner/editor access is catalog-wide; do not invite outside hosts until organization and convention isolation is implemented.
- The public website reads published catalog snapshots only. Draft edits must not leak into public API responses.
- Admin deploys with the main stack; there is no separate admin program, workflow or owner setting. A fresh console lets the first verified email signup become owner in one D1 batch. The persistent `admin_setup` latch must never reopen after members are disabled or deleted. After setup, only active members and live invites are sent a code. The laptop `admin:invite` command remains for operator recovery and refuses CI, and the request form must look identical for every address. Never bind `ADMIN_RUNTIME_ENV=local` or `ADMIN_DEV_EMAIL` in production, and never print member emails, invite links or codes in deploy or CI output (the repository is public).
