import { readDeployEnv } from "@conpaws/env/deploy";
import alchemy from "alchemy";
import { D1Database, Nextjs, Worker } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

/**
 * Everything this program reads from the environment, validated once, before
 * any resource is created.
 *
 * It used to read `process.env` inline with `?? ""` fallbacks, which meant an
 * unset or mistyped variable was indistinguishable from a deliberate empty
 * one. LISTMONK_LIST_ID was the sharp edge: nothing checked it was a positive
 * integer, so a typo bound a value `readListmonkConfig` rejects at the edge —
 * the signup route 503s, the reconciler no-ops, and the deploy reports
 * success. A live waitlist stops taking signups with nothing to see.
 *
 * TURNSTILE_SECRET_KEY had no fallback while the four listmonk values did,
 * which was never a decision. It is settled the strict way: all of them are
 * required, and a deploy that could not serve the waitlist fails here rather
 * than on Cloudflare.
 *
 * `--destroy` runs the same program and therefore needs the same variables
 * present. That is a real cost, and the right side to err on: the alternative
 * is a validation hole that a normal deploy could fall through.
 */
const env = readDeployEnv(process.env);

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
  password: env.ALCHEMY_PASSWORD,
  // Shared account-wide state store: one Durable-Object-backed worker named
  // `alchemy-state`, shared by every MrDemonWolf Alchemy app. Alchemy
  // namespaces state by app, so this app lives under the "conpaws" scope.
  // Requires the same ALCHEMY_STATE_TOKEN as every other app on the account.
  stateStore: (scope) =>
    new CloudflareStateStore(scope, {
      scriptName: "alchemy-state",
      stateToken: alchemy.secret(env.ALCHEMY_STATE_TOKEN),
    }),
});

/**
 * Pin the Workers runtime explicitly. Alchemy's default is whatever the
 * installed miniflare reports as its supported date, so leaving it unset means
 * a routine dependency update can silently change production runtime
 * semantics. Bump it on purpose, not by accident.
 *
 * `apps/web/wrangler.jsonc` MUST carry the same date. It drifted to
 * 2026-08-20 while production stayed here, so local preview and CI's Worker
 * smoke test ran five months of different runtime semantics from the
 * deployed Worker -- exactly the gap a runtime-dependent bug slips through.
 * Bumping is deliberate: change both files together and redeploy.
 *
 * Compatibility flags need no entry here. Alchemy's `Nextjs` resource injects
 * `nodejs_compat` and `global_fetch_strictly_public`, which is the same pair
 * wrangler.jsonc declares.
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
 * A hard ceiling on CPU per invocation, well under the platform default.
 *
 * The Standard usage model bills CPU time, not wall clock: 30 million CPU-ms
 * are included each month and every additional million costs $0.02. It also
 * defaults `cpu_ms` to 30_000, which means one Worker stuck in a loop can
 * spend four thousand times a normal request's CPU before the runtime stops
 * it. That is the shape of bill worth ruling out in advance, and it is not
 * hypothetical here: Next is pinned to 16.2.12 precisely because 16.3 with
 * OpenNext has an unbounded prefetch loop.
 *
 * 500ms for the site. Cloudflare's own pricing example treats 7ms as a normal
 * request; an OpenNext render on a cold isolate is far more than that but not
 * remotely close to half a second, so this bounds a runaway at 1/60th of the
 * default without being tight enough to clip a legitimate first render.
 * Isolates also tolerate occasional overruns and only terminate a Worker that
 * hits the limit consistently, so this cannot break a rare slow request.
 *
 * The reconciler gets more room because it is a batch: fifty rows, each with
 * an HTTP round trip. Almost all of that is waiting rather than CPU -- which
 * the Standard model does not bill -- but the CPU it does use is spread over a
 * loop rather than one render.
 *
 * `subrequests` is deliberately left alone. The paid default is 10,000, and
 * the site's real number is small, but OpenNext issues its own internal
 * subrequests for assets and the self-reference binding and I have not
 * measured them; guessing a cap here would trade a cost risk for an outage.
 *
 * Note these are enforced only on Cloudflare's network, never in local dev.
 */
const WEB_LIMITS = { cpu_ms: 500 } as const;
const RECONCILER_LIMITS = { cpu_ms: 5_000 } as const;

/**
 * The ESP is self-hosted listmonk at lists.mrdemonwolf.com, sending via SES.
 *
 * These read from the deploy environment (packages/infra/.env locally, repo
 * secrets and variables in CI) and are validated at the top of this file.
 *
 * `readListmonkConfig` still fails closed at the edge on anything missing —
 * 503 from the signup route, a no-op from the reconciler — and that runtime
 * guard stays, because a binding can be removed in the dashboard without
 * touching this file. It is no longer the first line of defence: the form is
 * open and taking real signups, so a deploy missing any of these is a mistake
 * to stop on the deploying machine, not a state to degrade into quietly.
 *
 * LISTMONK_LIST_ID is 3, the private double opt-in "ConPaws Waitlist" list.
 * listmonk's /api is deliberately outside Cloudflare Access, so the API token
 * is the only credential needed — no Access service token.
 */
const waitlistSecrets = {
  LISTMONK_BASE_URL: env.LISTMONK_BASE_URL,
  LISTMONK_API_USER: env.LISTMONK_API_USER,
  // The only real credential of the four, so it gets the same encrypted-at-rest
  // treatment as TURNSTILE_SECRET_KEY. The other three are configuration.
  LISTMONK_API_TOKEN: alchemy.secret(env.LISTMONK_API_TOKEN),
  // Bindings are strings; the number was parsed only so a non-number fails the
  // deploy instead of reaching `readListmonkConfig` at the edge.
  LISTMONK_LIST_ID: String(env.LISTMONK_LIST_ID),
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
  limits: WEB_LIMITS,
  // conpaws.com is attached only once the routes switch is on, so the first
  // deploy of any change lands on a Worker nothing points at yet.
  domains: env.ROUTES_ENABLED ? ["conpaws.com", "www.conpaws.com"] : undefined,
  // Both public workers.dev surfaces default OFF. A stable workers.dev URL is a
  // second, indexable copy of the site; version previews are useful but should
  // be a deliberate choice. Toggle per environment with repo variables rather
  // than by editing code or clicking in the dashboard.
  url: env.WORKERS_DEV_ENABLED,
  previewSubdomains: env.PREVIEW_URLS_ENABLED,
  bindings: {
    DB: db,
    TURNSTILE_SECRET_KEY: alchemy.secret(env.TURNSTILE_SECRET_KEY),
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
  limits: RECONCILER_LIMITS,
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
