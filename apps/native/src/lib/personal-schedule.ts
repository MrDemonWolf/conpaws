import { conventionDayKey } from "./convention-time";

export interface PersonalScheduleEntry {
  id: string;
  conventionId: string;
  conventionName: string;
  /** The convention's IANA zone, already resolved by the caller. */
  timeZone: string;
  startTime: string;
  endTime: string | null;
  personalStartTime?: string | null;
  personalEndTime?: string | null;
}

export interface AttendanceIntervalEntry {
  startTime: string;
  endTime: string | null;
  personalStartTime?: string | null;
  personalEndTime?: string | null;
}

export type AttendanceTimeError =
  | "invalid-time"
  | "before-event-start"
  | "after-event-end"
  | "start-not-before-end";

export interface AttendanceInterval {
  startTime: string;
  endTime: string | null;
  needsReview: boolean;
}

/** Validate the user's chosen interval without changing the published event. */
export function attendanceTimeError(
  entry: AttendanceIntervalEntry,
): AttendanceTimeError | null {
  const hasPersonalStart = entry.personalStartTime != null;
  const hasPersonalEnd = entry.personalEndTime != null;
  if (!hasPersonalStart && !hasPersonalEnd) return null;

  const publishedStart = Date.parse(entry.startTime);
  const startTime = entry.personalStartTime ?? entry.startTime;
  const endTime = entry.personalEndTime ?? entry.endTime;
  const start = Date.parse(startTime);
  const end = endTime === null ? null : Date.parse(endTime);

  if (
    !Number.isFinite(publishedStart) ||
    !Number.isFinite(start) ||
    (entry.personalEndTime != null && !Number.isFinite(end))
  ) {
    return "invalid-time";
  }
  if (start < publishedStart) return "before-event-start";

  const publishedEnd =
    entry.endTime === null ? null : Date.parse(entry.endTime);
  if (
    Number.isFinite(publishedEnd) &&
    (publishedEnd as number) > publishedStart &&
    end !== null &&
    Number.isFinite(end) &&
    end > (publishedEnd as number)
  ) {
    return "after-event-end";
  }
  if (end !== null && Number.isFinite(end) && start >= end) {
    return "start-not-before-end";
  }
  return null;
}

/** Resolve personal choices while retaining out-of-bounds values for review. */
export function attendanceInterval(
  entry: AttendanceIntervalEntry,
): AttendanceInterval {
  const error = attendanceTimeError(entry);
  const publishedEnd =
    entry.endTime === null ? null : Date.parse(entry.endTime);
  const safePublishedEnd = Number.isFinite(publishedEnd) ? entry.endTime : null;
  return {
    startTime: error
      ? entry.startTime
      : (entry.personalStartTime ?? entry.startTime),
    endTime: error
      ? safePublishedEnd
      : (entry.personalEndTime ?? safePublishedEnd),
    needsReview: error !== null,
  };
}

/** Signed whole minutes from one planned stop ending to the next one starting. */
export function attendanceSeparationMinutes(
  current: AttendanceIntervalEntry,
  next: AttendanceIntervalEntry,
): number | null {
  const currentEnd = attendanceInterval(current).endTime;
  const nextStart = attendanceInterval(next).startTime;
  if (!currentEnd) return null;
  const end = Date.parse(currentEnd);
  const start = Date.parse(nextStart);
  return Number.isFinite(end) && Number.isFinite(start)
    ? Math.round((start - end) / 60_000)
    : null;
}

export interface PersonalScheduleDay<T extends PersonalScheduleEntry> {
  /** yyyy-MM-dd, in the entry's own convention time zone. */
  key: string;
  data: T[];
}

// Same fallback the per-convention schedule uses: imported and hand-added
// events may have no end time, and dropping them the moment they start would
// make an event vanish while the user is standing in it.
const NO_END_FALLBACK_MS = 60 * 60 * 1000;

function endOf(entry: PersonalScheduleEntry): number {
  const interval = attendanceInterval(entry);
  const start = Date.parse(interval.startTime);
  if (!interval.endTime) return start + NO_END_FALLBACK_MS;
  const end = Date.parse(interval.endTime);
  return Number.isFinite(end) && end > start ? end : start + NO_END_FALLBACK_MS;
}

/**
 * Group starred events from every convention into day sections.
 *
 * Two conventions can run in different time zones, so the day key comes from
 * each entry's own zone while ordering uses the absolute instant. A 9am panel
 * in Berlin and a 9am panel in Denver land on the same calendar day but eight
 * hours apart, and this sorts them the way the user will actually live them.
 *
 * Events that have already finished are dropped. This tab answers "what is
 * ahead of me", and a personal schedule accumulates across conventions — kept
 * whole it would open on a wall of last year's panels.
 */
export function groupPersonalScheduleByDay<T extends PersonalScheduleEntry>(
  entries: readonly T[],
  now: Date = new Date(),
): PersonalScheduleDay<T>[] {
  const nowMs = now.getTime();
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const interval = attendanceInterval(entry);
    const start = Date.parse(interval.startTime);
    if (!Number.isFinite(start)) continue;
    if (endOf(entry) <= nowMs) continue;

    const key = conventionDayKey(interval.startTime, entry.timeZone);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return [...groups.entries()]
    .map(([key, data]) => ({
      key,
      data: data.sort(
        (left, right) =>
          Date.parse(attendanceInterval(left).startTime) -
            Date.parse(attendanceInterval(right).startTime) ||
          left.conventionName.localeCompare(right.conventionName) ||
          left.id.localeCompare(right.id),
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * Whether the schedule spans more than one convention.
 *
 * When it does not, repeating the same convention name on every row is noise —
 * the same reasoning the per-convention screen applies to provenance labels.
 */
export function spansMultipleConventions(
  entries: readonly PersonalScheduleEntry[],
): boolean {
  const seen = new Set<string>();
  for (const entry of entries) {
    seen.add(entry.conventionId);
    if (seen.size > 1) return true;
  }
  return false;
}
