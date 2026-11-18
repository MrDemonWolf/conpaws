import { requireOptionalNativeModule } from "expo";
import { AppState } from "react-native";
import * as eventsRepo from "@/db/repositories/events";
import { reportError } from "@/lib/error-reporting";
import { isDropInEvent } from "@/lib/schedule-browse";
import { removeEventFromPlan, saveEventToPlan } from "./event-schedule";
import {
  isHandledWatchCommand,
  recordHandledWatchCommands,
  WATCH_COMMAND_MAX_AGE_MS,
} from "./watch-command-receipts";
import { publishWidgetSnapshot } from "./widget-snapshot";

/**
 * Save and remove taps from the Apple Watch.
 *
 * The Watch sends a command over WatchConnectivity; the native module checks
 * its shape and queues it in the App Group, with or without JS running, and
 * this applies the queue the next time JS can: at start, on the module's
 * "onWatchCommand" event and whenever the app becomes active. That is the
 * tracked event's Stop precedent: native records, JS applies. A phone app
 * iOS has terminated starts no JS for a Watch tap (React Native waits for a
 * scene), so such a tap is applied when the app is next opened.
 *
 * The queue is read, applied, published and only then acknowledged, so a
 * process that dies part-way reads the same commands again at its next start;
 * applying one twice changes nothing the second time. A command that fails
 * stays queued and is tried again at the next drain, a few times at most.
 *
 * The phone stays the source of truth. A command never overrides a change
 * made on the phone after the tap, and the Watch only shows the result once
 * the snapshot published after the batch says so. That snapshot also lists
 * the command as handled, so a declined tap frees its button on the Watch.
 */

export { WATCH_COMMAND_MAX_AGE_MS };
/** Ids must be shorter than this, on both sides of the bridge. */
export const WATCH_COMMAND_MAX_ID_LENGTH = 256;
/** The native event that says commands are waiting. */
export const WATCH_COMMAND_EVENT = "onWatchCommand";
/** Tries before a failing command is given up on and reported handled. */
export const WATCH_COMMAND_MAX_ATTEMPTS = 3;

export type WatchCommandAction = "save" | "remove";

export interface WatchCommand {
  id: string;
  action: WatchCommandAction;
  conventionId: string;
  eventId: string;
  sentAtMs: number;
}

export type WatchCommandOutcome =
  | "applied"
  /** Already in the state the command asks for. */
  | "unchanged"
  /** Older than a day, or stamped implausibly far ahead. */
  | "expired"
  /** The event is gone, or belongs to another convention now. */
  | "missing"
  /** The phone changed the event after the Watch tap; the phone wins. */
  | "superseded"
  /** A drop-in, or a panel the convention cancelled or changed. */
  | "not-allowed"
  | "failed";

export interface WatchCommandBatchResult {
  outcomes: { command: WatchCommand; outcome: WatchCommandOutcome }[];
  changedConventionIds: string[];
}

interface NativeWatchCommandModule {
  /** The queued commands as JSON strings, oldest first, left in place. */
  peekWatchCommands?(): unknown;
  /** Takes these command ids off the queue. */
  acknowledgeWatchCommands?(ids: string[]): unknown;
  addListener?(name: string, listener: () => void): { remove(): void };
}

const nativeModule =
  requireOptionalNativeModule<NativeWatchCommandModule>("ConPawsWidgets");

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length < WATCH_COMMAND_MAX_ID_LENGTH
  );
}

/** A command, or null for anything that is not exactly one. */
export function parseWatchCommand(raw: unknown): WatchCommand | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, action, conventionId, eventId, sentAtMs } = value as Record<
    string,
    unknown
  >;
  if (
    !isIdentifier(id) ||
    !isIdentifier(conventionId) ||
    !isIdentifier(eventId) ||
    (action !== "save" && action !== "remove") ||
    typeof sentAtMs !== "number" ||
    !Number.isFinite(sentAtMs)
  )
    return null;
  return { id, action, conventionId, eventId, sentAtMs };
}

/**
 * When the row last changed. The repositories write ISO strings; rows that
 * kept SQLite's `datetime('now')` default read "YYYY-MM-DD HH:MM:SS", which is
 * UTC but which Hermes would otherwise parse as local time or not at all.
 */
export function rowUpdatedAtMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  const sqlite = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(
    value,
  );
  return Date.parse(sqlite ? `${sqlite[1]}T${sqlite[2]}Z` : value);
}

async function applyOne(
  command: WatchCommand,
  nowMs: number,
  phoneUpdatedAt: Map<string, number>,
): Promise<WatchCommandOutcome> {
  if (Math.abs(nowMs - command.sentAtMs) > WATCH_COMMAND_MAX_AGE_MS)
    return "expired";

  const event = await eventsRepo.getById(command.eventId);
  if (!event || event.conventionId !== command.conventionId) return "missing";

  // The phone's last change, read before this batch wrote to the row: a save
  // and a remove queued on the Watch must not supersede each other just
  // because applying the first one touched the row.
  const updatedAtMs =
    phoneUpdatedAt.get(event.id) ?? rowUpdatedAtMs(event.updatedAt);
  if (Number.isFinite(updatedAtMs) && command.sentAtMs < updatedAtMs)
    return "superseded";

  if (command.action === "save") {
    if (event.isInSchedule) return "unchanged";
    // A drop-in needs a visit time the Watch cannot choose, and a marked
    // panel is one the convention stopped running.
    if (isDropInEvent(event) || event.feedStatus !== null) return "not-allowed";
    phoneUpdatedAt.set(event.id, updatedAtMs);
    await saveEventToPlan(event);
    return "applied";
  }

  if (!event.isInSchedule) return "unchanged";
  phoneUpdatedAt.set(event.id, updatedAtMs);
  await removeEventFromPlan(event);
  return "applied";
}

/** The id of a queued entry that did not parse, so it can still be dropped. */
function rawCommandId(raw: unknown): string | null {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object") return null;
    const { id } = value as Record<string, unknown>;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Applies a batch in the order the Watch sent it. Malformed and duplicate
 * commands are dropped; one that fails is reported and the rest still run.
 */
export async function applyWatchCommands(
  rawCommands: readonly unknown[],
  nowMs = Date.now(),
): Promise<WatchCommandBatchResult> {
  const seen = new Set<string>();
  const commands = rawCommands
    .map(parseWatchCommand)
    .filter((command): command is WatchCommand => {
      if (!command || seen.has(command.id)) return false;
      seen.add(command.id);
      return true;
    })
    .map((command, order) => ({ command, order }))
    .sort(
      (left, right) =>
        left.command.sentAtMs - right.command.sentAtMs ||
        left.order - right.order,
    )
    .map(({ command }) => command);

  const phoneUpdatedAt = new Map<string, number>();
  const changed = new Set<string>();
  const outcomes: WatchCommandBatchResult["outcomes"] = [];
  for (const command of commands) {
    let outcome: WatchCommandOutcome;
    try {
      outcome = await applyOne(command, nowMs, phoneUpdatedAt);
    } catch (error) {
      reportError(error, { scope: "watchCommands.apply" });
      outcome = "failed";
    }
    if (outcome === "applied") changed.add(command.conventionId);
    outcomes.push({ command, outcome });
  }
  return { outcomes, changedConventionIds: [...changed] };
}

export interface WatchCommandOptions {
  /** Invalidates the screens' caches for these conventions and the Schedule tab. */
  refreshCaches: (conventionIds: readonly string[]) => unknown;
}

let options: WatchCommandOptions | null = null;
let draining: Promise<void> | null = null;
let drainAgain = false;
/** Failed tries per command id, for this process. */
const failedAttempts = new Map<string, number>();

function peekQueued(): unknown[] {
  try {
    const queued = nativeModule?.peekWatchCommands?.();
    return Array.isArray(queued) ? queued : [];
  } catch (error) {
    reportError(error, { scope: "watchCommands.peek" });
    return [];
  }
}

function acknowledge(ids: readonly string[]): void {
  if (ids.length === 0) return;
  try {
    nativeModule?.acknowledgeWatchCommands?.([...ids]);
  } catch (error) {
    // Left queued: the next drain finds them handled and acknowledges again.
    reportError(error, { scope: "watchCommands.acknowledge" });
  }
}

async function drainOnce(): Promise<void> {
  const queued = peekQueued();
  if (queued.length === 0) return;
  const nowMs = Date.now();

  /** Ids to take off the queue once the snapshot that reflects them is out. */
  const finished = new Set<string>();
  const fresh: WatchCommand[] = [];
  for (const raw of queued) {
    const command = parseWatchCommand(raw);
    if (!command) {
      // Native checks the same rules before queueing, so this is damage, and
      // it never becomes valid by waiting.
      const id = rawCommandId(raw);
      if (id) finished.add(id);
    } else if (isHandledWatchCommand(command.id)) {
      // Handled by an earlier pass whose acknowledgement did not land, or
      // delivered twice; its id is already in the published snapshot.
      finished.add(command.id);
    } else {
      fresh.push(command);
    }
  }

  const result = await applyWatchCommands(fresh, nowMs);
  const handled: string[] = [];
  for (const { command, outcome } of result.outcomes) {
    if (outcome === "failed") {
      const attempts = (failedAttempts.get(command.id) ?? 0) + 1;
      if (attempts < WATCH_COMMAND_MAX_ATTEMPTS) {
        failedAttempts.set(command.id, attempts);
        continue;
      }
    }
    failedAttempts.delete(command.id);
    handled.push(command.id);
    finished.add(command.id);
  }
  recordHandledWatchCommands(handled, nowMs);

  if (result.changedConventionIds.length > 0) {
    try {
      await options?.refreshCaches(result.changedConventionIds);
    } catch (error) {
      reportError(error, { scope: "watchCommands.refreshCaches" });
    }
  }
  // Even a batch that changed nothing republishes: the snapshot lists every
  // handled id, which is how the Watch learns a tap is done, whether it was
  // applied, was already so or was declined.
  if (handled.length > 0) {
    await publishWidgetSnapshot().catch((error: unknown) => {
      reportError(error, { scope: "watchCommands.publishWidgetSnapshot" });
    });
  }
  acknowledge([...finished]);
}

/**
 * One drain at a time. A trigger that lands mid-drain runs one more pass
 * afterwards, so a command queued while the last batch was applying is not
 * left waiting for the next foreground.
 */
export function drainWatchCommands(): Promise<void> {
  if (draining) {
    drainAgain = true;
    return draining;
  }
  draining = (async () => {
    try {
      do {
        drainAgain = false;
        await drainOnce();
      } while (drainAgain);
    } finally {
      draining = null;
    }
  })();
  return draining;
}

/** Starts applying Watch commands; iOS only. Returns the cleanup. */
export function initWatchCommands(next: WatchCommandOptions): () => void {
  if (process.env.EXPO_OS !== "ios" || !nativeModule?.peekWatchCommands)
    return () => undefined;
  options = next;
  const drain = () => {
    drainWatchCommands().catch((error: unknown) => {
      reportError(error, { scope: "watchCommands.drain" });
    });
  };
  drain();
  const subscription = nativeModule.addListener?.(WATCH_COMMAND_EVENT, drain);
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") drain();
  });
  return () => {
    subscription?.remove();
    appState.remove();
    if (options === next) options = null;
  };
}
