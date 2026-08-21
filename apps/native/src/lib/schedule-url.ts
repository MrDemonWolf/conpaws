/**
 * Normalizes the three things a user can paste into the import field:
 * a Sched convention URL, a direct `.ics` link, and a `webcal://` link.
 */

export class InvalidScheduleUrlError extends Error {
  constructor(url: string) {
    super(
      `Invalid schedule URL: "${url}". Paste a Sched address, an .ics link, or a webcal:// link.`,
    );
    this.name = "InvalidScheduleUrlError";
  }
}

export type ScheduleUrlKind = "sched" | "ics";

export interface ResolvedScheduleUrl {
  /** The https URL to actually fetch. */
  fetchUrl: string;
  kind: ScheduleUrlKind;
  /** Cleaned-up form of what the user pasted, for storing as `icalUrl`. */
  canonicalUrl: string;
}

const SCHED_PATTERN = /^https:\/\/([a-zA-Z0-9-]+)\.sched\.com(\/.*)?$/;

/**
 * `webcal:` is not a real transport — it is `https:` with a scheme that asks
 * the OS to hand the URL to a calendar app. Swapping the scheme is the whole
 * of "webcal support".
 */
function normalizeScheme(value: string): string {
  const trimmed = value.trim();
  if (/^webcal:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice("webcal://".length)}`;
  }
  // Plain http is upgraded rather than rejected; these feeds are public
  // schedules, but there is no reason to fetch them in the clear.
  if (/^http:\/\//i.test(trimmed)) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return trimmed;
}

/**
 * Resolves user input to a fetchable https URL.
 *
 * Only http, https, and webcal are accepted. Anything else — `file:`,
 * `javascript:`, a bare hostname — is rejected rather than guessed at, because
 * this value is fetched and then persisted as the convention's refresh URL.
 */
export function resolveScheduleUrl(input: string): ResolvedScheduleUrl {
  const normalized = normalizeScheme(input);
  if (!normalized) throw new InvalidScheduleUrlError(input.trim());

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new InvalidScheduleUrlError(input.trim());
  }

  if (parsed.protocol !== "https:") {
    throw new InvalidScheduleUrlError(input.trim());
  }

  const canonicalUrl = parsed.toString();
  const schedMatch = canonicalUrl.match(SCHED_PATTERN);
  if (schedMatch) {
    // A Sched conference exposes every session at a fixed path, so the user
    // can paste any page on the site and still get the full schedule.
    return {
      fetchUrl: `https://${schedMatch[1].toLowerCase()}.sched.com/all.ics`,
      kind: "sched",
      canonicalUrl: `https://${schedMatch[1].toLowerCase()}.sched.com`,
    };
  }

  return { fetchUrl: canonicalUrl, kind: "ics", canonicalUrl };
}

/**
 * A calendar body always starts with `BEGIN:VCALENDAR`. Checking the body
 * matters because plenty of hosts serve `.ics` as `text/plain` or
 * `application/octet-stream`, and rejecting those on Content-Type alone would
 * turn working feeds into errors.
 */
export function looksLikeCalendar(body: string): boolean {
  return /^\s*BEGIN:VCALENDAR/i.test(body);
}

/** Best-effort convention name from a feed URL, used when the ICS has no name. */
export function scheduleNameFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    const host = hostname.replace(/^www\./i, "");
    return host.endsWith(".sched.com")
      ? host.slice(0, -".sched.com".length)
      : host;
  } catch {
    return "";
  }
}
