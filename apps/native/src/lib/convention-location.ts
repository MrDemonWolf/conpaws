import { isValidTimeZone } from "./convention-time";

/**
 * How a convention's time zone was decided. Surfaced in the UI so the user can
 * tell an inferred zone from one they chose, and so an offline fallback never
 * masquerades as a confident answer.
 */
export type TimeZoneSource =
  /** Derived from coordinates for the entered location. */
  | "location"
  /** Chosen by hand in the Advanced picker. */
  | "manual"
  /** Nothing better was available — this device's zone. */
  | "device";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedTimeZone {
  timeZone: string;
  source: TimeZoneSource;
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

/** Geocodes a typed place, then finishes the coordinate-to-zone step offline. */
export async function inferTimeZoneFromLocation(
  location: string,
  geocode: LocationGeocoder,
  lookup: CoordinateTimeZoneLookup,
): Promise<string | null> {
  const normalized = normalizeLocationName(location);
  if (!normalized) return null;

  try {
    const [coordinates] = await geocode(normalized);
    return timeZoneFromCoordinates(coordinates, lookup);
  } catch {
    return null;
  }
}

export interface ResolveOptions {
  /** Coordinates for the entered location, when geocoding succeeded. */
  coordinates?: unknown;
  /** A zone the user picked by hand. Always wins. */
  manualTimeZone?: string | null;
  /** This device's zone, used when nothing better is known. */
  deviceTimeZone: string;
  lookup: CoordinateTimeZoneLookup;
}

/**
 * Decides a convention's time zone.
 *
 * Manual beats location beats device. Manual wins outright because the user
 * saying "this con runs on Chicago time" is better information than any
 * inference — and because offline users have no other way to correct a
 * fallback.
 */
export function resolveConventionTimeZone({
  coordinates,
  manualTimeZone,
  deviceTimeZone,
  lookup,
}: ResolveOptions): ResolvedTimeZone {
  const manual = manualTimeZone?.trim();
  if (manual && isValidTimeZone(manual)) {
    return { timeZone: manual, source: "manual" };
  }

  const fromLocation = timeZoneFromCoordinates(coordinates, lookup);
  if (fromLocation) return { timeZone: fromLocation, source: "location" };

  // Last resort. isValidTimeZone guards against a device reporting something
  // ICU cannot resolve, which would otherwise poison every stored timestamp.
  return {
    timeZone: isValidTimeZone(deviceTimeZone) ? deviceTimeZone : "UTC",
    source: "device",
  };
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
