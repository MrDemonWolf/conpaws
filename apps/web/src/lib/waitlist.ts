import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import type { Db } from "../db";
import { type WaitlistRow, waitlist } from "../db/schema";
import {
  fetchListSubscribers,
  type ListmonkConfig,
  sendDoubleOptIn,
} from "./listmonk";

/**
 * Maximum number of sends attempted for one address before leaving it alone.
 * A permanently rejected address (listmonk blocklist, hard bounce) would
 * otherwise be retried hourly forever.
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

/**
 * How many addresses one IP may sign up in {@link SIGNUP_WINDOW_MS}.
 *
 * RESEND_COOLDOWN_MS bounds sends to *one* address; it says nothing about
 * distinct ones. A caller with solved Turnstile tokens could therefore create
 * unbounded D1 rows and make SES send exactly one confirmation to each of an
 * arbitrary list of third parties -- every message individually legitimate,
 * every one of them unrequested, and our sending reputation paying for it.
 *
 * Five an hour is far above a household or a convention's shared wifi
 * retrying a form, and far below anything worth automating.
 */
export const MAX_SIGNUPS_PER_IP = 5;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const RECONCILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const UNCONFIRMED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Apply listmonk-owned state to local records; D1 remains the suppression log. */
export async function syncSubscriptionStatuses(db: Db, config: ListmonkConfig) {
  let updated = 0;
  for (const [remoteStatus, status] of [
    ["unsubscribed", "unsubscribed"],
    ["confirmed", "confirmed"],
  ] as const) {
    const emails = await fetchListSubscribers(config, remoteStatus);
    for (const email of emails) {
      const values =
        status === "unsubscribed"
          ? {
              status,
              name: "",
              confirmedAt: null,
              ip: null,
              ipBucket: null,
              userAgent: null,
              country: null,
              referer: null,
              utmSource: null,
              utmMedium: null,
              utmCampaign: null,
            }
          : {
              status,
              confirmedAt: sql`coalesce(${waitlist.confirmedAt}, ${Date.now()})`,
            };
      await db
        .update(waitlist)
        .set(values)
        .where(and(eq(waitlist.email, email), isNull(waitlist.erasedAt)));
      updated += 1;
    }
  }
  await db
    .delete(waitlist)
    .where(
      and(
        eq(waitlist.status, "pending"),
        isNull(waitlist.confirmedAt),
        lt(waitlist.createdAt, new Date(Date.now() - UNCONFIRMED_RETENTION_MS)),
      ),
    );
  return { updated };
}

/** IPv4 keeps its address; IPv6 shares an admission bucket per /64. */
export function ipBucket(ip: string | null): string | null {
  if (!ip) return null;
  const ipv4 = ip.split(".");
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    return ipv4.map(Number).join(".");
  }

  let address = ip.toLowerCase();
  const embedded = address.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (embedded) {
    const octets = [
      Number(embedded[1] ?? -1),
      Number(embedded[2] ?? -1),
      Number(embedded[3] ?? -1),
      Number(embedded[4] ?? -1),
    ];
    if (octets.some((part) => part > 255)) return ip;
    address =
      address.slice(0, embedded.index) +
      `${(((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16)}:${(((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16)}`;
  }

  if ((address.match(/::/g) ?? []).length > 1) return ip;
  const [leftText, rightText] = address.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (
    (address.includes("::") ? missing < 1 : missing !== 0) ||
    [...left, ...right].some((part) => !/^[\da-f]{1,4}$/.test(part))
  ) {
    return ip;
  }
  const groups = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  if (groups.length !== 8) return ip;
  return `${groups
    .slice(0, 4)
    .map((part) => Number.parseInt(part, 16).toString(16))
    .join(":")}::/64`;
}

/** Whether this IP has room for another signup right now. */
export function signupAllowedFromIp(
  recentCount: number,
  limit: number = MAX_SIGNUPS_PER_IP,
): boolean {
  return recentCount < limit;
}

/** Whether enough time has passed to send this address another confirmation. */
export function resendAllowed(
  syncAttemptedAt: Date | null,
  now: number = Date.now(),
): boolean {
  if (syncAttemptedAt === null) return true;
  return now - syncAttemptedAt.getTime() >= RESEND_COOLDOWN_MS;
}

/**
 * Pushes one row to listmonk and records the outcome.
 *
 * Never throws: this runs inside `ctx.waitUntil` on the request path and inside
 * a scheduled handler on the cron path, and in neither place should a failure
 * take anything else down with it. That includes the D1 writes themselves — see
 * `settle` below. Failure is recorded on the row, which is what makes the
 * reconciler able to find it again.
 *
 * Returns whether the address is now synced, so a D1 write that fails after a
 * successful listmonk call is reported as not-synced rather than as success.
 */
export async function syncRow(
  db: Db,
  config: ListmonkConfig,
  row: Pick<WaitlistRow, "id" | "email" | "name" | "syncAttempts">,
): Promise<boolean> {
  const result = await sendDoubleOptIn(config, {
    email: row.email,
    name: row.name,
  });

  if (result.ok) {
    // A D1 failure here is the bad case: listmonk already has the subscriber,
    // but the row keeps synced_at NULL, so a later pass sends a second
    // confirmation.
    // Nothing better is available from inside the Worker — what matters is that
    // it does not take the rest of the batch down with it.
    return await settle(
      db
        .update(waitlist)
        .set({ syncedAt: new Date(), syncError: null })
        .where(eq(waitlist.id, row.id)),
    );
  }

  // Never refund a claimed attempt. A finite attempt budget bounds retries.
  await settle(
    db
      .update(waitlist)
      .set({
        syncError: `${result.status}: ${result.detail}`,
      })
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
 * Replays eligible signup rows listmonk has not accepted yet.
 *
 * This is not optional. `ctx.waitUntil` has no retry, so without this pass a
 * single listmonk hiccup silently loses a subscriber: D1 still holds a
 * perfectly correct row, listmonk never hears about it, and nothing anywhere
 * reports a problem.
 */
export async function reconcile(
  db: Db,
  config: ListmonkConfig,
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
        isNull(waitlist.erasedAt),
        gte(waitlist.createdAt, new Date(Date.now() - RECONCILE_MAX_AGE_MS)),
      ),
    )
    .orderBy(asc(waitlist.syncAttemptedAt))
    .limit(RECONCILE_BATCH_SIZE);

  let synced = 0;

  // Sequential on purpose. Every send goes out through SES, and a parallel
  // burst of a large backlog is the fastest way to spike the bounce rate on a
  // domain that is still warming up.
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
