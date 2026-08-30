import { isValidTimeZone } from "./convention-time";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Looks an IANA zone up from coordinates. Offline; no network, no permission. */
export type CoordinateTimeZoneLookup = (
  latitude: number,
  longitude: number,
) => string;

export type LocationGeocoder = (location: string) => Promise<unknown[]>;

export function isValidCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const { latitude, longitude } = value as Partial<Coordinates>;

  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Turns coordinates into a time zone, or `null` when they are unusable or the
 * lookup returns something the platform cannot resolve.
 *
 * `tz-lookup` throws on out-of-range input and can return a zone this device's
 * ICU build does not know, so both are treated as "no answer" rather than
 * allowed to reach the scheduler. A wrong zone silently shifts every reminder.
 */
export function timeZoneFromCoordinates(
  coordinates: unknown,
  lookup: CoordinateTimeZoneLookup,
): string | null {
  if (!isValidCoordinates(coordinates)) return null;

  let candidate: string;
  try {
    candidate = lookup(coordinates.latitude, coordinates.longitude);
  } catch {
    return null;
  }

  if (typeof candidate !== "string" || !candidate) return null;
  return isValidTimeZone(candidate) ? candidate : null;
}

/**
 * How long a geocode may hold up a save.
 *
 * `Location.geocodeAsync` reaches Apple's or Google's service and has no
 * timeout of its own. The save button is already disabled behind it because it
 * "can take seconds", so a service that hangs left the form frozen with a
 * spinner, no cancel and no error. Ten seconds is well past a healthy lookup
 * and far short of a wait anyone would sit through.
 */
export const GEOCODE_TIMEOUT_MS = 10_000;

/**
 * Geocodes a typed place, then finishes the coordinate-to-zone step offline.
 *
 * Giving up returns null, which is the same answer as a place the geocoder
 * does not know -- and the callers already handle that by asking whether to
 * use the device's zone instead. So a slow network costs the reader one extra
 * question, never a stuck screen.
 */
export async function inferTimeZoneFromLocation(
  location: string,
  geocode: LocationGeocoder,
  lookup: CoordinateTimeZoneLookup,
  timeoutMs: number = GEOCODE_TIMEOUT_MS,
): Promise<string | null> {
  const normalized = normalizeLocationName(location);
  if (!normalized) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const coordinates = await Promise.race([
      geocode(normalized),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (coordinates === null) return null;
    return timeZoneFromCoordinates(coordinates[0], lookup);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface LocationEditOptions {
  /** The location as it now reads in the form, already normalized. */
  location: string;
  /** The location this convention was saved with, already normalized. */
  originalLocation: string;
  /** True once the user has picked a zone by hand. */
  manuallySet: boolean;
}

export type LocationEditDecision =
  /** Nothing to re-infer — keep `currentTimeZone`. */
  | { action: "keep" }
  /** The location changed to something real — geocode it. */
  | { action: "infer" };

/**
 * Decides whether editing a convention's location should re-infer its zone.
 *
 * Clearing the location is the case worth being careful about. An empty field
 * is the absence of information, not a statement that the convention moved to
 * this device's zone — and treating it as the latter silently rewrites every
 * event time on the schedule, with no prompt and nothing on screen to explain
 * why the day now starts an hour early.
 *
 * So a cleared location keeps whatever zone is already set. Only a location
 * that changed to a real place is worth geocoding.
 */
export function decideTimeZoneForLocationEdit({
  location,
  originalLocation,
  manuallySet,
}: LocationEditOptions): LocationEditDecision {
  if (manuallySet) return { action: "keep" };
  if (location === originalLocation) return { action: "keep" };
  if (!location) return { action: "keep" };
  return { action: "infer" };
}

/** Collapses whitespace so " Pittsburgh ,  PA " stores as "Pittsburgh, PA". */
export function normalizeLocationName(value: string): string {
  return value
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}
