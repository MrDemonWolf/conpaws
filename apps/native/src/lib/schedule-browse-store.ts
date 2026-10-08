/**
 * The Browse view's selection -- which day, which hour, which category --
 * kept per convention outside React state, so it survives a trip to the
 * compare sheet or the event sheet and back, and so a sheet can change it.
 *
 * In memory only. A filter is a momentary choice, not a setting; a cold start
 * opening on today with every hour is the right default, not a surprise.
 */

import { useCallback, useSyncExternalStore } from "react";

/** The day-strip value meaning every day at once. Day keys are dates, so this cannot collide. */
export const ALL_DAYS = "all";

export interface BrowseState {
  /** A `yyyy-MM-dd` key, `ALL_DAYS`, or null while the screen has not resolved a default yet. */
  dayKey: string | null;
  /** Start of a convention-local hour, or null for every hour. */
  slotStartMs: number | null;
  category: string | null;
  /** A one-time notice the plan view shows after the compare sheet commits. */
  notice: "updated" | null;
}

const DEFAULT_STATE: BrowseState = Object.freeze({
  dayKey: null,
  slotStartMs: null,
  category: null,
  notice: null,
});

const states = new Map<string, BrowseState>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getBrowseState(conventionId: string): BrowseState {
  return states.get(conventionId) ?? DEFAULT_STATE;
}

export function setBrowseState(
  conventionId: string,
  patch: Partial<BrowseState>,
): void {
  const previous = getBrowseState(conventionId);
  const next = { ...previous, ...patch };
  if (
    next.dayKey === previous.dayKey &&
    next.slotStartMs === previous.slotStartMs &&
    next.category === previous.category &&
    next.notice === previous.notice
  ) {
    return;
  }
  states.set(conventionId, next);
  emit();
}

/** Drops the category only; the chosen day and hour are not a "filter". */
export function clearBrowseFilters(conventionId: string): void {
  setBrowseState(conventionId, { category: null });
}

export function resetBrowseState(conventionId: string): void {
  if (!states.has(conventionId)) return;
  states.delete(conventionId);
  emit();
}

export function subscribeBrowseState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useScheduleBrowseState(
  conventionId: string,
): [BrowseState, (patch: Partial<BrowseState>) => void] {
  const state = useSyncExternalStore(
    subscribeBrowseState,
    () => getBrowseState(conventionId),
    () => getBrowseState(conventionId),
  );
  const update = useCallback(
    (patch: Partial<BrowseState>) => setBrowseState(conventionId, patch),
    [conventionId],
  );
  return [state, update];
}
