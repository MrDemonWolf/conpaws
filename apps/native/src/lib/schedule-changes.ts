/**
 * What changed in a feed since it was last imported.
 *
 * This is a field comparison, deliberately not `planSourceReconciliation`.
 * That function answers "what should be written", and every identity-matched
 * row lands in its `updates` list whether or not a single field moved — a
 * perfect signal for applying an import and a useless one for deciding whether
 * to tell the user anything.
 *
 * The other rejected option was hashing the downloaded body. Both feed
 * generators this app targets regenerate `DTSTAMP` on every request, so a body
 * hash changes on every fetch and would produce a notice that never clears.
 */

/** The columns a change check reads, from either side of the comparison. */
export interface ScheduleOccurrence {
  /** Null marks a hand-added event, which no feed can speak for. */
  sourceUid: string | null;
  startTime: string;
  endTime: string | null;
  room: string | null;
  location: string | null;
  isInSchedule: boolean;
}

export interface ScheduleChangeSummary {
  /** Events whose time or place moved. */
  moved: number;
  /** Events the feed stopped listing, cancellations included. */
  gone: number;
  /** Of `moved`, the ones the user saved. */
  savedMoved: number;
  /** Of `gone`, the ones the user saved. */
  savedGone: number;
}

/**
 * Why a comparison refused to draw a conclusion.
 *
 * These are not errors and must never be shown. Each one describes a feed the
 * app cannot reason about, where the honest response is to leave the user's
 * schedule exactly as they left it and say nothing.
 */
export type UntrustedReason = "empty-feed" | "no-overlap" | "mass-removal";

export type ScheduleCheckOutcome =
  | { status: "unchanged" }
  | { status: "changed"; summary: ScheduleChangeSummary }
  | { status: "untrusted"; reason: UntrustedReason };

/**
 * Above this share of saved-and-imported events disappearing, assume the feed
 * is broken rather than the convention cancelling a fifth of its programme.
 */
export const MASS_REMOVAL_FRACTION = 0.2;

/** And an absolute ceiling, for a small schedule where a fifth is one event. */
export const MASS_REMOVAL_SAVED_LIMIT = 10;

function movedFrom(
  stored: ScheduleOccurrence,
  feed: ScheduleOccurrence,
): boolean {
  // Time and place only. A retitled panel is still the same panel in the same
  // room, and organizers fix wording far more often than they move anything —
  // counting titles would train the user to ignore the notice.
  return (
    stored.startTime !== feed.startTime ||
    stored.endTime !== feed.endTime ||
    stored.room !== feed.room ||
    stored.location !== feed.location
  );
}

/**
 * Compares a convention's stored events against a freshly parsed feed.
 *
 * Events the feed has gained are not reported. They are applied like anything
 * else, but they are not news the user has to act on, and a user who imported
 * only some categories would otherwise get a notice about panels they chose
 * not to have. ponytail: no `added` count. Add one once the import screen
 * persists its category selection, which is the thing that makes the number
 * meaningful.
 */
export function summarizeScheduleChanges(
  stored: readonly ScheduleOccurrence[],
  feedActive: readonly ScheduleOccurrence[],
  feedCancelledUids: readonly string[],
): ScheduleCheckOutcome {
  const sourced = stored.filter(
    (event): event is ScheduleOccurrence & { sourceUid: string } =>
      event.sourceUid !== null,
  );
  // Nothing here came from a feed, so the feed cannot have changed it.
  if (sourced.length === 0) return { status: "unchanged" };

  // A calendar that parsed cleanly but holds no events is far more often a
  // server having a bad minute than a convention cancelling itself. Treating
  // it as a change would wipe the schedule at the worst possible moment.
  if (feedActive.length === 0) return { status: "untrusted", reason: "empty-feed" };

  const activeByUid = new Map<string, ScheduleOccurrence>();
  for (const event of feedActive) {
    if (event.sourceUid !== null) activeByUid.set(event.sourceUid, event);
  }
  const cancelledUids = new Set(feedCancelledUids);

  let overlap = 0;
  let moved = 0;
  let gone = 0;
  let savedMoved = 0;
  let savedGone = 0;

  for (const event of sourced) {
    const match = activeByUid.get(event.sourceUid);
    if (match) {
      overlap++;
      if (movedFrom(event, match)) {
        moved++;
        if (event.isInSchedule) savedMoved++;
      }
      continue;
    }
    if (cancelledUids.has(event.sourceUid)) overlap++;
    gone++;
    if (event.isInSchedule) savedGone++;
  }

  // Not one stored event appears in the feed. That is a rewritten identifier
  // scheme, or the wrong feed behind a redirect — never a convention removing
  // its entire programme and publishing a new one in the same breath.
  if (overlap === 0) return { status: "untrusted", reason: "no-overlap" };

  if (
    gone / sourced.length > MASS_REMOVAL_FRACTION ||
    savedGone > MASS_REMOVAL_SAVED_LIMIT
  ) {
    return { status: "untrusted", reason: "mass-removal" };
  }

  if (moved === 0 && gone === 0) return { status: "unchanged" };
  return { status: "changed", summary: { moved, gone, savedMoved, savedGone } };
}

/** Whether a summary is worth putting on screen at all. */
export function hasSavedChanges(summary: ScheduleChangeSummary): boolean {
  return summary.savedMoved > 0 || summary.savedGone > 0;
}
