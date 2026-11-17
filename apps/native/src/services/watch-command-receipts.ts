/**
 * Which Watch commands the phone has finished with, whatever the outcome.
 *
 * The Watch keeps a tapped button busy until a snapshot shows the change, and
 * a command the phone declines (the phone changed the row since, the panel is
 * a drop-in or was cancelled, it is gone, it is a day old) never shows one.
 * So every iOS Watch payload lists the ids handled in the last day, and the
 * Watch settles any waiting tap among them: the button comes back, showing
 * whatever the phone decided.
 *
 * Memory is enough. The App Group queue is acknowledged only after the
 * snapshot carrying these ids has been handed to the native module, so a
 * process that dies before then reads the same commands again at its next
 * start and records them again.
 */

/** Mirrors `ConPawsWatchCommand.maxAge` in targets/_shared/ConPawsSnapshot.swift. */
export const WATCH_COMMAND_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** The native queue's cap, for the same reason: a day's worth of taps. */
export const WATCH_HANDLED_COMMANDS_LIMIT = 50;

/** Command id to when it was handled, oldest first. */
const handled = new Map<string, number>();

function prune(nowMs: number): void {
  for (const [id, handledAtMs] of handled) {
    if (nowMs - handledAtMs > WATCH_COMMAND_MAX_AGE_MS) handled.delete(id);
  }
  let excess = handled.size - WATCH_HANDLED_COMMANDS_LIMIT;
  for (const id of handled.keys()) {
    if (excess <= 0) break;
    handled.delete(id);
    excess -= 1;
  }
}

export function recordHandledWatchCommands(
  ids: Iterable<string>,
  nowMs: number,
): void {
  for (const id of ids) {
    // Re-inserted, so a repeat counts as the newest.
    handled.delete(id);
    handled.set(id, nowMs);
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

/** Tests only. */
export function resetHandledWatchCommands(): void {
  handled.clear();
}
