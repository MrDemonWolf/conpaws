import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function fromConventionTime(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string,
): Date {
  const date = new TZDate(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    timeZone,
  );
  return new Date(date.getTime());
}

export function formatInConventionTime(
  value: string | Date,
  timeZone: string,
  pattern: string,
): string {
  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return format(new TZDate(timestamp, timeZone), pattern);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The instant a convention-local wall clock stands for, or null when that wall
 * clock does not exist in the zone. Compared to the minute, or to the second
 * when `second` is given.
 *
 * Spring forward skips an hour: 2:30 AM on the second Sunday of March never
 * happens in US Central, and the zone arithmetic quietly lands on 3:30 AM
 * instead. Round-tripping the result back through the zone is the only way to
 * catch it, and a caller that skips the check stores the event an hour off and
 * fires its reminder at the wrong time.
 */
export function resolveConventionWallClock(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second?: number;
  },
  timeZone: string,
): Date | null {
  const instant = fromConventionTime(parts, timeZone);
  const withSeconds = parts.second !== undefined;
  const requested = `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}${withSeconds ? `:${pad(parts.second ?? 0)}` : ""}`;

  return formatInConventionTime(
    instant,
    timeZone,
    withSeconds ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd HH:mm",
  ) === requested
    ? instant
    : null;
}

export function conventionDayKey(
  value: string | Date,
  timeZone: string,
): string {
  return formatInConventionTime(value, timeZone, "yyyy-MM-dd");
}

/** Whole calendar days from one yyyy-MM-dd key to another; NaN when either key is invalid. */
export function dayKeyDifference(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export function conventionStatusForDay(
  startDate: string,
  endDate: string,
  today: string,
): "upcoming" | "active" | "ended" {
  if (today < startDate) return "upcoming";
  if (today > endDate) return "ended";
  return "active";
}

export function overlappingEventIds(
  events: readonly {
    id: string;
    startTime: string;
    endTime: string | null;
  }[],
): Set<string> {
  const conflicting = new Set<string>();

  // ponytail: personal schedules are small; replace with a sweep line if that changes.
  for (let index = 0; index < events.length; index++) {
    const event = events[index];
    if (!event?.endTime) continue;
    const start = Date.parse(event.startTime);
    const end = Date.parse(event.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      continue;

    for (let otherIndex = index + 1; otherIndex < events.length; otherIndex++) {
      const other = events[otherIndex];
      if (!other?.endTime) continue;
      const otherStart = Date.parse(other.startTime);
      const otherEnd = Date.parse(other.endTime);
      if (
        Number.isFinite(otherStart) &&
        Number.isFinite(otherEnd) &&
        otherEnd > otherStart &&
        start < otherEnd &&
        otherStart < end
      ) {
        conflicting.add(event.id);
        conflicting.add(other.id);
      }
    }
  }

  return conflicting;
}
