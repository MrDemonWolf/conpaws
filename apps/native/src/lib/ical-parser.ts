export interface ParsedEvent {
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  location: string | null;
  room: string | null;
  category: string | null;
  sourceUid: string;
  sourceUrl: string | null;
  isAgeRestricted: boolean;
  contentWarning: boolean;
}

export interface CategoryMeta {
  name: string;
  count: number;
  color: string;
}

export interface ParseResult {
  timezone: string | null;
  events: ParsedEvent[];
  categories: CategoryMeta[];
}

const CATEGORY_PALETTE = [
  '#FF6B6B', '#FFA500', '#FFD700', '#7ED321', '#4CAF50',
  '#0FACED', '#5B9BD5', '#9B59B6', '#E91E63', '#00BCD4',
  '#FF5722', '#795548', '#607D8B', '#3F51B5', '#009688',
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
  return raw.replace(/\r?\n[ \t]/g, '');
}

/** Unescape iCal text: \n → newline, \, → comma, \; → semicolon, \\ → backslash */
function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/** Parse iCal datetime string to Date.
 * Handles: YYYYMMDDTHHMMSSZ (UTC), YYYYMMDDTHHMMSS (local), YYYYMMDD (all-day)
 */
function parseDateTime(value: string): Date | null {
  // Strip any TZID parameter prefix if present in the value (rare but possible)
  const val = value.split(':').pop() ?? value;

  // UTC: 20260612T160000Z
  const utcMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, mo, d, h, mi, s] = utcMatch;
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }

  // Local datetime: 20260612T160000
  const localMatch = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, mo, d, h, mi, s] = localMatch;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }

  // All-day: 20260612
  const dateMatch = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateMatch) {
    const [, y, mo, d] = dateMatch;
    return new Date(+y, +mo - 1, +d, 0, 0, 0);
  }

  return null;
}

/** Split "Room Name, Venue Name" → { location: "Venue Name", room: "Room Name" }
 * Split on LAST comma so "Panel Room A, Convention Center" → room="Panel Room A", location="Convention Center"
 */
function splitLocation(raw: string): { location: string; room: string | null } {
  const lastComma = raw.lastIndexOf(',');
  if (lastComma === -1) return { location: raw.trim(), room: null };
  const room = raw.slice(0, lastComma).trim();
  const location = raw.slice(lastComma + 1).trim();
  return { location, room };
}

function detectAgeRestricted(text: string): boolean {
  const lower = text.toLowerCase();
  return /18\+|nsfw|adult|after dark/.test(lower);
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
    if (ch === ':' && !inQuote) return line.slice(i + 1);
  }
  return '';
}

/** Extract just the property name (before any ; or :) */
function extractPropName(line: string): string {
  const semi = line.indexOf(';');
  const colon = line.indexOf(':');
  const end = semi !== -1 && semi < colon ? semi : colon;
  return end !== -1 ? line.slice(0, end) : line;
}

export function parseIcs(raw: string): ParseResult {
  if (!raw || raw.trim().length === 0) {
    return { timezone: null, events: [], categories: [] };
  }

  const unfolded = unfold(raw);
  const lines = unfolded.split(/\r?\n/);

  // Extract calendar-level timezone
  let timezone: string | null = null;
  for (const line of lines) {
    if (line.startsWith('X-WR-TIMEZONE:')) {
      timezone = line.slice('X-WR-TIMEZONE:'.length).trim();
      break;
    }
  }

  // Split into VEVENT blocks
  const eventBlocks: string[][] = [];
  let currentBlock: string[] | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentBlock = [];
    } else if (line === 'END:VEVENT') {
      if (currentBlock) {
        eventBlocks.push(currentBlock);
        currentBlock = null;
      }
    } else if (currentBlock !== null) {
      currentBlock.push(line);
    }
  }

  const seenUids = new Set<string>();
  const parsedEvents: ParsedEvent[] = [];
  const categoryCountMap = new Map<string, number>();

  for (const block of eventBlocks) {
    const props: Record<string, string> = {};

    for (const line of block) {
      if (!line) continue;
      const propName = extractPropName(line);
      const value = extractValue(line);
      // For DTSTART/DTEND, keep the whole line name (may include TZID param)
      props[propName] = value;
    }

    const uid = props['UID'];
    if (!uid) continue;
    const recurrenceId = props['RECURRENCE-ID'] ?? '';
    const dedupeKey = recurrenceId ? `${uid}|${recurrenceId}` : uid;
    if (seenUids.has(dedupeKey)) continue;
    seenUids.add(dedupeKey);

    const rawSummary = props['SUMMARY'] ?? '';
    const title = decodeHtmlEntities(unescapeText(rawSummary)).trim();
    if (!title) continue;

    const rawDesc = props['DESCRIPTION'] ?? null;
    const description = rawDesc
      ? decodeHtmlEntities(unescapeText(rawDesc)).trim() || null
      : null;

    const startTime = parseDateTime(props['DTSTART'] ?? '');
    if (!startTime) continue;

    const endTime = parseDateTime(props['DTEND'] ?? '') ?? null;

    const rawLocation = props['LOCATION'] ?? null;
    let location: string | null = null;
    let room: string | null = null;
    if (rawLocation) {
      const split = splitLocation(decodeHtmlEntities(unescapeText(rawLocation)));
      location = split.location;
      room = split.room;
    }

    const rawCategory = props['CATEGORIES'] ?? null;
    const category = rawCategory
      ? decodeHtmlEntities(unescapeText(rawCategory)).split(',')[0].trim() || null
      : null;

    const sourceUrl = props['URL'] ?? null;

    const checkText = `${title} ${description ?? ''}`;
    const isAgeRestricted = detectAgeRestricted(checkText);
    const contentWarning = detectContentWarning(checkText);

    if (category) {
      categoryCountMap.set(category, (categoryCountMap.get(category) ?? 0) + 1);
    }

    parsedEvents.push({
      title,
      description,
      startTime,
      endTime,
      location,
      room,
      category,
      sourceUid: uid,
      sourceUrl,
      isAgeRestricted,
      contentWarning,
    });
  }

  // Sort by start time
  parsedEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const categories: CategoryMeta[] = Array.from(categoryCountMap.entries()).map(([name, count]) => ({
    name,
    count,
    color: categoryColor(name),
  }));

  return { timezone, events: parsedEvents, categories };
}
