/**
 * Line-level iCalendar text handling, shared by the parser and by feed
 * detection.
 *
 * This lives on its own so `feed-source.ts` can unfold a calendar without
 * importing `ical-parser.ts`, which imports `feed-source.ts` back.
 */

/** Unfold RFC 5545 line continuations (CRLF/LF followed by space/tab) */
export function unfold(raw: string): string {
  return raw.replace(/\r?\n[ \t]/g, "");
}
