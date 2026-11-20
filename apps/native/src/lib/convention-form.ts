import type { TFunction } from "i18next";
import { normalizeLocationName } from "./convention-location";
import { isValidTimeZone } from "./convention-time";

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

/** The name's count shows once it is within this many characters of the limit. */
const NAME_COUNTER_MARGIN = 15;

/**
 * Everything a convention form says under its fields, as one block of text.
 *
 * `@expo/ui` renders only the last `FieldGroup.SectionFooter` in a section,
 * so a footer per row lost every note but the time zone help: Save greyed out
 * over a too-long name with the reason never shown. The forms put this in
 * their one footer instead, a line per note in the order of the rows.
 *
 * `locationSetsTimeZone` adds the note that saving geocodes the location into
 * a zone, which only the create form does unasked, and only where
 * `canInferTimeZoneFromLocation` allows.
 */
export function conventionFormFooter(
  validation: ConventionFormValidation,
  t: TFunction,
  { locationSetsTimeZone = false }: { locationSetsTimeZone?: boolean } = {},
): string {
  const nameLength = conventionNameLength(validation.cleaned.name);
  const { longSpan } = validation.warnings;
  const lines = [
    validation.errors.name === "nameTooLong"
      ? t("convention.nameTooLong", { max: CONVENTION_NAME_MAX_LENGTH })
      : nameLength > CONVENTION_NAME_MAX_LENGTH - NAME_COUNTER_MARGIN
        ? t("convention.nameCounter", {
            count: nameLength,
            max: CONVENTION_NAME_MAX_LENGTH,
          })
        : null,
    locationSetsTimeZone ? t("convention.locationTimeZoneNote") : null,
    longSpan !== undefined
      ? t("convention.longSpan", { count: longSpan })
      : null,
    validation.errors.timeZone
      ? t("convention.timeZoneInvalid")
      : t("convention.timeZoneAdvancedHelp"),
  ];
  return lines.filter((line) => line !== null).join("\n");
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
