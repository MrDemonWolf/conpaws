/**
 * Search helpers for the ~400 IANA time zone identifiers.
 *
 * An identifier such as `America/Indiana/Indianapolis` already carries the
 * city name people actually think in, so searching the last path segment gets
 * city lookup with no extra dataset. A postcode or state lookup would need a
 * real geography table, which this deliberately does not ship.
 */

export interface TimeZoneOption {
  /** The IANA identifier, e.g. `America/New_York`. */
  id: string;
  /** The city or locality, e.g. `New York`. */
  city: string;
  /** The area the city sits in, e.g. `America` or `America · Indiana`. */
  region: string;
}

const SEGMENT_SEPARATOR = " · ";

function humanizeSegment(segment: string): string {
  return segment.replace(/_/g, " ");
}

/**
 * Splits an identifier into the parts worth showing. Single-segment zones such
 * as `UTC` have no region, so they report an empty one rather than repeating
 * themselves.
 */
export function describeTimeZone(id: string): TimeZoneOption {
  const segments = id.split("/");
  const city = humanizeSegment(segments[segments.length - 1] ?? id);
  const region = segments
    .slice(0, -1)
    .map(humanizeSegment)
    .join(SEGMENT_SEPARATOR);

  return { id, city, region };
}

/**
 * Lowercases, strips diacritics, and flattens the separators so that "sao
 * paulo", "Sao_Paulo", and "São Paulo" all normalize to the same haystack.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rank is lowest-is-best so results sort naturally:
 * 0 exact city, 1 city prefix, 2 city word prefix, 3 city substring,
 * 4 region/identifier match. `null` means no match at all.
 */
function rankTimeZone(option: TimeZoneOption, query: string): number | null {
  const city = normalizeForSearch(option.city);
  if (city === query) return 0;
  if (city.startsWith(query)) return 1;
  if (city.split(" ").some((word) => word.startsWith(query))) return 2;
  if (city.includes(query)) return 3;

  return normalizeForSearch(option.id).includes(query) ? 4 : null;
}

/**
 * Filters and ranks time zones for a free-text query. An empty query returns
 * every option untouched, so the caller can use one code path for the browse
 * and search states.
 */
export function searchTimeZones(
  options: readonly TimeZoneOption[],
  query: string,
): TimeZoneOption[] {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return [...options];

  return options
    .map((option) => ({ option, rank: rankTimeZone(option, normalizedQuery) }))
    .filter(
      (entry): entry is { option: TimeZoneOption; rank: number } =>
        entry.rank !== null,
    )
    .sort(
      (a, b) => a.rank - b.rank || a.option.city.localeCompare(b.option.city),
    )
    .map((entry) => entry.option);
}

/**
 * Builds the option list, putting the device's own zone first because it is
 * the right answer for most conventions the owner attends.
 */
export function buildTimeZoneOptions(
  identifiers: readonly string[],
  deviceTimeZone: string,
): TimeZoneOption[] {
  const unique = [...new Set([deviceTimeZone, ...identifiers])];
  const rest = unique
    .filter((id) => id !== deviceTimeZone)
    .map(describeTimeZone)
    .sort((a, b) => a.city.localeCompare(b.city) || a.id.localeCompare(b.id));

  return [describeTimeZone(deviceTimeZone), ...rest];
}

/**
 * The short label shown on the closed row: the city alone when it is
 * unambiguous, otherwise the region too. Always prefer this over the raw
 * identifier in UI — `America/Argentina/Buenos_Aires` means nothing to a
 * convention-goer.
 */
export function timeZoneLabel(id: string): string {
  const { city, region } = describeTimeZone(id);
  return region ? `${city}, ${region.split(SEGMENT_SEPARATOR)[0]}` : city;
}
