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
 * declared no zone of its own.
 *
 * ponytail: parses twice in the fallback case. That only happens for a feed
 * with no X-WR-TIMEZONE and no DTSTART TZID, which is the rare shape; splitting
 * zone discovery out of parseIcs would be the fix if it ever shows up in a
 * profile.
 */
export function parseIcsPreferringFeedTimeZone(
  icsContent: string,
  fallbackTimeZone?: string,
): ParseResult {
  const fromFeed = parseIcs(icsContent);
  if (!fromFeed.requiresTimeZone || !fallbackTimeZone) return fromFeed;
  return parseIcs(icsContent, { timeZone: fallbackTimeZone });
}
