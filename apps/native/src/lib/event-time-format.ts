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

type FormatterKind = "time" | "dayLabel" | "date" | "dateAndTime";

const FORMATTER_OPTIONS: Record<FormatterKind, Intl.DateTimeFormatOptions> = {
  time: { hour: "numeric", minute: "2-digit" },
  dayLabel: { weekday: "long", month: "long", day: "numeric" },
  date: { dateStyle: "medium" },
  dateAndTime: { dateStyle: "full", timeStyle: "short" },
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

  const formatter = new Intl.DateTimeFormat(locale, {
    ...FORMATTER_OPTIONS[kind],
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(hour12 === undefined ? {} : { hour12 }),
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
