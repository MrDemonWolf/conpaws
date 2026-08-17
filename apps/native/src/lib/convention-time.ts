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
