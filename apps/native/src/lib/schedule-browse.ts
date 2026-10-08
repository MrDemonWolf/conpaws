/**
 * Pure selectors behind the Browse view of a convention schedule: the day
 * strip, the hour chips, the search box and the category filter.
 *
 * Everything here takes plain objects so the rules are testable without the
 * database types, the same way `schedule-view.ts` and `day-band.ts` do. The
 * rules themselves come from the design exploration in `docs/mobile-ux/app.ts`
 * (`selectSchedulePanels`), whose tests are ported to `schedule-browse.test.ts`.
 */

import {
  conventionDayKey,
  formatInConventionTime,
  fromConventionTime,
  overlappingEventIds,
} from "./convention-time";

export interface BrowseEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  room: string | null;
  location: string | null;
  category: string | null;
  description: string | null;
  isInSchedule: boolean;
  feedStatus: "cancelled" | "removed" | null;
}

export const HOUR_MS = 60 * 60 * 1000;

/**
 * Anything this long is drop-in programming -- a dealers' den, an artists'
 * alley, an open gaming room -- rather than a timed commitment. The mockup
 * lists those under "Drop in anytime" and keeps them out of the hour chips and
 * out of overlap conflicts, because a saved ten-to-six room should not flag
 * every other saved panel of the day.
 */
export const DROP_IN_MIN_DURATION_MS = 4 * HOUR_MS;

/**
 * Same fallback the other schedule helpers use: an event with no published
 * end is treated as an hour long so it can still be matched and ordered.
 */
const NO_END_FALLBACK_MS = HOUR_MS;

/** The longest convention the day strip will enumerate day by day. */
const MAX_STRIP_DAYS = 60;

function startMs(event: Pick<BrowseEvent, "startTime">): number {
  return Date.parse(event.startTime);
}

function endMs(event: Pick<BrowseEvent, "startTime" | "endTime">): number {
  const start = startMs(event);
  if (!event.endTime) return start + NO_END_FALLBACK_MS;
  const end = Date.parse(event.endTime);
  return Number.isFinite(end) && end > start ? end : start + NO_END_FALLBACK_MS;
}

function hasValidStart(event: Pick<BrowseEvent, "startTime">): boolean {
  return Number.isFinite(startMs(event));
}

export function isDropInEvent(
  event: Pick<BrowseEvent, "startTime" | "endTime">,
): boolean {
  if (!event.endTime) return false;
  const start = startMs(event);
  const end = Date.parse(event.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end - start >= DROP_IN_MIN_DURATION_MS;
}

/**
 * The convention's calendar days, inclusive, plus any extra day an event
 * happens to fall on (a pre-con party the night before, say). Keys are
 * `yyyy-MM-dd` in the convention's own zone, sorted.
 */
export function conventionDayKeys(
  startDate: string,
  endDate: string,
  events: readonly Pick<BrowseEvent, "startTime">[],
  timeZone: string,
): string[] {
  const keys = new Set<string>();

  const first = Date.parse(`${startDate}T00:00:00Z`);
  const last = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isFinite(first) && Number.isFinite(last) && last >= first) {
    const span = Math.min(
      Math.round((last - first) / 86_400_000),
      MAX_STRIP_DAYS - 1,
    );
    for (let offset = 0; offset <= span; offset++) {
      keys.add(
        new Date(first + offset * 86_400_000).toISOString().slice(0, 10),
      );
    }
  }

  for (const event of events) {
    if (!hasValidStart(event)) continue;
    keys.add(conventionDayKey(event.startTime, timeZone));
  }

  return [...keys].sort();
}

/** How many timed events start on each convention day. */
export function dayCounts(
  events: readonly Pick<BrowseEvent, "startTime" | "endTime">[],
  timeZone: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!hasValidStart(event) || isDropInEvent(event)) continue;
    const key = conventionDayKey(event.startTime, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Which day the strip opens on: today while the convention is running,
 * otherwise the first day that has anything on it, otherwise the first day.
 * Null only when there are no days at all.
 */
export function defaultBrowseDay(
  dayKeys: readonly string[],
  counts: ReadonlyMap<string, number>,
  todayKey: string,
): string | null {
  if (dayKeys.length === 0) return null;
  if (dayKeys.includes(todayKey)) return todayKey;
  return dayKeys.find((key) => (counts.get(key) ?? 0) > 0) ?? dayKeys[0];
}

/** The start of the convention-local hour an instant falls in. */
export function hourSlotStartMs(
  value: string | number | Date,
  timeZone: string,
): number {
  const date =
    typeof value === "number"
      ? new Date(value)
      : value instanceof Date
        ? value
        : new Date(value);
  const [year, month, day, hour] = formatInConventionTime(
    date,
    timeZone,
    "yyyy-MM-dd-HH",
  )
    .split("-")
    .map(Number);
  return fromConventionTime({ year, month, day, hour }, timeZone).getTime();
}

/**
 * The distinct hour slots at which timed events start on a day (every day when
 * `dayKey` is null), in order. These are the chips: a convention with nothing
 * at 11 AM gets no 11 AM chip.
 */
export function hourSlotsFor(
  events: readonly Pick<BrowseEvent, "startTime" | "endTime">[],
  dayKey: string | null,
  timeZone: string,
): number[] {
  const slots = new Set<number>();
  for (const event of events) {
    if (!hasValidStart(event) || isDropInEvent(event)) continue;
    if (
      dayKey !== null &&
      conventionDayKey(event.startTime, timeZone) !== dayKey
    )
      continue;
    slots.add(hourSlotStartMs(event.startTime, timeZone));
  }
  return [...slots].sort((left, right) => left - right);
}

/** The mockup rule: an event belongs to an hour if any part of it runs then. */
export function matchesHourSlot(
  event: Pick<BrowseEvent, "startTime" | "endTime">,
  slotStartMs: number,
): boolean {
  if (!hasValidStart(event)) return false;
  return startMs(event) < slotStartMs + HOUR_MS && endMs(event) > slotStartMs;
}

/** Case-insensitive match over the fields a reader might type. */
export function matchesSearch(
  event: Pick<
    BrowseEvent,
    "title" | "description" | "category" | "room" | "location"
  >,
  normalizedQuery: string,
): boolean {
  if (normalizedQuery.length === 0) return true;
  return [
    event.title,
    event.description ?? "",
    event.category ?? "",
    event.room ?? "",
    event.location ?? "",
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export interface BrowseFilters {
  /** `yyyy-MM-dd` in the convention zone, or null for every day. */
  dayKey: string | null;
  /** Start of a convention-local hour, or null for all times. */
  slotStartMs: number | null;
  category: string | null;
  query: string;
}

export interface BrowseSelection<T extends BrowseEvent> {
  /** Timed events after every filter, in schedule order. */
  rows: T[];
  /** Drop-in programming for the selected day(s), after category and search. */
  dropIns: T[];
  /** Timed events matching day and slot only -- the "12 total" in a heading. */
  total: number;
  /** Distinct days among `rows`, for the all-days heading. */
  dayCount: number;
}

function compareByStart(
  left: Pick<BrowseEvent, "id" | "title" | "room" | "startTime">,
  right: Pick<BrowseEvent, "id" | "title" | "room" | "startTime">,
): number {
  return (
    startMs(left) - startMs(right) ||
    (left.room ?? "").localeCompare(right.room ?? "") ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

export function selectBrowseEvents<T extends BrowseEvent>(
  events: readonly T[],
  filters: BrowseFilters,
  timeZone: string,
): BrowseSelection<T> {
  const query = normalizeSearchQuery(filters.query);
  const onDay = (event: T) =>
    filters.dayKey === null ||
    conventionDayKey(event.startTime, timeZone) === filters.dayKey;
  const inCategory = (event: T) =>
    filters.category === null || event.category === filters.category;

  const valid = events.filter(hasValidStart);
  const timed = valid.filter((event) => !isDropInEvent(event));

  const byDayAndSlot = timed.filter(
    (event) =>
      onDay(event) &&
      (filters.slotStartMs === null ||
        matchesHourSlot(event, filters.slotStartMs)),
  );
  const rows = byDayAndSlot
    .filter((event) => inCategory(event) && matchesSearch(event, query))
    .sort(compareByStart);

  const dropIns = valid
    .filter(
      (event) =>
        isDropInEvent(event) &&
        onDay(event) &&
        inCategory(event) &&
        matchesSearch(event, query),
    )
    .sort(compareByStart);

  const days = new Set(
    rows.map((event) => conventionDayKey(event.startTime, timeZone)),
  );

  return { rows, dropIns, total: byDayAndSlot.length, dayCount: days.size };
}

/**
 * Saved, still-published, timed events that genuinely clash with another
 * saved event. Drop-ins never count: a room you can wander into all day is
 * not a conflict with a panel.
 */
export function conflictingSavedIds(
  events: readonly Pick<
    BrowseEvent,
    "id" | "startTime" | "endTime" | "isInSchedule" | "feedStatus"
  >[],
): Set<string> {
  return overlappingEventIds(
    events.filter(
      (event) =>
        event.isInSchedule &&
        event.feedStatus === null &&
        !isDropInEvent(event),
    ),
  );
}

/**
 * The browse state that guarantees an event is on screen -- its own day, all
 * times, no category -- so a deep link can scroll to it.
 */
export function browseStateForEvent(
  event: Pick<BrowseEvent, "startTime">,
  timeZone: string,
): { dayKey: string; slotStartMs: null; category: null } {
  return {
    dayKey: conventionDayKey(event.startTime, timeZone),
    slotStartMs: null,
    category: null,
  };
}
