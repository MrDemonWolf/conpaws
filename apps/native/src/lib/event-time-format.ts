/**
 * Shared date and time formatting for the schedule surfaces.
 *
 * Both schedule lists used to build an `Intl.DateTimeFormat` per row and per
 * section header. This app installs the formatjs `DateTimeFormat` polyfill,
 * where constructing a formatter costs roughly ninety times what reusing one
 * costs, so a search keystroke that re-renders a windowed list paid for two
 * constructions per visible row.
 *
 * The cache key carries everything that can change the output, so a hit is
 * always safe to reuse. The supported locales, the convention time zones on
 * one device and the clock preference are all small finite sets, so the map
 * never grows unbounded.
 */

import { conventionDayKey } from "./convention-time";

type FormatterKind =
  | "time"
  | "shortTime"
  | "dayLabel"
  | "date"
  | "dateAndTime"
  | "weekdayShort";

const FORMATTER_OPTIONS: Record<FormatterKind, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  shortTime: { timeStyle: "short" },
  dayLabel: { weekday: "long", month: "long", day: "numeric" },
  date: { dateStyle: "medium" },
  dateAndTime: { dateStyle: "full", timeStyle: "short" },
  weekdayShort: { weekday: "short" },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * A shared formatter for one kind of output. `timeZone` left undefined means
 * the device zone, which is what a plain calendar date wants.
 */
export function scheduleFormatter(
  kind: FormatterKind,
  locale: string,
  timeZone?: string,
  hour12?: boolean,
): Intl.DateTimeFormat {
  const key = `${kind}|${locale}|${timeZone ?? ""}|${hour12 ?? ""}`;
  const cached = formatterCache.get(key);
  if (cached) return cached;

  // `hour12` is asked for as a boolean but applied as an hour cycle, because
  // `hour12: true` resolves to whichever 12-hour cycle the locale prefers, and
  // for German and Japanese that is h11, which counts 0 to 11. A device set to
  // 12-hour time then rendered half past midday as "0:30 PM". Naming h12 and
  // h23 outright keeps the user's choice and skips the two cycles nobody wants.
  const hourCycle =
    hour12 === undefined
      ? undefined
      : hour12
        ? ("h12" as const)
        : ("h23" as const);

  // A 24-hour clock pads the hour and a 12-hour one does not: "00:30" and
  // "7:00 PM" are both what their readers expect, and "0:30" and "07:00 PM"
  // are both slightly wrong.
  const hourWidth =
    hourCycle === "h23" ? ({ hour: "2-digit" } as const) : undefined;

  const formatter = new Intl.DateTimeFormat(locale, {
    ...FORMATTER_OPTIONS[kind],
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(hourCycle === undefined ? {} : { hourCycle }),
    ...(kind === "time" && hourWidth ? hourWidth : {}),
  });
  formatterCache.set(key, formatter);
  return formatter;
}

/** The clock time of an event, in the convention's zone. */
export function formatEventTime(
  isoString: string | null,
  timeZone: string,
  locale: string,
  hour12?: boolean,
): string {
  if (!isoString) return "";
  const value = new Date(isoString);
  if (Number.isNaN(value.getTime())) return "";
  return scheduleFormatter("time", locale, timeZone, hour12).format(value);
}

/**
 * How many convention-local days later than the start the end falls, counting
 * calendar days rather than elapsed hours: an event running 10 PM to 1 AM
 * spans one day, and so does one running 1 AM to 11 PM.
 *
 * Zero when either instant is missing or unparseable, so callers fall back to
 * the plain clock time rather than inventing a day boundary.
 */
export function eventEndDayOffset(
  startIso: string,
  endIso: string | null,
  timeZone: string,
): number {
  if (!endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const startKey = conventionDayKey(start, timeZone);
  const endKey = conventionDayKey(end, timeZone);
  if (startKey === endKey) return 0;

  const days =
    (Date.parse(`${endKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) /
    86_400_000;
  return Number.isFinite(days) ? Math.round(days) : 0;
}

/**
 * The end of an event, for the two-line time column on a schedule row.
 *
 * A bare clock time is a lie for anything that crosses midnight: IndyFurCon's
 * three-day "Tabletop Gaming" rendered as "10:00 PM" over "9:00 PM", which
 * reads as ending before it starts. When the end lands on a different
 * convention-local day it carries an abbreviated weekday — "Sun 9:00 PM" —
 * matching what the iOS widget's `conPawsTimeLabel` already does. The weekday
 * comes from `Intl`, so it needs no new translated strings.
 */
export function formatEventEndTime(
  startIso: string,
  endIso: string | null,
  timeZone: string,
  locale: string,
  hour12?: boolean,
): string {
  const clock = formatEventTime(endIso, timeZone, locale, hour12);
  if (!clock || !endIso) return clock;
  if (eventEndDayOffset(startIso, endIso, timeZone) === 0) return clock;

  const weekday = scheduleFormatter("weekdayShort", locale, timeZone).format(
    new Date(endIso),
  );
  return `${weekday} ${clock}`;
}

/**
 * The end of an event for the action sheet, which prints the start as a full
 * date and time and has the width to match. A same-day end stays a clock time
 * so the common row does not repeat the date it just said.
 */
export function formatEventEndDateTime(
  startIso: string,
  endIso: string | null,
  timeZone: string,
  locale: string,
  hour12?: boolean,
): string {
  if (!endIso) return "";
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return "";
  if (eventEndDayOffset(startIso, endIso, timeZone) === 0) {
    return formatEventTime(endIso, timeZone, locale, hour12);
  }
  return scheduleFormatter("dateAndTime", locale, timeZone, hour12).format(end);
}

/** The day heading for a group of events, in the convention's zone. */
export function formatEventDayLabel(
  isoString: string,
  timeZone: string,
  locale: string,
): string {
  return scheduleFormatter("dayLabel", locale, timeZone).format(
    new Date(isoString),
  );
}

/**
 * The day heading for a plain calendar date.
 *
 * Formatted in UTC: handing "2026-07-04" to a formatter in the device's zone
 * renders it as the 3rd anywhere west of Greenwich.
 */
export function formatDayKeyLabel(dayKey: string, locale: string): string {
  return scheduleFormatter("dayLabel", locale, "UTC").format(
    new Date(`${dayKey}T00:00:00Z`),
  );
}

/**
 * A convention day as a medium date. Midday, so the device zone cannot move
 * the rendered date onto the day before or after.
 */
export function formatConventionDate(dayKey: string, locale: string): string {
  return scheduleFormatter("date", locale).format(
    new Date(`${dayKey}T12:00:00`),
  );
}

/**
 * A `Date` as a medium date, through the shared cache.
 *
 * Four screens built their own `Intl.DateTimeFormat` for this instead, one of
 * them inside render -- the per-construction cost this module's cache exists
 * to avoid. `timeZone` defaults to the device zone, which is what a picker
 * value and a convention start date both want.
 */
export function formatMediumDate(
  value: Date,
  locale: string,
  timeZone?: string,
): string {
  return scheduleFormatter("date", locale, timeZone).format(value);
}

/** A `Date` as a short wall-clock time, through the shared cache. */
export function formatShortTime(
  value: Date,
  locale: string,
  timeZone?: string,
): string {
  return scheduleFormatter("shortTime", locale, timeZone).format(value);
}
