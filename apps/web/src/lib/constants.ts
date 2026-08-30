/**
 * The reviewed date both legal documents display and the sitemap publishes.
 *
 * One constant because there were briefly two: the MDX carried its own literal
 * while `sitemap.ts` read this, so the date crawlers saw was five months older
 * than the date visitors saw. Bump this when the wording of `/privacy` or
 * `/terms` actually changes -- it is a reviewed date, not a build timestamp.
 */
export const LEGAL_LAST_UPDATED = "August 30, 2026";
