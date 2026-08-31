/**
 * Works around The Events Calendar's truncated iCal export.
 *
 * The Events Calendar (ECP) is the WordPress plugin behind a lot of convention
 * sites. Its `?ical=1` export does not return the event set -- it returns the
 * page of the list view that produced it. IndyFurCon 2026 publishes 246 panels
 * and the feed hands out 30, with no parameter that lifts it: the cap lives in
 * the view, server-side. Nothing a client does to that URL can widen it, so
 * importing "what the feed said" silently loses 88% of the schedule and looks
 * to the reader like the app dropped their panels.
 *
 * The same plugin also exposes a REST API at `/wp-json/tribe/events/v1/events`
 * which is honestly paginated. This module reads that instead and renders the
 * result as an ordinary `.ics` string, so the existing parser, import policy
 * and reconciliation all keep working unchanged -- this is a fetch detour, not
 * a second import path.
 *
 * ponytail: synthesizing ICS rather than adding a JSON branch to the importer
 * keeps every downstream behaviour (tombstones, re-import identity, timezone
 * handling) on the one code path that is already tested. If ECP ever exposes
 * something the ICS shape cannot carry, that is the point to reconsider.
 */

/**
 * ECP stamps its version into PRODID, e.g.
 * `PRODID:-//IndyFurCon 2026 - ECPv6.17.3.1//NONSGML v1.0//EN`.
 *
 * The marker sits mid-string after the site name, so this matches `ECPv` plus a
 * digit anywhere on the line rather than anchoring to the `//` separators.
 */
const ECP_PRODID = /ECPv\d/i;

/**
 * Events per REST page. The API caps `per_page` at 50; asking for more is
 * silently clamped, so this is the largest legal page rather than a tuning
 * knob.
 */
const PER_PAGE = 50;

/**
 * Hard stop on pagination: 20 pages x 50 = 1000 events.
 *
 * Larger than any real convention and small enough that a misbehaving or
 * hostile site cannot walk us through unbounded requests. A feed that hits
 * this returns what was collected rather than failing -- a truncated import
 * the reader can see beats no import at all.
 */
const MAX_PAGES = 20;

/**
 * Explicit floor for the date window.
 *
 * REQUIRED, not cosmetic. With no `start_date` the API answers "upcoming from
 * now", so re-importing on the Saturday of a convention would return only the
 * panels that had not happened yet -- and reconciliation would read every
 * finished panel as withdrawn from the feed. An explicit floor makes the
 * response the whole schedule regardless of when it is asked for.
 *
 * Not `1970-01-01`: ECP parses the value and then tests it for truthiness, so
 * the Unix epoch itself comes back `400 rest_invalid_param` while `1971-01-01`
 * is fine. 2000 is comfortably valid and still a decade before The Events
 * Calendar existed, so nothing real can fall below it.
 */
const START_FLOOR = "2000-01-01";

export interface EcpEvent {
  id: number | string;
  title?: string;
  description?: string;
  url?: string;
  modified_utc?: string;
  utc_start_date?: string;
  utc_end_date?: string;
  timezone?: string;
  venue?: { venue?: string } | unknown[];
  categories?: { name?: string }[];
}

/**
 * True when a calendar body came from The Events Calendar.
 *
 * Only the PRODID line is examined. Scanning the whole body would let any feed
 * that merely mentions the plugin in an event description send us off to a
 * REST endpoint it does not have.
 */
export function isEventsCalendarFeed(raw: string): boolean {
  return raw
    .split(/\r?\n/)
    .some(
      (line) =>
        line.toUpperCase().startsWith("PRODID") && ECP_PRODID.test(line),
    );
}

/**
 * The REST collection on the same origin as the feed.
 *
 * Same-origin by construction: the host is taken from the URL already being
 * fetched, never from anything inside the response body, so a hostile feed
 * cannot redirect this at a third party.
 */
export function ecpRestEndpoint(feedUrl: string): string | null {
  try {
    const { origin, protocol } = new URL(feedUrl);
    if (protocol !== "https:") return null;
    return `${origin}/wp-json/tribe/events/v1/events`;
  } catch {
    return null;
  }
}

/** RFC 5545 text escaping: backslash first, or it escapes its own output. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, ";")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds to 75 octets, counting UTF-8 bytes rather than characters -- a line of
 * CJK or emoji is well over the limit long before it is 75 characters long.
 * Continuation lines carry the leading space the spec requires, which itself
 * costs one of the 75.
 */
function foldLine(line: string): string {
  if (new TextEncoder().encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let bytes = 0;

  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);

  return (
    parts[0] +
    parts
      .slice(1)
      .map((part) => `\r\n ${part}`)
      .join("")
  );
}

/** `2026-09-03 23:00:00` -> `20260903T230000Z`. Returns null if unparseable. */
function toIcsUtc(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

/**
 * Strips the HTML the REST API returns in `description`.
 *
 * ECP descriptions are post content, so they are real HTML rather than the
 * plain text an ICS DESCRIPTION is supposed to hold. Block boundaries become
 * newlines first so paragraphs do not run together into one wall of words.
 */
function htmlToText(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Same entity handling as descriptions, for fields that carry no markup. */
function decodeEntities(raw: string | undefined): string {
  return htmlToText(raw);
}

/**
 * Renders REST events as an `.ics` body.
 *
 * Times are emitted as UTC with a `Z` suffix and the convention's zone is
 * declared once in `X-WR-TIMEZONE` -- the same shape Sched publishes, which is
 * the best-covered path through the parser. That avoids hand-writing a
 * VTIMEZONE block with DST rules this module has no business inventing.
 *
 * Pure: no fetching, no clock. Exported so the mapping is testable without a
 * network.
 */
export function buildIcsFromEcpEvents(
  events: EcpEvent[],
  options: { calendarName?: string } = {},
): string {
  const zone = events.find((event) => event.timezone)?.timezone;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ConPaws//Events Calendar REST expansion//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`);
  }
  if (zone) lines.push(`X-WR-TIMEZONE:${zone}`);

  for (const event of events) {
    const start = toIcsUtc(event.utc_start_date);
    const end = toIcsUtc(event.utc_end_date);
    // An event with no usable start cannot be placed on a schedule, and a
    // VEVENT without DTSTART is invalid -- skipping it keeps the rest importable.
    if (!start) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@conpaws.ecp`);
    lines.push(`DTSTAMP:${toIcsUtc(event.modified_utc) ?? start}`);
    lines.push(`DTSTART:${start}`);
    if (end) lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeText(decodeEntities(event.title))}`);

    const venue = event.venue;
    const room =
      venue && !Array.isArray(venue)
        ? (venue as { venue?: string }).venue
        : undefined;
    if (room) lines.push(`LOCATION:${escapeText(decodeEntities(room))}`);

    const description = htmlToText(event.description);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);

    const categories = (event.categories ?? [])
      .map((category) => category?.name)
      .filter((name): name is string => Boolean(name));
    if (categories.length > 0) {
      lines.push(
        `CATEGORIES:${categories.map((name) => escapeText(name)).join(",")}`,
      );
    }

    if (event.url) lines.push(`URL:${event.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/**
 * Pulls the full schedule behind an ECP feed, or null if that is not possible.
 *
 * Null rather than throwing, on every failure path: this runs only after a
 * calendar body has already been fetched successfully, so the caller always
 * has something to fall back to. A site that has the REST route disabled, is
 * behind a firewall, or answers with something unexpected must degrade to the
 * truncated-but-real feed, never turn a working import into an error.
 *
 * The one exception is abort, which is re-thrown by fetch and left to the
 * caller: a reader who pressed Cancel is not a failure to recover from.
 */
export async function fetchEcpFullSchedule(
  feedUrl: string,
  options: { signal?: AbortSignal; calendarName?: string } = {},
): Promise<string | null> {
  const endpoint = ecpRestEndpoint(feedUrl);
  if (!endpoint) return null;

  const collected: EcpEvent[] = [];
  let pages = 1;

  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page += 1) {
    const url =
      `${endpoint}?per_page=${PER_PAGE}&page=${page}` +
      `&start_date=${START_FLOOR}`;

    const response = await fetch(url, {
      signal: options.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;

    let payload: { events?: EcpEvent[]; total_pages?: number };
    try {
      payload = await response.json();
    } catch {
      return null;
    }

    const events = payload?.events;
    if (!Array.isArray(events)) return null;
    collected.push(...events);

    // Trust the server's page count only on the first response; re-reading it
    // every page lets a feed that keeps incrementing it walk us past MAX_PAGES.
    if (page === 1) {
      const reported = Number(payload.total_pages);
      pages = Number.isFinite(reported) && reported > 0 ? reported : 1;
    }
    if (events.length === 0) break;
  }

  if (collected.length === 0) return null;
  return buildIcsFromEcpEvents(collected, {
    calendarName: options.calendarName,
  });
}
