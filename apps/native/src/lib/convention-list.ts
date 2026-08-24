import type { Convention } from "@/db/schema";
import {
  conventionDayKey,
  conventionStatusForDay,
  isValidTimeZone,
} from "./convention-time";

export type ConventionSort = "upcoming" | "name";

export function conventionStatusAt(
  convention: Convention,
  now: Date,
  deviceTimeZone: string,
): Convention["status"] {
  const timeZone = isValidTimeZone(convention.timeZone)
    ? convention.timeZone
    : deviceTimeZone;
  return conventionStatusForDay(
    convention.startDate,
    convention.endDate,
    conventionDayKey(now, timeZone),
  );
}

export function conventionDaysUntil(
  convention: Convention,
  now: Date,
  deviceTimeZone: string,
): number {
  const timeZone = isValidTimeZone(convention.timeZone)
    ? convention.timeZone
    : deviceTimeZone;
  const today = conventionDayKey(now, timeZone);

  return Math.round(
    (Date.parse(convention.startDate) - Date.parse(today)) / 86_400_000,
  );
}

export function partitionConventions(
  conventions: readonly Convention[],
  now: Date,
  deviceTimeZone: string,
): { current: Convention[]; archived: Convention[] } {
  const current: Convention[] = [];
  const archived: Convention[] = [];

  for (const convention of conventions) {
    (convention.archivedAt ||
    conventionStatusAt(convention, now, deviceTimeZone) === "ended"
      ? archived
      : current
    ).push(convention);
  }

  return { current, archived };
}

export function sortConventions(
  conventions: Convention[],
  sort: ConventionSort,
  compareNames: (left: string, right: string) => number,
  now: Date,
  deviceTimeZone: string,
): Convention[] {
  return conventions.slice().sort((left, right) => {
    if (sort === "name") return compareNames(left.name, right.name);

    const leftIsPast =
      conventionStatusAt(left, now, deviceTimeZone) === "ended";
    const rightIsPast =
      conventionStatusAt(right, now, deviceTimeZone) === "ended";
    if (leftIsPast !== rightIsPast) return leftIsPast ? 1 : -1;

    const dateOrder = leftIsPast
      ? right.startDate.localeCompare(left.startDate)
      : left.startDate.localeCompare(right.startDate);
    return dateOrder || compareNames(left.name, right.name);
  });
}
