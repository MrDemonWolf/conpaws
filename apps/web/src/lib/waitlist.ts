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
 * Minimum gap between confirmation sends to one address.
 *
 * The attempt ceiling alone is not a rate limit — it would still let someone
 * fire MAX_SYNC_ATTEMPTS emails at a stranger's inbox in a second. This is what
 * makes the form not a mailbombing tool.
 */
export const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

/** Whether enough time has passed to send this address another confirmation. */
export function resendAllowed(
  syncAttemptedAt: Date | null,
  now: number = Date.now(),
): boolean {
  if (syncAttemptedAt === null) return true;
  return now - syncAttemptedAt.getTime() >= RESEND_COOLDOWN_MS;
}

/**
 * Pushes one row to Brevo and records the outcome.
 *
 * Never throws: this runs inside `ctx.waitUntil` on the request path and inside
 * a scheduled handler on the cron path, and in neither place should a failure
 * take anything else down with it. That includes the D1 writes themselves — see
 * `settle` below. Failure is recorded on the row, which is what makes the
 * reconciler able to find it again.
 *
 * Returns whether the address is now synced, so a D1 write that fails after a
 * successful Brevo call is reported as not-synced rather than as success.
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
    // A D1 failure here is the bad case: Brevo already has the contact, but the
    // row keeps synced_at NULL, so a later pass sends a second confirmation.
    // Nothing better is available from inside the Worker — what matters is that
    // it does not take the rest of the batch down with it.
    return await settle(
      db
        .update(waitlist)
        .set({ syncedAt: new Date(), syncError: null })
        .where(eq(waitlist.id, row.id)),
    );
  }

  await settle(
    db
      .update(waitlist)
      .set({ syncError: `${result.status}: ${result.detail}` })
      .where(eq(waitlist.id, row.id)),
  );
  return false;
}

/**
 * Runs a D1 write and reports success instead of rejecting.
 *
 * `reconcile` walks its rows sequentially, so one rejected write would skip
 * every remaining row in the pass and surface as a wholesale failure of the
 * scheduled handler. On the request path the same rejection would land in
 * `ctx.waitUntil` as an unhandled promise.
 */
async function settle(work: Promise<unknown>): Promise<boolean> {
  try {
    await work;
    return true;
  } catch (error) {
    console.error("waitlist: D1 write failed", error);
    return false;
  }
}

/**
 * Takes exclusive ownership of a row before sending its confirmation email.
 *
 * The attempt counter doubles as the claim token: the update only lands if the
 * row is still unsynced AND still on the attempt count the caller observed. Two
 * requests that read the same row therefore cannot both send — the loser's
 * WHERE matches nothing. Returns true if this caller may send.
 */
export async function claimRow(
  db: Db,
  row: Pick<WaitlistRow, "id" | "syncAttempts">,
): Promise<boolean> {
  try {
    const claimed = await db
      .update(waitlist)
      .set({ syncAttempts: row.syncAttempts + 1, syncAttemptedAt: new Date() })
      .where(
        and(
          eq(waitlist.id, row.id),
          isNull(waitlist.syncedAt),
          eq(waitlist.syncAttempts, row.syncAttempts),
        ),
      )
      .returning({ id: waitlist.id });

    return claimed.length > 0;
  } catch (error) {
    // A failed claim is indistinguishable from a lost claim as far as the
    // caller is concerned: do not send, leave the row for the next pass.
    console.error("waitlist: claim failed", error);
    return false;
  }
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
  let attempted = 0;
  for (const row of pending) {
    if (!(await claimRow(db, row))) continue;
    attempted += 1;
    if (
      await syncRow(db, config, { ...row, syncAttempts: row.syncAttempts + 1 })
    )
      synced += 1;
  }

  return { attempted, synced, failed: attempted - synced };
}
