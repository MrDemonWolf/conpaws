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

/** Collapses whitespace so " Pittsburgh ,  PA " stores as "Pittsburgh, PA". */
export function normalizeLocationName(value: string): string {
  return value
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}
