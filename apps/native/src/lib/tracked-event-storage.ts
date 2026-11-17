import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TrackedEventSelection } from "./tracked-event.types";

/**
 * Which event this device is tracking.
 *
 * AsyncStorage rather than the database for the same reason as the schedule
 * refresh bookkeeping: it describes what this phone is showing on its Lock
 * Screen or notification shade, not the user's data. A column would ride along
 * in backup export and restore a tracked event onto a phone that is showing
 * nothing.
 */
export const TRACKED_EVENT_STORAGE_KEY = "trackedEvent";

let cachedSelection: TrackedEventSelection | null | undefined;

function parseSelection(stored: string | null): TrackedEventSelection | null {
  if (stored === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { eventId, conventionId, startedAtMs } = value as Record<
    string,
    unknown
  >;
  if (
    typeof eventId !== "string" ||
    !eventId ||
    typeof conventionId !== "string" ||
    !conventionId ||
    typeof startedAtMs !== "number" ||
    !Number.isFinite(startedAtMs)
  ) {
    return null;
  }
  return { eventId, conventionId, startedAtMs };
}

/**
 * Tolerant: a failed read or a value this version cannot understand reads as
 * nothing tracked. Reconciliation then ends any presentation still showing, so
 * the worst case is a Lock Screen entry that goes away, never one that sticks.
 */
export async function loadTrackedEventSelection(): Promise<TrackedEventSelection | null> {
  const stored = await AsyncStorage.getItem(TRACKED_EVENT_STORAGE_KEY).catch(
    () => null,
  );
  cachedSelection = parseSelection(stored);
  return cachedSelection;
}

/** Null until `loadTrackedEventSelection` has primed the cache. */
export function getCachedTrackedEventSelection(): TrackedEventSelection | null {
  return cachedSelection ?? null;
}

/**
 * Rejects when the write fails and puts the cache back, so memory and disk
 * agree either way and the caller can undo what it just showed.
 */
export async function saveTrackedEventSelection(
  selection: TrackedEventSelection,
): Promise<void> {
  const previous = cachedSelection;
  cachedSelection = selection;
  try {
    await AsyncStorage.setItem(
      TRACKED_EVENT_STORAGE_KEY,
      JSON.stringify(selection),
    );
  } catch (error) {
    cachedSelection = previous;
    throw error;
  }
}

/**
 * Rejects when the removal fails, but the cache stays cleared: by then the
 * presentation has already been ended, and the app should stop showing it as
 * tracked. A stale value left on disk is harmless, because the next launch
 * finds nothing showing for it and clears it again.
 */
export async function clearTrackedEventSelection(): Promise<void> {
  cachedSelection = null;
  await AsyncStorage.removeItem(TRACKED_EVENT_STORAGE_KEY);
}
