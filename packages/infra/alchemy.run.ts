import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

/**
 * ConPaws infrastructure.
 *
 * The stack name is deliberately unique to this product: Alchemy state for
 * several MrDemonWolf projects lives in the same Cloudflare account, and a
 * shared name would let one deploy clobber another's state.
 *
 * Deployment safety note: Alchemy applies the whole stack in one step. It has
 * no equivalent of the canary-at-0%-traffic promotion the retired
 * .github/workflows/deploy-web.yml performed. Deploy behind disabled routes
 * first so Cloudflare retains a known-good version to roll back to.
 */

export const db = Cloudflare.D1.Database("database", {
  migrationsDir: "../../apps/web/drizzle/migrations",
  // Must match `migrations_table` in apps/web/wrangler.jsonc. Alchemy defaults
  // to `d1_migrations`; a laptop applying migrations under one bookkeeping
  // table while production uses another is how the same migration gets applied
  // twice, and D1 drift does not come back with a Worker rollback.
  migrationsTable: "drizzle_migrations",
});

/**
 * Waitlist secrets. Brevo owns double-opt-in tokens, so nothing here is a
 * confirmation credential — these are the API identities the Worker and the
 * reconciler both need.
 *
 * `Config.redacted` binds as `secret_text`; `Config.string` binds as a plain
 * var. The list and template ids are identifiers, not credentials.
 */
const waitlistSecrets = {
  BREVO_API_KEY: Config.redacted("BREVO_API_KEY"),
  BREVO_LIST_ID: Config.string("BREVO_LIST_ID"),
  BREVO_DOI_TEMPLATE_ID: Config.string("BREVO_DOI_TEMPLATE_ID"),
  BREVO_DOI_REDIRECT_URL: Config.string("BREVO_DOI_REDIRECT_URL"),
};

/**
 * The site itself.
 *
 * This uses `Website.StaticSite` pointed at the OpenNext worker rather than the
 * first-class `Website.Nextjs` resource on purpose: `Website.Nextjs` pulls in
 * `@alchemy.run/cloudflare-frameworks`, which peer-requires
 * `@opennextjs/cloudflare` at exactly 1.20.1. This repo pins 1.20.2 to hold
 * `next` at 16.2.12 (opennextjs-cloudflare#1334 — unbounded RSC prefetch loop).
 * Running the OpenNext build ourselves and shipping the artifact keeps that pin
 * intact. Revisit when the frameworks package accepts 1.20.2 or later.
 *
 * `bundle: false` matters — `.open-next/worker.js` is already bundled, and
 * re-bundling it breaks the OpenNext runtime.
 */
export const web = Cloudflare.Website.StaticSite("web", {
  // Pinned, not generated. Without it Alchemy derives a physical name from the
  // stack, stage, and logical id, which would not be `conpaws-web` — the name
  // `wrangler rollback` and apps/web/wrangler.jsonc's WORKER_SELF_REFERENCE
  // both expect. Rollback is manual now, so the name has to be predictable.
  name: "conpaws-web",
  cwd: "../../apps/web",
  command: "bun run build:cloudflare",
  // Rebuild shared workspace dependencies until Alchemy has a workspace-aware
  // default memo.
  memo: false,
  outdir: ".open-next/assets",
  main: "../../apps/web/.open-next/worker.js",
  bundle: false,
  compatibility: {
    flags: ["nodejs_compat", "global_fetch_strictly_public"],
  },
  env: {
    DB: db,
    TURNSTILE_SECRET_KEY: Config.redacted("TURNSTILE_SECRET_KEY"),
    ...waitlistSecrets,
  },
  dev: {
    command: "bun run dev:bare",
    url: "http://localhost:3001",
  },
});

/**
 * Waitlist reconciler.
 *
 * `ctx.waitUntil` has no retry, so without this every Brevo hiccup silently
 * drops a subscriber while D1 stays perfectly correct and nothing alerts. It
 * replays rows where `synced_at IS NULL`.
 *
 * It is a separate Worker rather than a `scheduled` handler on the site because
 * the OpenNext worker only exports `fetch`; adding a handler would mean
 * re-bundling a bundle that must not be re-bundled.
 */
export const reconciler = Cloudflare.Worker("reconciler", {
  name: "conpaws-reconciler",
  main: "../../apps/web/workers/reconcile.ts",
  crons: ["0 * * * *"],
  compatibility: {
    flags: ["nodejs_compat"],
  },
  env: {
    DB: db,
    ...waitlistSecrets,
  },
});

export type WebEnv = Cloudflare.InferEnv<typeof web>;
export type ReconcilerEnv = Cloudflare.InferEnv<typeof reconciler>;

export default Alchemy.Stack(
  "conpaws",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* web;
    const reconcilerWorker = yield* reconciler;

    return {
      web: webWorker.url,
      reconcilerCrons: reconcilerWorker.crons,
    };
  }),
);
