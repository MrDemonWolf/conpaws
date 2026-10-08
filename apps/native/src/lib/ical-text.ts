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

/** Decode entities without throwing on invalid Unicode code points. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;| /gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;/gi, "'")
    .replace(/&#8211;/gi, "–")
    .replace(/&#8212;/gi, "—")
    .replace(/&#(x[\da-f]+|\d+);/gi, (match, code: string) => {
      const point =
        code[0]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10);
      return Number.isInteger(point) &&
        point >= 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : match;
    });
}
