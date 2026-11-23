import { describeTimeZone } from "./time-zone-search";

// "GMT-5", "GMT+05:30", "UTC" — what an Intl implementation without generic
// zone names (the @formatjs polyfill under Hermes) produces for "longGeneric".
const OFFSET_ONLY = /^(GMT|UTC)([+\-−]\d{1,2}(:\d{2})?)?$/;

/**
 * A readable name for a convention's zone ("Eastern Time"). Where the runtime
 * can only offer a bare offset, the city from the IANA id is used instead
 * ("America/New_York" -> "New York"; "Etc/UTC" -> "UTC"): an offset is fixed
 * to one date, so it would be wrong for half the year in any zone with
 * daylight saving time.
 */
export function localizedTimeZoneName(
  timeZone: string,
  locale: string,
): string {
  try {
    const name = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    if (!name || OFFSET_ONLY.test(name)) return describeTimeZone(timeZone).city;
    return name;
  } catch {
    return timeZone;
  }
}
