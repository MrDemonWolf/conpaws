import { and, asc, eq, isNull, lt } from "drizzle-orm";

import type { Db } from "../db";
import { type WaitlistRow, waitlist } from "../db/schema";
import { type BrevoConfig, sendDoubleOptIn } from "./brevo";

/**
 * How many times the reconciler retries one address before leaving it alone.
 * A permanently rejected address (Brevo blocklist, hard bounce) would otherwise
 * be retried hourly forever.
 */
export const MAX_SYNC_ATTEMPTS = 5;

/** How many rows one cron fire replays. Keeps a backlog from timing out. */
export const RECONCILE_BATCH_SIZE = 50;

/**
 * Pushes one row to Brevo and records the outcome.
 *
 * Never throws: this runs inside `ctx.waitUntil` on the request path and inside
 * a scheduled handler on the cron path, and in neither place should a failure
 * take anything else down with it. Failure is recorded on the row, which is
 * what makes the reconciler able to find it again.
 */
export async function syncRow(
  db: Db,
  config: BrevoConfig,
  row: Pick<WaitlistRow, "id" | "email" | "name" | "syncAttempts">,
): Promise<boolean> {
  const result = await sendDoubleOptIn(config, {
    email: row.email,
    name: row.name,
  });

  if (result.ok) {
    await db
      .update(waitlist)
      .set({ syncedAt: new Date(), syncError: null })
      .where(eq(waitlist.id, row.id));
    return true;
  }

  await db
    .update(waitlist)
    .set({
      syncAttempts: row.syncAttempts + 1,
      syncError: `${result.status}: ${result.detail}`,
    })
    .where(eq(waitlist.id, row.id));
  return false;
}

/**
 * Replays every signup Brevo has not accepted yet.
 *
 * This is not optional. `ctx.waitUntil` has no retry, so without this pass a
 * single Brevo hiccup silently loses a subscriber: D1 still holds a perfectly
 * correct row, Brevo never hears about it, and nothing anywhere reports a
 * problem.
 */
export async function reconcile(
  db: Db,
  config: BrevoConfig,
): Promise<{ attempted: number; synced: number; failed: number }> {
  const pending = await db
    .select({
      id: waitlist.id,
      email: waitlist.email,
      name: waitlist.name,
      syncAttempts: waitlist.syncAttempts,
    })
    .from(waitlist)
    .where(
      and(
        isNull(waitlist.syncedAt),
        lt(waitlist.syncAttempts, MAX_SYNC_ATTEMPTS),
        eq(waitlist.status, "pending"),
      ),
    )
    .orderBy(asc(waitlist.createdAt))
    .limit(RECONCILE_BATCH_SIZE);

  let synced = 0;

  // Sequential on purpose. Brevo rate-limits, and a parallel burst of a large
  // backlog is the fastest way to get the account throttled.
  for (const row of pending) {
    if (await syncRow(db, config, row)) synced += 1;
  }

  return {
    attempted: pending.length,
    synced,
    failed: pending.length - synced,
  };
}
