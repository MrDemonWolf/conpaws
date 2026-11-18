# AGENTS.md

Shared environment schemas and configuration validation. Root [AGENTS.md](../../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Read [infrastructure guidance](../infra/AGENTS.md) for resource ownership and [website guidance](../../apps/web/AGENTS.md) for live waitlist behavior.

### Environment Variables

Local development and Alchemy deployment read app-specific environment files. Deployed Workers receive bindings and secrets through Alchemy. Never commit secret values. Store automation reads GitHub secrets and variables; EAS profiles are optional.

- `EXPO_PUBLIC_CONPAWS_API_URL` — overrides the public API base (`https://api.conpaws.com`) for a local `apps/api` dev server: `http://127.0.0.1:8790` on the iOS simulator, `http://10.0.2.2:8790` on the Android emulator. There is no native environment schema in `packages/env`.
- `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` / `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY` — RevenueCat (optional; premium disabled without them)
- `EXPO_PUBLIC_SENTRY_DSN` — crash reporting (preview/production)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Turnstile widget (public; server verify uses the secret below)

Worker-side waitlist config is read at **deploy time** by `packages/infra/alchemy.run.ts` and bound onto the Workers — it never lives in `process.env` at build time, which is why `packages/env/src/web.ts` deliberately omits those bindings: `TURNSTILE_SECRET_KEY`, `LISTMONK_BASE_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_ID`, `WAITLIST_ACCEPTING_SIGNUPS`. `ALCHEMY_PASSWORD` encrypts Alchemy state.

They are validated on the deploying machine by `packages/env/src/deploy.ts` (`@conpaws/env/deploy`), which `alchemy.run.ts` calls before it creates a single resource. Everything in that schema is **required** — including `ALCHEMY_PASSWORD`, `ALCHEMY_STATE_TOKEN` and the `*_ENABLED` flags — and `LISTMONK_LIST_ID` must be plain digits, because the failure it exists to catch is silent: an unset or mistyped value used to bind fine, get rejected by `readListmonkConfig` at the edge, and take the live waitlist down while the deploy reported success. `bun run destroy` runs the same program and therefore needs the same variables present.

Only `TURNSTILE_SECRET_KEY` and `LISTMONK_API_TOKEN` are real credentials, wrapped in `alchemy.secret(...)`; the other three listmonk values are plain configuration. That is why `.github/workflows/deploy-web.yml` carries them as repository **variables** and only the token as a secret. All four are required together — a partial set fails closed rather than half-opening the waitlist.

Which file supplies those depends on how the Worker is being run, and the three are not interchangeable:

| Running | Reads |
|---|---|
| `bunx opennextjs-cloudflare preview` / `wrangler dev` in `apps/web` | `apps/web/.dev.vars` (gitignored) |
| GitHub Actions production deploy | repo secrets and variables — see `.github/workflows/deploy-web.yml` |

`packages/infra/.env` and `apps/web/.env` are loaded by dotenv at the top of `alchemy.run.ts` for `alchemy dev` only; a local `bun run deploy` is refused before it reads them.

`bun run --filter @conpaws/web preview` builds and runs the local site Worker on port 8789. `bun run --filter @conpaws/api dev` runs the API Worker on port 8790 against the admin app's local catalog state. Apply local migrations before testing writes. Retain `populateCache local` so prerendered locales exist in Worker assets. **`bun dev:web` is not a substitute for testing the waitlist**: it is
plain `next dev` with no Cloudflare bindings at all, so `getCloudflareContext()`
throws and `/api/waitlist` returns 503 no matter how the ESP is configured. Local
D1 also needs `bun run db:migrate:local` in `apps/web` before the route can insert.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` goes the other way: it is a **build-time client** var, so it has to be present wherever the OpenNext build runs (`apps/web/.env` locally, a repo variable in CI). Without it the widget never renders, the client posts an empty token, and every real signup is rejected.

`WAITLIST_ACCEPTING_SIGNUPS` is required at deploy time and must be the literal `true` or `false`. Alchemy binds it on the server, where `false` closes POST with `503 {error:"closed"}`; the same repo variable is supplied as `NEXT_PUBLIC_WAITLIST_ACCEPTING_SIGNUPS` to the site build so the form matches the gate.

`bunx biome check .` follows VCS ignore rules and lints nothing inside `.claude/worktrees/*`. In this worktree, lint explicit paths: `bunx biome check apps packages infra .github package.json bts.jsonc tsconfig.json turbo.json`.
