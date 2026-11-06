/** Same UTF-16 length ceiling as the native input's maxLength and counter. */
export const BADGE_NAME_MAX_LENGTH = 32;

const graphemes =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : undefined;

/**
 * Keep complete graphemes inside the remaining UTF-16 budget where supported.
 * shortcut: older browsers may shorten complex graphemes, remove the fallback
 * when every supported browser provides Intl.Segmenter.
 */
export function limitBadgeName(
  value: string,
  maxLength = BADGE_NAME_MAX_LENGTH,
): string {
  let result = "";
  // Text inputs remove line breaks, including when text arrives by paste.
  const singleLine = value.replace(/[\r\n]/g, "");
  const segments = graphemes
    ? graphemes.segment(singleLine)
    : Array.from(singleLine, (segment) => ({ segment }));
  for (const { segment } of segments) {
    // With the Unicode flag, valid surrogate pairs do not match this range.
    if (/[\uD800-\uDFFF]/u.test(segment)) continue;
    if (result.length + segment.length > maxLength) break;
    result += segment;
  }
  return result;
}
