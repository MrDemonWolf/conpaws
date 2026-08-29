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

/**
 * Whether the Unarchive action makes sense for this convention.
 *
 * The archive bucket holds two different things: conventions the user
 * explicitly archived (`archivedAt` set) and conventions that simply ended
 * (`partitionConventions` files those under archived with no flag at all).
 * Unarchiving an ended convention would be a visual no-op — clearing the flag
 * puts it straight back in the archived bucket — so the action is only offered
 * when clearing the flag actually moves the row. The "Past" status label on
 * the row is the explanation for the rest.
 */
export function canUnarchive(
  convention: Convention,
  now: Date,
  deviceTimeZone: string,
): boolean {
  return (
    Boolean(convention.archivedAt) &&
    conventionStatusAt(convention, now, deviceTimeZone) !== "ended"
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
