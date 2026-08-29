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
/**
 * The current GMT offset for a zone, as "GMT-5".
 *
 * Cached because the time-zone picker renders a few hundred rows and building
 * an `Intl.DateTimeFormat` per row per render is not free.
 */
const offsetCache = new Map<string, string>();

function timeZoneOffset(id: string): string | null {
  const cached = offsetCache.get(id);
  if (cached !== undefined) return cached;

  let offset: string | null = null;
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone: id,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((candidate) => candidate.type === "timeZoneName");
    // A zero-offset zone formats as a bare "GMT", which says nothing next to
    // a city name and is dropped.
    offset = part && part.value !== "GMT" ? part.value : null;
  } catch {
    // An id this runtime does not know. The city alone still identifies it.
    offset = null;
  }

  offsetCache.set(id, offset ?? "");
  return offset;
}

/**
 * A time zone as a person would read it: the city, and what the clock there
 * says relative to GMT.
 *
 * The region segment of an IANA id is deliberately not shown. "America" in
 * `America/Chicago` is a tz-database realm, not a country, so pairing them
 * produced "Chicago, America" — a place that does not exist and that reads as
 * a bug to anyone checking whether the app guessed their convention right.
 * The offset does the disambiguating work instead, and does it better: it is
 * the thing the reader is actually verifying.
 *
 * ponytail: the offset is today's, so it reflects daylight saving as it stands
 * now rather than during a convention six months out. It is a label, never a
 * calculation — every stored time is an instant, and `convention-time.ts` owns
 * the arithmetic.
 */
export function timeZoneLabel(id: string): string {
  const { city } = describeTimeZone(id);
  const offset = timeZoneOffset(id);
  return offset ? `${city} · ${offset}` : city;
}
