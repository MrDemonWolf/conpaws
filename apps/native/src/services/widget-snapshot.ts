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
  /**
   * Localized age-pill label ("13+ Teen"), pre-rendered here for the same
   * reason `dateRangeLabel` is: the widget renders the app's language, not the
   * device's, and the translations live on this side of the bridge. Null means
   * all-ages or unrated — the widget draws no pill. Added in schema v2; the
   * Swift side decodes it as optional so v1 payloads still parse.
   */
  ageRating: string | null;
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
  schemaVersion: 2;
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
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

/**
 * The pill label for a rating that restricts who may attend. "all-ages" and
 * null both mean no pill — matching `AGE_BADGES` in EventItem, which only
 * badges the restrictive tiers.
 */
function agePillLabel(
  ageRating: ConventionEvent["ageRating"],
  localeIdentifier: string,
): string | null {
  if (!ageRating || ageRating === "all-ages") return null;
  return i18n.t(`convention.ageRatings.${ageRating}`, {
    lng: localeIdentifier,
  });
}

function eventSnapshot(
  event: ConventionEvent,
  localeIdentifier: string,
): WidgetEventSnapshot | null {
  if (!event.isInSchedule) return null;
  // A marked event stays on the phone's schedule so the user can see what
  // happened to it, but the widget and the Watch answer "what is next" — and
  // the answer is never a panel the convention stopped running. There is no
  // room on those surfaces to explain the difference.
  if (event.feedStatus !== null) return null;
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
    ageRating: agePillLabel(event.ageRating, localeIdentifier),
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
      .map((event) => eventSnapshot(event, localeIdentifier))
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
    schemaVersion: 2,
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
