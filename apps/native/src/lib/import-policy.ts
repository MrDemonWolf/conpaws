import { type ParseResult, parseIcs } from "./ical-parser";

export interface ScheduleImportPolicyInput {
  conventionId: string | undefined;
  sourceUrl: string | null;
  selectedEventCount: number;
  sourceEventCount: number;
  cancelledEventCount: number;
}

export function canApplyScheduleImport({
  conventionId,
  sourceUrl,
  selectedEventCount,
  sourceEventCount,
  cancelledEventCount,
}: ScheduleImportPolicyInput): boolean {
  if (selectedEventCount > 0) return true;

  const isExistingConvention = !!conventionId && conventionId !== "new";
  if (!isExistingConvention) return false;
  if (cancelledEventCount > 0) return true;

  return sourceUrl !== null && sourceEventCount === 0;
}

/**
 * Whether a picked file is named as an iCalendar file.
 *
 * Case-insensitive: file providers keep the name's own casing, and a valid
 * calendar saved as `Schedule.ICS` must not be refused as the wrong type.
 */
export function isIcsFileName(name: string): boolean {
  return /\.ics$/i.test(name);
}

const UTC_ALIASES = new Set([
  "UTC",
  "UCT",
  "GMT",
  "GMT0",
  "GMT+0",
  "GMT-0",
  "ZULU",
  "UNIVERSAL",
  "GREENWICH",
  "ETC/UTC",
  "ETC/UCT",
  "ETC/GMT",
  "ETC/GMT0",
  "ETC/GMT+0",
  "ETC/GMT-0",
  "ETC/ZULU",
  "ETC/UNIVERSAL",
  "ETC/GREENWICH",
]);

/**
 * Whether a calendar's declared zone is just UTC under one of its names.
 *
 * Sched writes `X-WR-TIMEZONE:UTC` on every export, wherever the convention
 * is, and gives each event an absolute `Z` time. That declaration says how the
 * times were written, not where the convention takes place.
 */
export function isUtcAlias(timeZone: string | null | undefined): boolean {
  return !!timeZone && UTC_ALIASES.has(timeZone.trim().toUpperCase());
}

/**
 * Whether the import screen has to ask for the convention's zone before it
 * shows a preview.
 *
 * Asked when the calendar declares no zone, and also when it only declares UTC
 * and there is no zone to fall back on: filing a new convention under UTC put
 * every day header, hour chip and reminder five-odd hours off. A zone the user
 * picks on the prompt comes back as `fallbackTimeZone`, so picking UTC there
 * does not ask again.
 */
export function importNeedsTimeZone(
  result: Pick<ParseResult, "timezone" | "requiresTimeZone">,
  fallbackTimeZone?: string,
): boolean {
  return (
    result.requiresTimeZone ||
    (!fallbackTimeZone && isUtcAlias(result.timezone))
  );
}

/**
 * Parses a calendar for the import preview, letting the feed's own time zone
 * win over the convention's saved one.
 *
 * `parseIcs` treats `options.timeZone` as an override that beats
 * `X-WR-TIMEZONE`, which is right when the user has explicitly picked a zone
 * for a calendar that declares none. It is wrong as a way to supply the
 * convention's stored zone: a con whose saved zone differs from the zone its
 * own export declares would have every event silently retimed — and for a feed
 * of floating local times with no per-event TZID, that shifts the actual
 * instants, not just the labels.
 *
 * So the stored zone is a fallback: it is only consulted when the calendar
 * declared no zone of its own, or declared only UTC (see `isUtcAlias`). A
 * UTC-only feed is re-parsed in the stored zone rather than just relabelled,
 * so the preview, the import (which re-parses in the picked zone) and a
 * background refresh agree. Its `Z` times do not move; only floating times and
 * all-day dates are read in the convention's zone.
 *
 * ponytail: parses twice in the fallback case: a feed with no zone at all, or
 * a Sched feed for a convention that has a saved zone. Splitting zone
 * discovery out of parseIcs would be the fix if it ever shows up in a profile.
 */
export function parseIcsPreferringFeedTimeZone(
  icsContent: string,
  fallbackTimeZone?: string,
): ParseResult {
  const fromFeed = parseIcs(icsContent);
  if (!fallbackTimeZone) return fromFeed;
  if (!fromFeed.requiresTimeZone && !isUtcAlias(fromFeed.timezone)) {
    return fromFeed;
  }
  return parseIcs(icsContent, { timeZone: fallbackTimeZone });
}
