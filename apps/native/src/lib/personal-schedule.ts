import { conventionDayKey } from "./convention-time";

export interface PersonalScheduleEntry {
  id: string;
  conventionId: string;
  conventionName: string;
  /** The convention's IANA zone, already resolved by the caller. */
  timeZone: string;
  startTime: string;
  endTime: string | null;
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
  const start = Date.parse(entry.startTime);
  if (!entry.endTime) return start + NO_END_FALLBACK_MS;
  const end = Date.parse(entry.endTime);
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
    const start = Date.parse(entry.startTime);
    if (!Number.isFinite(start)) continue;
    if (endOf(entry) <= nowMs) continue;

    const key = conventionDayKey(entry.startTime, entry.timeZone);
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
          Date.parse(left.startTime) - Date.parse(right.startTime) ||
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
