/**
 * Which saved events a candidate collides with, and what saving it would do
 * to them. This is the logic behind the compare sheet, ported from the design
 * exploration's `getConflicts` and `commitChoice` (`docs/mobile-ux/app.ts`)
 * onto the app's single saved state.
 *
 * Conflicts are direct only: A overlapping B and B overlapping C never makes
 * A and C conflict. Chaining would turn a busy afternoon into one blob.
 */

import { DROP_IN_MIN_DURATION_MS } from "./schedule-browse";

export interface CompareEvent {
  id: string;
  startTime: string;
  endTime: string | null;
  isInSchedule: boolean;
  feedStatus: "cancelled" | "removed" | null;
}

function interval(
  event: Pick<CompareEvent, "startTime" | "endTime">,
): { start: number; end: number } | null {
  if (!event.endTime) return null;
  const start = Date.parse(event.startTime);
  const end = Date.parse(event.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return null;
  // Drop-in programming is never a conflict; see schedule-browse.ts.
  if (end - start >= DROP_IN_MIN_DURATION_MS) return null;
  return { start, end };
}

/**
 * Minutes the two events share. Zero when either has no usable end time --
 * an unknown end is not evidence of a clash -- or when either is a drop-in.
 */
export function overlapMinutesBetween(
  left: Pick<CompareEvent, "startTime" | "endTime">,
  right: Pick<CompareEvent, "startTime" | "endTime">,
): number {
  const a = interval(left);
  const b = interval(right);
  if (!a || !b) return 0;
  const shared = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  return shared > 0 ? Math.round(shared / 60_000) : 0;
}

export interface CompareSet<T extends CompareEvent> {
  candidate: T;
  /** Saved, still-published events that directly overlap the candidate. */
  conflicts: T[];
  /** Candidate plus conflicts: saved ones first, then by start. */
  cards: T[];
}

export function compareCandidates<T extends CompareEvent>(
  events: readonly T[],
  candidateId: string,
): CompareSet<T> | null {
  const candidate = events.find(
    (event) => event.id === candidateId && event.feedStatus === null,
  );
  if (!candidate) return null;

  const conflicts = events.filter(
    (event) =>
      event.id !== candidate.id &&
      event.isInSchedule &&
      event.feedStatus === null &&
      overlapMinutesBetween(candidate, event) > 0,
  );

  const cards = [candidate, ...conflicts].sort(
    (left, right) =>
      Number(right.isInSchedule) - Number(left.isInSchedule) ||
      Date.parse(left.startTime) - Date.parse(right.startTime) ||
      left.id.localeCompare(right.id),
  );

  return { candidate, conflicts, cards };
}

export interface PlanChange {
  /** Ids to save. */
  add: string[];
  /** Ids to unsave. */
  remove: string[];
}

/**
 * The saved-state diff for a choice made on the compare sheet.
 *
 * Keeping both saves the candidate and removes nothing. Choosing one saves it
 * (if it is not already) and unsaves every other card that directly overlaps
 * it. Nothing outside the sheet's cards is ever touched.
 */
export function planAfterChoice<T extends CompareEvent>(
  set: CompareSet<T>,
  selectedId: string,
  keepBoth: boolean,
): PlanChange {
  const selected = set.cards.find((card) => card.id === selectedId);
  if (!selected) return { add: [], remove: [] };

  const add = selected.isInSchedule ? [] : [selected.id];
  if (keepBoth) return { add, remove: [] };

  const remove = set.cards
    .filter(
      (card) =>
        card.id !== selected.id &&
        card.isInSchedule &&
        overlapMinutesBetween(selected, card) > 0,
    )
    .map((card) => card.id);

  return { add, remove };
}
