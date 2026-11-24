/**
 * Which Watch commands the phone has finished with, and what it did with
 * each.
 *
 * The Watch keeps a tapped button busy until a snapshot shows the change, and
 * a command the phone declines (the phone changed the row since, the panel is
 * a drop-in or was withdrawn, it is gone, it is a day old) never shows one.
 * So every iOS Watch payload lists the ids handled in the last day, and the
 * Watch settles any waiting tap among them; the outcome beside each id lets
 * it say why a tap did not change anything.
 *
 * Kept here in memory and stored by watch-command-receipt-storage.ts, so a
 * phone app that restarts still lists a tap it declined: the snapshot that
 * first carried the receipt can be replaced before the Watch is back in
 * range, and a declined tap shows no change that could settle it instead.
 * This module stays free of storage so the snapshot code can read it.
 */

/** Mirrors `ConPawsWatchCommand.maxAge` in targets/_shared/ConPawsSnapshot.swift. */
export const WATCH_COMMAND_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** The native queue's cap, for the same reason: a day's worth of taps. */
export const WATCH_HANDLED_COMMANDS_LIMIT = 50;
/** Ids must be shorter than this, on both sides of the bridge. */
export const WATCH_COMMAND_MAX_ID_LENGTH = 256;

/**
 * What the phone did with a command, spelled as the Watch reads it
 * (`ConPawsWatchCommandOutcome` in targets/_shared). New values are safe to
 * add: a Watch that does not know one says only that nothing changed.
 *
 * - `applied`: saved or removed.
 * - `unchanged`: already in the state the command asks for.
 * - `expired`: older than a day, or stamped implausibly far ahead.
 * - `missing`: the event is gone, or belongs to another convention now.
 * - `superseded`: the phone changed the event after the Watch tap; the phone
 *   wins.
 * - `not-allowed`: a save the Watch cannot make, such as a drop-in, which
 *   needs a visit time.
 * - `cancelled`, `removed`: a save of a panel the convention cancelled or
 *   stopped listing (its `feedStatus`).
 * - `failed`: the phone tried and gave up.
 */
export const WATCH_COMMAND_OUTCOMES = [
  "applied",
  "unchanged",
  "expired",
  "missing",
  "superseded",
  "not-allowed",
  "cancelled",
  "removed",
  "failed",
] as const;

export type WatchCommandOutcome = (typeof WATCH_COMMAND_OUTCOMES)[number];

export interface WatchCommandReceipt {
  id: string;
  outcome: WatchCommandOutcome;
  handledAtMs: number;
}

/** Command id to its receipt, oldest first. */
const handled = new Map<string, WatchCommandReceipt>();

function isOutcome(value: unknown): value is WatchCommandOutcome {
  return (WATCH_COMMAND_OUTCOMES as readonly unknown[]).includes(value);
}

function isCommandId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length < WATCH_COMMAND_MAX_ID_LENGTH
  );
}

function prune(nowMs: number): void {
  for (const [id, receipt] of handled) {
    if (nowMs - receipt.handledAtMs > WATCH_COMMAND_MAX_AGE_MS)
      handled.delete(id);
  }
  let excess = handled.size - WATCH_HANDLED_COMMANDS_LIMIT;
  for (const id of handled.keys()) {
    if (excess <= 0) break;
    handled.delete(id);
    excess -= 1;
  }
}

export function recordHandledWatchCommands(
  receipts: Iterable<{ id: string; outcome: WatchCommandOutcome }>,
  nowMs: number,
): void {
  for (const { id, outcome } of receipts) {
    // Re-inserted, so a repeat counts as the newest.
    handled.delete(id);
    handled.set(id, { id, outcome, handledAtMs: nowMs });
  }
  prune(nowMs);
}

export function isHandledWatchCommand(id: string): boolean {
  return handled.has(id);
}

/** The ids for the next Watch payload, oldest first. */
export function handledWatchCommandIds(nowMs: number): string[] {
  prune(nowMs);
  return [...handled.keys()];
}

/** The outcome of each of `ids` that has a receipt. */
export function watchCommandOutcomes(
  ids: Iterable<string>,
): Record<string, WatchCommandOutcome> {
  const outcomes: Record<string, WatchCommandOutcome> = {};
  for (const id of ids) {
    const receipt = handled.get(id);
    if (receipt) outcomes[id] = receipt.outcome;
  }
  return outcomes;
}

/** Every receipt from the last day, oldest first, for storing. */
export function watchCommandReceipts(nowMs: number): WatchCommandReceipt[] {
  prune(nowMs);
  return [...handled.values()].map((receipt) => ({ ...receipt }));
}

/**
 * Adds the receipts an earlier process stored, as `watchCommandReceipts`
 * listed them, and returns how many it added. Entries it cannot trust are
 * skipped; a receipt this process already holds is newer and stays. A stamp
 * ahead of the clock reads as now, so it still expires after a day.
 */
export function restoreWatchCommandReceipts(
  stored: unknown,
  nowMs: number,
): number {
  if (!Array.isArray(stored)) return 0;
  const restored: WatchCommandReceipt[] = [];
  for (const entry of stored) {
    if (!entry || typeof entry !== "object") continue;
    const { id, outcome, handledAtMs } = entry as Record<string, unknown>;
    if (
      !isCommandId(id) ||
      !isOutcome(outcome) ||
      typeof handledAtMs !== "number" ||
      !Number.isFinite(handledAtMs) ||
      handled.has(id)
    )
      continue;
    restored.push({ id, outcome, handledAtMs: Math.min(handledAtMs, nowMs) });
  }
  if (restored.length === 0) return 0;

  const merged = [...handled.values(), ...restored].sort(
    (left, right) => left.handledAtMs - right.handledAtMs,
  );
  handled.clear();
  for (const receipt of merged) handled.set(receipt.id, receipt);
  prune(nowMs);
  return restored.filter((receipt) => handled.has(receipt.id)).length;
}

/** Tests only. */
export function resetHandledWatchCommands(): void {
  handled.clear();
}
