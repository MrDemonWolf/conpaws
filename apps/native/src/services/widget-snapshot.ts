import { requireOptionalNativeModule } from "expo";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";
import { fromConventionTime, isValidTimeZone } from "@/lib/convention-time";
import i18n from "@/lib/i18n";

export interface WidgetEventSnapshot {
  id: string;
  title: string;
  startAtMs: number;
  endAtMs: number | null;
  location: string | null;
  room: string | null;
  reminderMinutes: number | null;
}

export interface WidgetConventionSnapshot {
  id: string;
  name: string;
  startAtMs: number;
  endAtMs: number;
  timeZoneIdentifier: string;
  dateRangeLabel: string;
  events: WidgetEventSnapshot[];
}

export interface WidgetSnapshot {
  schemaVersion: 1;
  generatedAtMs: number;
  localeIdentifier: string;
  conventions: WidgetConventionSnapshot[];
}

interface NativeWidgetModule {
  publishSnapshot(json: string): Promise<boolean>;
}

const nativeWidgetModule =
  requireOptionalNativeModule<NativeWidgetModule>("ConPawsWidgets");

function calendarParts(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Number.isInteger(year) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31
    ? { year, month, day }
    : null;
}

function eventSnapshot(event: ConventionEvent): WidgetEventSnapshot | null {
  if (!event.isInSchedule) return null;
  const startAtMs = Date.parse(event.startTime);
  if (!Number.isFinite(startAtMs)) return null;
  const parsedEnd = event.endTime ? Date.parse(event.endTime) : Number.NaN;
  return {
    id: event.id,
    title: event.title,
    startAtMs,
    endAtMs: Number.isFinite(parsedEnd) ? parsedEnd : null,
    location: event.location,
    room: event.room,
    reminderMinutes: event.reminderMinutes,
  };
}

export function buildWidgetSnapshot(
  conventions: readonly Convention[],
  eventsByConvention: ReadonlyMap<string, readonly ConventionEvent[]>,
  localeIdentifier: string,
  generatedAtMs = Date.now(),
): WidgetSnapshot {
  const fallbackTimeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const formatterCache = new Map<string, Intl.DateTimeFormat>();

  const snapshots = conventions.flatMap((convention) => {
    const start = calendarParts(convention.startDate);
    const end = calendarParts(convention.endDate);
    if (!start || !end) return [];
    const timeZoneIdentifier = isValidTimeZone(convention.timeZone)
      ? convention.timeZone
      : fallbackTimeZone;
    const startAtMs = fromConventionTime(start, timeZoneIdentifier).getTime();
    const endAtMs = fromConventionTime(
      { ...end, day: end.day + 1 },
      timeZoneIdentifier,
    ).getTime();
    if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs)) return [];

    let formatter = formatterCache.get(timeZoneIdentifier);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(localeIdentifier, {
        dateStyle: "medium",
        timeZone: timeZoneIdentifier,
      });
      formatterCache.set(timeZoneIdentifier, formatter);
    }
    const startLabel = formatter.format(new Date(startAtMs));
    const endLabel = formatter.format(
      fromConventionTime(end, timeZoneIdentifier),
    );
    const events = (eventsByConvention.get(convention.id) ?? [])
      .map(eventSnapshot)
      .filter((event): event is WidgetEventSnapshot => event !== null)
      .sort(
        (a, b) => a.startAtMs - b.startAtMs || a.title.localeCompare(b.title),
      );

    return [
      {
        id: convention.id,
        name: convention.name,
        startAtMs,
        endAtMs,
        timeZoneIdentifier,
        dateRangeLabel: i18n.t("home.dateRange", {
          lng: localeIdentifier,
          start: startLabel,
          end: endLabel,
        }),
        events,
      },
    ];
  });

  return {
    schemaVersion: 1,
    generatedAtMs,
    localeIdentifier,
    conventions: snapshots.sort(
      (a, b) => a.startAtMs - b.startAtMs || a.name.localeCompare(b.name),
    ),
  };
}

let publishing: Promise<boolean> | null = null;
let pendingRepublish: Promise<boolean> | null = null;

/**
 * Serialized so concurrent triggers cannot each reload every convention, and
 * so a slow older build can never publish over a newer one. Requests that
 * arrive mid-flight coalesce into a single follow-up run, which reads the
 * database after all of them have landed.
 */
export function publishWidgetSnapshot(): Promise<boolean> {
  if (!nativeWidgetModule) return Promise.resolve(false);

  if (!publishing) {
    publishing = buildAndPublishSnapshot().finally(() => {
      publishing = null;
    });
    return publishing;
  }

  if (!pendingRepublish) {
    pendingRepublish = publishing
      .catch(() => false)
      .then(() => {
        pendingRepublish = null;
        return publishWidgetSnapshot();
      });
  }

  return pendingRepublish;
}

async function buildAndPublishSnapshot(): Promise<boolean> {
  if (!nativeWidgetModule) return false;
  const conventions = await conventionsRepo.getAll();
  const eventEntries = await Promise.all(
    conventions.map(
      async (convention) =>
        [
          convention.id,
          await eventsRepo.getByConventionId(convention.id),
        ] as const,
    ),
  );
  const snapshot = buildWidgetSnapshot(
    conventions,
    new Map(eventEntries),
    i18n.resolvedLanguage || i18n.language || "en",
  );
  return nativeWidgetModule.publishSnapshot(JSON.stringify(snapshot));
}
