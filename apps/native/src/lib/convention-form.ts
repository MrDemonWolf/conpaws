import { isValidTimeZone } from "./convention-time";
import { normalizeLocationName } from "./convention-location";

/**
 * Validation shared by the create and edit forms. Keeping it here rather than
 * in either screen is the point: two copies of these rules would drift, and a
 * convention that can be created but not edited (or the reverse) is worse than
 * no validation at all.
 */

/**
 * Long enough for the wordiest real convention name plus a year, short enough
 * that a paste accident cannot wreck every list row that renders it. The
 * database has no constraint, so this is the only thing enforcing a bound.
 */
export const CONVENTION_NAME_MAX_LENGTH = 80;

/**
 * A convention spanning more than this is almost certainly a mistyped year.
 * It is a warning rather than a hard stop — a few events really do run long,
 * and refusing to save someone's real dates is the worse failure.
 */
export const CONVENTION_LONG_SPAN_DAYS = 31;

export type ConventionFieldError =
  | "nameRequired"
  | "nameTooLong"
  | "endBeforeStart"
  | "timeZoneInvalid";

export interface ConventionFormValues {
  name: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  location: string;
}

export interface ConventionFormValidation {
  /** Field-keyed errors, so each input can show its own message. */
  errors: Partial<Record<keyof ConventionFormValues, ConventionFieldError>>;
  /** Non-blocking notices. Present even when the form is valid. */
  warnings: { longSpan?: number };
  valid: boolean;
  /** Cleaned values, safe to persist. Only meaningful when `valid`. */
  cleaned: ConventionFormValues;
}

/**
 * Collapses runs of whitespace and trims. Users paste names out of web pages,
 * which routinely carries newlines and doubled spaces into the field.
 */
export function normalizeConventionName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Counts by code point, so an emoji costs 1 rather than 2. */
export function conventionNameLength(value: string): number {
  return [...normalizeConventionName(value)].length;
}

function dayDifference(startDate: string, endDate: string): number | null {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function validateConventionForm(
  values: ConventionFormValues,
): ConventionFormValidation {
  const name = normalizeConventionName(values.name);
  const timeZone = values.timeZone.trim();
  const errors: ConventionFormValidation["errors"] = {};

  if (!name) errors.name = "nameRequired";
  else if ([...name].length > CONVENTION_NAME_MAX_LENGTH) {
    errors.name = "nameTooLong";
  }

  if (!isValidTimeZone(timeZone)) errors.timeZone = "timeZoneInvalid";

  const span = dayDifference(values.startDate, values.endDate);
  // A null span means an unparseable date, which the pickers cannot produce;
  // treating it as out-of-order is the safe reading.
  if (span === null || span < 0) errors.endDate = "endBeforeStart";

  const warnings: ConventionFormValidation["warnings"] = {};
  if (span !== null && span > CONVENTION_LONG_SPAN_DAYS) {
    warnings.longSpan = span;
  }

  return {
    errors,
    warnings,
    valid: Object.keys(errors).length === 0,
    cleaned: {
      name,
      startDate: values.startDate,
      endDate: values.endDate,
      timeZone,
      location: normalizeLocationName(values.location),
    },
  };
}

/** True when nothing the user can edit differs from what is stored. */
export function isConventionUnchanged(
  values: ConventionFormValues,
  original: ConventionFormValues,
): boolean {
  return (
    normalizeConventionName(values.name) ===
      normalizeConventionName(original.name) &&
    values.startDate === original.startDate &&
    values.endDate === original.endDate &&
    values.timeZone.trim() === original.timeZone.trim() &&
    normalizeLocationName(values.location) ===
      normalizeLocationName(original.location)
  );
}
