import type { ScheduledController } from "@cloudflare/workers-types";
import type { ReconcilerEnv } from "@conpaws/infra/alchemy.run";

import { createDb } from "../src/db";
import { readBrevoConfig } from "../src/lib/brevo";
import { reconcile } from "../src/lib/waitlist";

/**
 * Waitlist reconciler.
 *
 * Runs hourly (the schedule lives on the Worker in
 * packages/infra/alchemy.run.ts) and replays every signup Brevo has not
 * accepted yet.
 *
 * This exists because `ctx.waitUntil` on the signup path has no retry. Without
 * it, one Brevo hiccup loses a subscriber invisibly: the D1 row is correct,
 * Brevo never received the contact, and nothing reports a problem.
 *
 * It is a Worker of its own rather than a `scheduled` handler bolted onto the
 * site because the site's entry point is OpenNext's prebuilt bundle, which
 * exports only `fetch` and must not be re-bundled.
 */
export default {
  async scheduled(_controller: ScheduledController, env: ReconcilerEnv) {
    const config = readBrevoConfig(env);
    if (!env.DB || !config) {
      console.error("waitlist reconciler: bindings or Brevo config missing");
      return;
    }

    const result = await reconcile(createDb(env.DB), config);

    // A non-zero failure count is the signal that signups are being lost. It is
    // logged at error level so Workers observability surfaces it rather than
    // burying it in an info stream nobody reads.
    if (result.failed > 0) {
      console.error(
        `waitlist reconciler: ${result.failed}/${result.attempted} failed to sync`,
      );
    } else if (result.synced > 0) {
      console.log(`waitlist reconciler: synced ${result.synced}`);
    }
  },
};
