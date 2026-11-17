import type { MaterialColors } from "@expo/ui/jetpack-compose";
import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { getCalendars } from "expo-localization";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import type { Convention, ConventionEvent } from "@/db/schema";
import type { AppearancePreference } from "@/lib/appearance";
import { getAppearancePreference } from "@/lib/appearance-storage";
import { fromConventionTime, isValidTimeZone } from "@/lib/convention-time";
import {
  getTimeFormatPreference,
  resolveHour12,
  type TimeFormatPreference,
} from "@/lib/device-clock";
import { plannedEvent } from "@/lib/drop-in-visit";
import i18n from "@/lib/i18n";
import { getNativeMaterialColors } from "@/lib/native-material-colors";
import { themeTokens } from "@/lib/theme-tokens";
import type { WidgetStrings } from "@/widgets/ConPawsWidget.types";

type WidgetPalette = {
  background: string;
  foreground: string;
  secondary: string;
  accent: string;
};
type WidgetMaterialColors = Pick<
  MaterialColors,
  "surfaceContainer" | "onSurface" | "onSurfaceVariant" | "primary"
>;

export interface WidgetPresentation {
  appearance: AppearancePreference;
  appScheme?: "conpaws" | "conpaws-dev";
  hour12?: boolean;
  strings?: WidgetStrings;
  palette: { light: WidgetPalette; dark: WidgetPalette };
  labels: Record<"next" | "current" | "noEvents" | "finished", string>;
}

export function buildWidgetPresentation(
  light: WidgetMaterialColors | null,
  dark: WidgetMaterialColors | null,
  appearance: AppearancePreference,
  localeIdentifier: string,
): WidgetPresentation {
  const palette = (colors: WidgetMaterialColors): WidgetPalette => {
    // Expo supplies RRGGBBAA; Android Color.parseColor expects AARRGGBB.
    const opaque = (color: string) => color.slice(0, 7);
    return {
      background: opaque(colors.surfaceContainer),
      foreground: opaque(colors.onSurface),
      secondary: opaque(colors.onSurfaceVariant),
      accent: opaque(colors.primary),
    };
  };
  const t = (key: string) => i18n.t(key, { lng: localeIdentifier });
  return {
    appearance,
    palette: {
      light: light
        ? palette(light)
        : {
            background: "#ffffff",
            foreground: themeTokens.light.foreground,
            secondary: themeTokens.light.mutedForeground,
            accent: themeTokens.light.primary,
          },
      dark: dark
        ? palette(dark)
        : {
            background: "#000000",
            foreground: themeTokens.dark.foreground,
            secondary: themeTokens.dark.mutedForeground,
            accent: themeTokens.dark.primary,
          },
    },
    labels: {
      next: t("convention.now.upNext"),
      current: t("convention.now.happeningNow"),
      noEvents: t("schedule.empty.title"),
      finished: t("schedule.caughtUp.title"),
    },
  };
}

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
  /** Original counts retained when Expo timeline entries trim event history. */
  eventCount?: number;
  remainingTodayCount?: number;
}

export interface WidgetSnapshot {
  schemaVersion: 2;
  generatedAtMs: number;
  localeIdentifier: string;
  timeFormat?: TimeFormatPreference;
  presentation?: WidgetPresentation;
  conventions: WidgetConventionSnapshot[];
}

interface NativeWidgetModule {
  publishSnapshot(json: string): Promise<boolean>;
  getWidgetStrings?(localeIdentifier: string): WidgetStrings | null;
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
  sourceEvent: ConventionEvent,
  localeIdentifier: string,
): WidgetEventSnapshot | null {
  const event = plannedEvent(sourceEvent);
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
    endAtMs:
      Number.isFinite(parsedEnd) && parsedEnd >= startAtMs ? parsedEnd : null,
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
  timeFormat: TimeFormatPreference = "system",
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
    const parsedEndAtMs = fromConventionTime(
      { ...end, day: end.day + 1 },
      timeZoneIdentifier,
    ).getTime();
    if (!Number.isFinite(startAtMs) || !Number.isFinite(parsedEndAtMs))
      return [];
    const endAtMs = Math.max(startAtMs, parsedEndAtMs);

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
      new Date(Math.max(startAtMs, parsedEndAtMs - 1)),
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
    timeFormat,
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

/**
 * Every point that republishes the widgets (launch, foreground, mutations,
 * imports, refreshes, language and clock changes) is also when a tracked event
 * may have ended, been unsaved or need new labels. It runs whether or not the
 * publication worked, so a widget fault cannot leave a finished event tracked,
 * and fire-and-forget so the publication's result and timing stay its own.
 */
function reconcileTrackedEventAfterPublish(): void {
  void import("./tracked-event")
    .then(({ reconcileTrackedEvent }) => reconcileTrackedEvent())
    .catch((error: unknown) =>
      import("@/lib/error-reporting").then(({ reportError }) =>
        reportError(error, { scope: "tracked-event.reconcile" }),
      ),
    )
    .catch(() => undefined);
}

async function buildAndPublishSnapshot(): Promise<boolean> {
  if (!nativeWidgetModule) return false;
  try {
    return await buildSnapshotAndPublish(nativeWidgetModule);
  } finally {
    reconcileTrackedEventAfterPublish();
  }
}

async function buildSnapshotAndPublish(
  nativeWidgetModule: NativeWidgetModule,
): Promise<boolean> {
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
    Date.now(),
    getTimeFormatPreference(),
  );
  snapshot.presentation = buildWidgetPresentation(
    getNativeMaterialColors("light"),
    getNativeMaterialColors("dark"),
    getAppearancePreference(),
    snapshot.localeIdentifier,
  );
  snapshot.presentation.appScheme =
    Constants.expoConfig?.extra?.appVariant === "development"
      ? "conpaws-dev"
      : "conpaws";
  // shortcut: closed widgets keep this system-clock choice until the next app publication.
  snapshot.presentation.hour12 = resolveHour12(
    snapshot.timeFormat ?? "system",
    getCalendars()[0]?.uses24hourClock,
  );
  snapshot.presentation.strings =
    nativeWidgetModule.getWidgetStrings?.(snapshot.localeIdentifier) ??
    undefined;
  // Watch and the Android timer only need schedule data, not phone layout strings.
  const published = await nativeWidgetModule.publishSnapshot(
    JSON.stringify({ ...snapshot, presentation: undefined }),
  );
  const { publishPhoneWidget } = await import("./widget-publication");
  publishPhoneWidget(snapshot);
  return published;
}
