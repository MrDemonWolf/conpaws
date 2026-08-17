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

export function conventionDayKey(
  value: string | Date,
  timeZone: string,
): string {
  return formatInConventionTime(value, timeZone, "yyyy-MM-dd");
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
