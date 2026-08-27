import { fromConventionTime, isValidTimeZone } from "./convention-time";
import {
  type AgeRating,
  ageRatingFromText,
  classifyCategories,
  isRestrictedRating,
  strictestRating,
} from "./event-categories";

export interface ParsedEvent {
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  room: string | null;
  /** First topic tag, kept for existing callers and the category filter. */
  category: string | null;
  /** Every topic tag the feed supplied, audience tags removed. */
  categories: string[];
  /** Audience rating, or null when the feed said nothing about audience. */
  ageRating: AgeRating | null;
  sourceUid: string;
  legacySourceUid: string | null;
  recurrenceTime: Date | null;
  sourceUrl: string | null;
  isAgeRestricted: boolean;
  contentWarning: boolean;
}

export interface CancelledEvent {
  sourceUid: string;
  legacySourceUid: string | null;
  startTime: Date | null;
  recurrenceTime: Date | null;
  title: string | null;
  sourceUrl: string | null;
}

export interface CategoryMeta {
  name: string;
  count: number;
  color: string;
}

export interface ParseResult {
  timezone: string | null;
  requiresTimeZone: boolean;
  events: ParsedEvent[];
  cancelledEvents: CancelledEvent[];
  cancelledSourceUids: string[];
  categories: CategoryMeta[];
}

export interface ParseOptions {
  timeZone?: string;
}

const UNSUPPORTED_RECURRENCE_PROPERTIES = new Set(["RRULE", "RDATE", "EXDATE"]);

export class UnsupportedRecurrenceError extends Error {
  readonly properties: string[];

  constructor(properties: string[]) {
    const uniqueProperties = Array.from(new Set(properties)).sort();
    super(
      `This calendar uses unsupported active recurrence definitions (${uniqueProperties.join(", ")}). ConPaws cannot safely expand them yet. Export an expanded .ics file with each occurrence as its own event, then try again.`,
    );
    this.name = "UnsupportedRecurrenceError";
    this.properties = uniqueProperties;
  }
}

const CATEGORY_PALETTE = [
  "#FF6B6B",
  "#FFA500",
  "#FFD700",
  "#7ED321",
  "#4CAF50",
  "#0FACED",
  "#5B9BD5",
  "#9B59B6",
  "#E91E63",
  "#00BCD4",
  "#FF5722",
  "#795548",
  "#607D8B",
  "#3F51B5",
  "#009688",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function categoryColor(name: string): string {
  return CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length];
}

/** Unfold RFC 5545 line continuations (CRLF/LF followed by space/tab) */
function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, "");
}

/** Unescape iCal text: \n → newline, \, → comma, \; → semicolon, \\ → backslash */
function unescapeText(text: string): string {
  // RFC 5545 resolves escapes in one left-to-right pass. Four sequential
  // replaces do not: the \n pass reaches inside an escaped backslash, so the
  // three characters \\n came out as a backslash and a newline instead of a
  // backslash and a literal n, and no later pass could put it back.
  return text.replace(/\\([nN,;\\])/g, (_, ch: string) =>
    ch === "n" || ch === "N" ? "\n" : ch,
  );
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (match, code: string) => {
      // String.fromCharCode truncates to 16 bits, so an emoji entity such as
      // &#128512; used to land as a Private Use Area character and the
      // mangling was then baked into the stored row.
      const point = Number.parseInt(code, 10);
      if (!Number.isFinite(point) || point > 0x10ffff) return match;
      if (point >= 0xd800 && point <= 0xdfff) return match;
      return String.fromCodePoint(point);
    });
}

/** Parse iCal datetime string to Date.
 * Handles: YYYYMMDDTHHMMSSZ (UTC), YYYYMMDDTHHMMSS (local), YYYYMMDD (all-day)
 */
function parseDateTime(value: string, timeZone: string | null): Date | null {
  // Strip any TZID parameter prefix if present in the value (rare but possible)
  const val = value.split(":").pop() ?? value;

  // UTC: 20260612T160000Z
  const utcMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, mo, d, h, mi, s] = utcMatch;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }

  // Local datetime: 20260612T160000
  const localMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    if (!timeZone) return null;
    const [, y, mo, d, h, mi, s] = localMatch;
    return fromConventionTime(
      {
        year: +y,
        month: +mo,
        day: +d,
        hour: +h,
        minute: +mi,
        second: +s,
      },
      timeZone,
    );
  }

  // All-day: 20260612
  const dateMatch = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    if (!timeZone) return null;
    const [, y, mo, d] = dateMatch;
    return fromConventionTime({ year: +y, month: +mo, day: +d }, timeZone);
  }

  return null;
}

/** Split "Room Name, Venue Name" → { location: "Venue Name", room: "Room Name" }
 * Split on LAST comma so "Panel Room A, Convention Center" → room="Panel Room A", location="Convention Center"
 */
function splitLocation(raw: string): { location: string; room: string | null } {
  const lastComma = raw.lastIndexOf(",");
  if (lastComma === -1) return { location: raw.trim(), room: null };
  const room = raw.slice(0, lastComma).trim();
  const location = raw.slice(lastComma + 1).trim();
  return { location, room };
}

function detectContentWarning(text: string): boolean {
  const lower = text.toLowerCase();
  return /strobe|flash warning/.test(lower);
}

/** Extract the value from a property line, handling PARAM;KEY=VAL:VALUE format */
function extractValue(line: string): string {
  // Find the colon that separates params from value (not inside quotes)
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    if (ch === ":" && !inQuote) return line.slice(i + 1);
  }
  return "";
}

/** Extract just the property name (before any ; or :) */
function extractPropName(line: string): string {
  const semi = line.indexOf(";");
  const colon = line.indexOf(":");
  const end = semi !== -1 && semi < colon ? semi : colon;
  return end !== -1 ? line.slice(0, end) : line;
}

function extractParameter(line: string, name: string): string | null {
  const colon = line.indexOf(":");
  const header = colon === -1 ? line : line.slice(0, colon);

  for (const parameter of header.split(";").slice(1)) {
    const [key, ...valueParts] = parameter.split("=");
    if (key?.toUpperCase() !== name.toUpperCase()) continue;
    return valueParts.join("=").replace(/^"|"$/g, "").trim() || null;
  }

  return null;
}

export function parseIcs(raw: string, options: ParseOptions = {}): ParseResult {
  if (!raw || raw.trim().length === 0) {
    return {
      timezone: null,
      requiresTimeZone: false,
      events: [],
      cancelledEvents: [],
      cancelledSourceUids: [],
      categories: [],
    };
  }

  const unfolded = unfold(raw);
  const lines = unfolded.split(/\r?\n/);

  // Extract calendar-level timezone
  let calendarTimeZone: string | null = null;
  for (const line of lines) {
    if (line.startsWith("X-WR-TIMEZONE:")) {
      calendarTimeZone = line.slice("X-WR-TIMEZONE:".length).trim();
      break;
    }
  }

  const firstEventTimeZone = lines
    .filter((line) => line.startsWith("DTSTART;"))
    .map((line) => extractParameter(line, "TZID"))
    .find(isValidTimeZone);
  const requestedTimeZone = options.timeZone?.trim() || null;
  const timezone =
    [requestedTimeZone, calendarTimeZone, firstEventTimeZone].find(
      isValidTimeZone,
    ) ?? null;

  // Split into VEVENT blocks
  const eventBlocks: string[][] = [];
  let currentBlock: string[] | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentBlock = [];
    } else if (line === "END:VEVENT") {
      if (currentBlock) {
        eventBlocks.push(currentBlock);
        currentBlock = null;
      }
    } else if (currentBlock !== null) {
      currentBlock.push(line);
    }
  }

  const seenUids = new Set<string>();
  const cancelledEvents = new Map<string, CancelledEvent>();
  const parsedEvents: ParsedEvent[] = [];
  const categoryCountMap = new Map<string, number>();

  for (const block of eventBlocks) {
    const uidLine = block.find((line) => extractPropName(line) === "UID");
    const statusLine = block.find((line) => extractPropName(line) === "STATUS");
    if (
      !uidLine ||
      extractValue(statusLine ?? "")
        .trim()
        .toUpperCase() !== "CANCELLED"
    ) {
      continue;
    }

    const uid = extractValue(uidLine);
    const recurrenceLine = block.find(
      (line) => extractPropName(line) === "RECURRENCE-ID",
    );
    const recurrenceId = recurrenceLine ? extractValue(recurrenceLine) : "";
    const sourceUid = recurrenceId ? `${uid}|${recurrenceId}` : uid;
    const startLine = block.find((line) => extractPropName(line) === "DTSTART");
    const titleLine = block.find((line) => extractPropName(line) === "SUMMARY");
    const sourceUrlLine = block.find((line) => extractPropName(line) === "URL");
    const startTimeZone = startLine
      ? extractParameter(startLine, "TZID")
      : null;
    const recurrenceTimeZone = recurrenceLine
      ? extractParameter(recurrenceLine, "TZID")
      : null;

    cancelledEvents.set(sourceUid, {
      sourceUid,
      legacySourceUid: recurrenceId ? uid : null,
      startTime: startLine
        ? parseDateTime(
            extractValue(startLine),
            isValidTimeZone(startTimeZone) ? startTimeZone : timezone,
          )
        : null,
      recurrenceTime: recurrenceId
        ? parseDateTime(
            recurrenceId,
            isValidTimeZone(recurrenceTimeZone) ? recurrenceTimeZone : timezone,
          )
        : null,
      title: titleLine
        ? decodeHtmlEntities(unescapeText(extractValue(titleLine))).trim() ||
          null
        : null,
      sourceUrl: sourceUrlLine ? extractValue(sourceUrlLine) || null : null,
    });
  }
  const cancelledSourceUids = new Set(cancelledEvents.keys());
  const hasActiveEventBlock = eventBlocks.some((block) => {
    const uidLine = block.find((line) => extractPropName(line) === "UID");
    const statusLine = block.find((line) => extractPropName(line) === "STATUS");
    if (
      !uidLine ||
      extractValue(statusLine ?? "")
        .trim()
        .toUpperCase() === "CANCELLED"
    ) {
      return false;
    }
    const uid = extractValue(uidLine);
    const recurrenceLine = block.find(
      (line) => extractPropName(line) === "RECURRENCE-ID",
    );
    const recurrenceId = recurrenceLine ? extractValue(recurrenceLine) : "";
    const sourceUid = recurrenceId ? `${uid}|${recurrenceId}` : uid;
    return !cancelledSourceUids.has(sourceUid) && !cancelledSourceUids.has(uid);
  });

  for (const block of eventBlocks) {
    // Null-prototype maps: a feed is free to name a property __proto__, and on
    // a plain object literal that assignment would reach Object.prototype
    // instead of landing as a key.
    const props: Record<string, string> = Object.create(null);
    const timeZones: Record<string, string | null> = Object.create(null);

    // CATEGORIES has cardinality "*" inside a VEVENT, so a producer that emits
    // one line per tag must not have all but the last silently overwritten.
    const categoryLines: string[] = [];

    for (const line of block) {
      if (!line) continue;
      const propName = extractPropName(line);
      const value = extractValue(line);
      if (propName === "CATEGORIES") {
        if (value) categoryLines.push(value);
      }
      props[propName] = value;
      if (
        propName === "DTSTART" ||
        propName === "DTEND" ||
        propName === "RECURRENCE-ID"
      ) {
        const eventTimeZone = extractParameter(line, "TZID");
        timeZones[propName] = isValidTimeZone(eventTimeZone)
          ? eventTimeZone
          : null;
      }
    }

    const uid = props.UID;
    if (!uid) continue;
    const recurrenceId = props["RECURRENCE-ID"] ?? "";
    const dedupeKey = recurrenceId ? `${uid}|${recurrenceId}` : uid;
    if (cancelledSourceUids.has(dedupeKey) || cancelledSourceUids.has(uid)) {
      continue;
    }

    const unsupportedRecurrenceProperties = block
      .map((line) => extractPropName(line).toUpperCase())
      .filter((propertyName) =>
        UNSUPPORTED_RECURRENCE_PROPERTIES.has(propertyName),
      );
    if (unsupportedRecurrenceProperties.length > 0) {
      throw new UnsupportedRecurrenceError(unsupportedRecurrenceProperties);
    }

    if (seenUids.has(dedupeKey)) continue;
    seenUids.add(dedupeKey);

    const rawSummary = props["SUMMARY"] ?? "";
    const title = decodeHtmlEntities(unescapeText(rawSummary)).trim();
    if (!title) continue;

    const rawDesc = props["DESCRIPTION"] ?? null;
    const description = rawDesc
      ? decodeHtmlEntities(unescapeText(rawDesc)).trim() || null
      : null;

    const startTimeZone = timeZones["DTSTART"] ?? timezone;
    const startTime = parseDateTime(props["DTSTART"] ?? "", startTimeZone);
    const recurrenceTime = recurrenceId
      ? parseDateTime(recurrenceId, timeZones["RECURRENCE-ID"] ?? startTimeZone)
      : null;

    if (!startTime) continue;

    const endTime =
      parseDateTime(
        props["DTEND"] ?? "",
        timeZones["DTEND"] ?? startTimeZone,
      ) ?? null;

    const rawLocation = props["LOCATION"] ?? null;
    let location: string | null = null;
    let room: string | null = null;
    if (rawLocation) {
      const split = splitLocation(
        decodeHtmlEntities(unescapeText(rawLocation)),
      );
      location = split.location;
      room = split.room;
    }

    const rawCategory =
      categoryLines.length > 0 ? categoryLines.join(",") : null;
    // CATEGORIES mixes audience ratings and topics in one comma list, in no
    // guaranteed order. Splitting them keeps both; taking [0] used to discard
    // whichever happened to come second.
    const { ageRating: taggedRating, categories: topicCategories } =
      classifyCategories(
        rawCategory ? decodeHtmlEntities(unescapeText(rawCategory)) : null,
      );
    const category = topicCategories[0] ?? null;

    const sourceUrl = props["URL"] ?? null;

    const checkText = `${title} ${description ?? ""}`;
    // Sched exports carry no audience tags at all, so prose is the only signal
    // there. A tag from the feed always outranks it.
    const ageRating = strictestRating(
      taggedRating,
      ageRatingFromText(checkText),
    );
    const isAgeRestricted = isRestrictedRating(ageRating);
    const contentWarning = detectContentWarning(checkText);

    for (const topic of topicCategories) {
      categoryCountMap.set(topic, (categoryCountMap.get(topic) ?? 0) + 1);
    }

    parsedEvents.push({
      title,
      description,
      startTime,
      endTime,
      location,
      room,
      category,
      categories: topicCategories,
      ageRating,
      sourceUid: dedupeKey,
      recurrenceTime,
      legacySourceUid: recurrenceId ? uid : null,
      sourceUrl,
      isAgeRestricted,
      contentWarning,
    });
  }

  // Sort by start time
  parsedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const categories: CategoryMeta[] = Array.from(categoryCountMap.entries()).map(
    ([name, count]) => ({
      name,
      count,
      color: categoryColor(name),
    }),
  );

  return {
    timezone,
    requiresTimeZone: timezone === null && hasActiveEventBlock,
    cancelledEvents: Array.from(cancelledEvents.values()),
    events: parsedEvents,
    cancelledSourceUids: Array.from(cancelledSourceUids),
    categories,
  };
}
