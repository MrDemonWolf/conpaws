import alchemy from "alchemy";
import { D1Database, Nextjs, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

/**
 * Production infrastructure for ConPaws.
 *
 * Deploys are gated twice over. `PRODUCTION_DEPLOY_ENABLED` in
 * .github/workflows/deploy-web.yml decides whether this program runs at all,
 * and `ROUTES_ENABLED` below decides whether conpaws.com points at the Worker.
 * Deploy with routes disabled first so Cloudflare holds a known-good version
 * before the apex moves. There is no automatic rollback:
 *
 *   cd apps/web && bunx wrangler rollback
 *
 * Run under Node via tsx rather than Bun — Bun segfaults executing an Alchemy
 * program, the same reason wolfathon's deploy scripts use tsx.
 */
const app = await alchemy("conpaws", {
  phase: process.argv.includes("--destroy") ? "destroy" : undefined,
  // Encrypts `alchemy.secret(...)` values at rest in the state store. Without
  // it, serializing a secret fails outright — and the alternative, binding
  // credentials as plain strings, would put TURNSTILE_SECRET_KEY in the
  // Cloudflare dashboard as readable plaintext and in state unencrypted.
  password: process.env.ALCHEMY_PASSWORD,
  // Shared account-wide state store: one Durable-Object-backed worker named
  // `alchemy-state`, shared by every MrDemonWolf Alchemy app. Alchemy
  // namespaces state by app, so this app lives under the "conpaws" scope.
  // Requires the same ALCHEMY_STATE_TOKEN as every other app on the account.
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: "alchemy-state",
      stateToken: alchemy.secret(process.env.ALCHEMY_STATE_TOKEN),
    }),
});

/**
 * Pin the Workers runtime explicitly. Alchemy's default is whatever the
 * installed miniflare reports as its supported date, so leaving it unset means
 * a routine dependency update can silently change production runtime
 * semantics. Bump it on purpose, not by accident.
 */
const COMPATIBILITY_DATE = "2026-03-10";

/**
 * The waitlist database.
 *
 * `adopt: true` lets CI reconcile the live resource by name instead of
 * requiring a shared local state file.
 */
const db = await D1Database("database", {
  name: "conpaws-db",
  adopt: true,
  migrationsDir: "../../apps/web/drizzle/migrations",
  // Must match `migrations_table` in apps/web/wrangler.jsonc. Alchemy defaults
  // to `d1_migrations`; a laptop applying migrations under one bookkeeping
  // table while production uses another is how the same migration gets applied
  // twice, and D1 drift does not come back with a Worker rollback.
  migrationsTable: "drizzle_migrations",
});

/**
 * Observability is billed per event, and one event is a single log line or a
 * single trace span: 20M/month included on the Workers Paid plan, then $0.60
 * per additional million. Traces are free until 2026-10-01 and then join that
 * same quota.
 *
 * This used to be undeclared here, so production silently inherited
 * Cloudflare's defaults — logs and traces both on at 100% — while
 * apps/web/wrangler.jsonc looked authoritative and in fact only ever applied
 * to local dev. Same drift that once made the Worker's bindings a guess.
 *
 * Logs stay at 100%: this is a low-traffic site and a dropped line costs more
 * than it saves. Traces are sampled to 1% because spans multiply per request,
 * which makes them the surface that can actually run up a bill — Next is
 * pinned to 16.2.12 precisely because 16.3 + OpenNext has an unbounded
 * prefetch loop, and that is the shape of bug that would do it. The rate
 * matches Cloudflare's own Workers best-practices example.
 */
const OBSERVABILITY = {
  enabled: true,
  logs: { enabled: true, headSamplingRate: 1 },
  traces: { enabled: true, headSamplingRate: 0.01 },
} as const;

/**
 * The ESP is self-hosted listmonk at lists.mrdemonwolf.com, sending via SES.
 *
 * These read from the deploy environment (packages/infra/.env locally, repo
 * secrets in CI). Any missing value makes `readListmonkConfig` return null,
 * which is the signal the signup route and the reconciler fail closed on: 503
 * and a no-op respectively. That is the intended state while the public form is
 * still closed (WAITLIST_ACCEPTING_SIGNUPS in
 * apps/web/src/components/waitlist.tsx), so an unset token degrades safely
 * rather than half-opening the waitlist.
 *
 * LISTMONK_LIST_ID is 3, the private double opt-in "ConPaws Waitlist" list.
 * listmonk's /api is deliberately outside Cloudflare Access, so the API token
 * is the only credential needed — no Access service token.
 */
const waitlistSecrets = {
  LISTMONK_BASE_URL: process.env.LISTMONK_BASE_URL ?? "",
  LISTMONK_API_USER: process.env.LISTMONK_API_USER ?? "",
  // The only real credential of the four, so it gets the same encrypted-at-rest
  // treatment as TURNSTILE_SECRET_KEY. The other three are configuration.
  LISTMONK_API_TOKEN: alchemy.secret(process.env.LISTMONK_API_TOKEN ?? ""),
  LISTMONK_LIST_ID: process.env.LISTMONK_LIST_ID ?? "",
};

/**
 * The site.
 *
 * `Nextjs` is Alchemy's first-class Next.js resource: it runs the OpenNext
 * build and uploads the result the way the adapter expects, including the
 * ASSETS and WORKER_SELF_REFERENCE bindings. Assembling that upload by hand
 * does not work — a prebuilt `.open-next/worker.js` shipped as a plain Worker
 * throws `ReferenceError: require is not defined` out of Next's server
 * bootstrap on every request, because the bundle leaves bare `require()` calls
 * for Node builtins that only resolve under the adapter's own upload path.
 */
export const web = await Nextjs("web", {
  // Explicit script name → conpaws.<subdomain>.workers.dev, and the name
  // `wrangler rollback` expects. Without it Alchemy prefixes app and stage.
  //
  // Renamed from `conpaws-web` on 2026-08-26. Alchemy has no rename: changing
  // this destroys the old Worker and creates a new one, which detaches and
  // re-attaches conpaws.com. Do not change it casually — it is a brief outage
  // every time, and the custom-domain bind is the slow part.
  name: "conpaws",
  adopt: true,
  cwd: "../../apps/web",
  compatibilityDate: COMPATIBILITY_DATE,
  observability: OBSERVABILITY,
  // conpaws.com is attached only once the routes switch is on, so the first
  // deploy of any change lands on a Worker nothing points at yet.
  domains:
    process.env.ROUTES_ENABLED === "true"
      ? ["conpaws.com", "www.conpaws.com"]
      : undefined,
  // Both public workers.dev surfaces default OFF. A stable workers.dev URL is a
  // second, indexable copy of the site; version previews are useful but should
  // be a deliberate choice. Toggle per environment with repo variables rather
  // than by editing code or clicking in the dashboard.
  url: process.env.WORKERS_DEV_ENABLED === "true",
  previewSubdomains: process.env.PREVIEW_URLS_ENABLED === "true",
  bindings: {
    DB: db,
    TURNSTILE_SECRET_KEY: alchemy.secret(process.env.TURNSTILE_SECRET_KEY),
    ...waitlistSecrets,
  },
  dev: {
    env: {
      PORT: "3001",
    },
  },
});

/**
 * Waitlist reconciler.
 *
 * `ctx.waitUntil` on the signup path has no retry, so without this every ESP
 * hiccup silently drops a subscriber while D1 stays perfectly correct and
 * nothing alerts. It replays rows where `synced_at IS NULL`, hourly.
 *
 * A separate Worker rather than a `scheduled` handler on the site, because the
 * OpenNext worker only exports `fetch`.
 */
export const reconciler = await Worker("reconciler", {
  name: "conpaws-reconciler",
  adopt: true,
  cwd: "../../apps/web",
  entrypoint: "workers/reconcile.ts",
  compatibility: "node",
  compatibilityDate: COMPATIBILITY_DATE,
  observability: OBSERVABILITY,
  crons: ["0 * * * *"],
  // Cron-only: it exports `scheduled` and no `fetch`, so a workers.dev URL
  // would serve nothing but an exception page.
  url: false,
  bindings: {
    DB: db,
    ...waitlistSecrets,
  },
});

/**
 * Binding types, consumed by apps/web/cloudflare-env.d.ts and
 * apps/web/workers/reconcile.ts. Renaming a binding above is then a type error
 * at the call site rather than a runtime `undefined` in production.
 */
export type WebEnv = typeof web.Env;
export type ReconcilerEnv = typeof reconciler.Env;

console.log(`Web         -> ${web.url}`);
console.log(`Reconciler  -> ${reconciler.name}`);

await app.finalize();
