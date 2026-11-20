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
import { handledWatchCommandIds } from "./watch-command-receipts";
import { withWatchExtras } from "./watch-snapshot";

/**
 * Paired colour roles for the Android widget. The container roles were added
 * after widgets were already stored on devices, so they are optional: the
 * widget derives them from the original four when an older snapshot lacks them.
 */
export type WidgetPalette = {
  background: string;
  foreground: string;
  secondary: string;
  accent: string;
  /** The hero card: Material primaryContainer. */
  container?: string;
  /** Text on the hero card: Material onPrimaryContainer. */
  onContainer?: string;
  /** Progress track and the stale strip: Material surfaceContainerHighest. */
  track?: string;
};
type WidgetMaterialColors = Pick<
  MaterialColors,
  "surfaceContainer" | "onSurface" | "onSurfaceVariant" | "primary"
> &
  Partial<
    Pick<
      MaterialColors,
      "primaryContainer" | "onPrimaryContainer" | "surfaceContainerHighest"
    >
  >;

/**
 * Templates keep their value as a `{name}` slot so the widget fills it in at
 * render time. Every one reuses a phrase the app already translates; the
 * Android widget cannot reach i18n and Android has no Swift string tables.
 * Snapshots stored before these existed fall back to English in the widget.
 */
type WidgetLabelKey =
  | "until"
  | "nextAt"
  | "startsInMinutes"
  | "today"
  | "tomorrow"
  | "inDays"
  | "checkedAt"
  | "noConvention"
  | "noConventionHint"
  | "noEventsHint"
  | "finishedHint";

export interface WidgetPresentation {
  appearance: AppearancePreference;
  appScheme?: "conpaws" | "conpaws-dev";
  hour12?: boolean;
  strings?: WidgetStrings;
  palette: { light: WidgetPalette; dark: WidgetPalette };
  labels: Record<"next" | "current" | "noEvents" | "finished", string> &
    Partial<Record<WidgetLabelKey, string>>;
}

/** Mixes `amount` of one #RRGGBB colour over another. */
function blend(top: string, bottom: string, amount: number): string {
  const channels = (color: string) =>
    [1, 3, 5].map((index) =>
      Number.parseInt(color.slice(index, index + 2), 16),
    );
  const a = channels(top);
  const b = channels(bottom);
  if ([...a, ...b].some((value) => Number.isNaN(value))) return bottom;
  return `#${a
    .map((value, index) =>
      Math.round(value * amount + b[index] * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Fills the container roles when the seeded Material palette is unavailable. */
function withContainers(palette: WidgetPalette): Required<WidgetPalette> {
  return {
    ...palette,
    container:
      palette.container ?? blend(palette.accent, palette.background, 0.16),
    onContainer: palette.onContainer ?? palette.foreground,
    track: palette.track ?? blend(palette.foreground, palette.background, 0.12),
  };
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
    return withContainers({
      background: opaque(colors.surfaceContainer),
      foreground: opaque(colors.onSurface),
      secondary: opaque(colors.onSurfaceVariant),
      accent: opaque(colors.primary),
      container: colors.primaryContainer && opaque(colors.primaryContainer),
      onContainer:
        colors.onPrimaryContainer && opaque(colors.onPrimaryContainer),
      track:
        colors.surfaceContainerHighest &&
        opaque(colors.surfaceContainerHighest),
    });
  };
  const t = (key: string, values: Record<string, string> = {}) =>
    i18n.t(key, { lng: localeIdentifier, ...values });
  return {
    appearance,
    palette: {
      light: light
        ? palette(light)
        : withContainers({
            background: "#ffffff",
            foreground: themeTokens.light.foreground,
            secondary: themeTokens.light.mutedForeground,
            accent: themeTokens.light.primary,
          }),
      dark: dark
        ? palette(dark)
        : withContainers({
            background: "#000000",
            foreground: themeTokens.dark.foreground,
            secondary: themeTokens.dark.mutedForeground,
            accent: themeTokens.dark.primary,
          }),
    },
    labels: {
      next: t("convention.now.upNext"),
      current: t("convention.now.happeningNow"),
      noEvents: t("schedule.empty.title"),
      finished: t("schedule.caughtUp.title"),
      until: t("convention.plan.until", { time: "{time}" }),
      nextAt: t("convention.now.next", { time: "{time}" }),
      startsInMinutes: t("reminders.notificationBody", {
        minutes: "{minutes}",
      }),
      today: t("home.countdown.today"),
      tomorrow: t("home.countdown.tomorrow"),
      // A string count skips i18next's plural lookup and keeps the slot.
      inDays: t("home.countdown.days", { count: "{count}" }),
      checkedAt: t("convention.scheduleUpdate.checkedAt", { time: "{time}" }),
      noConvention: t("home.empty.title"),
      noConventionHint: t("home.empty.subtitle"),
      noEventsHint: t("schedule.empty.subtitle"),
      finishedHint: t("schedule.caughtUp.subtitle", { name: "{name}" }),
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
  /** The whole canonical table, which also holds the Watch's strings. */
  getWidgetStrings?(
    localeIdentifier: string,
  ): (WidgetStrings & Record<string, unknown>) | null;
}

/** The fields of the native table the phone widget reads. */
const PHONE_WIDGET_STRING_KEYS = Object.keys({
  language: true,
  now: true,
  startingSoon: true,
  today: true,
  tomorrow: true,
  inFormat: true,
  compactNow: true,
  compactSoon: true,
  compactHoursFormat: true,
  compactDaysFormat: true,
  compactMonthsFormat: true,
  compactMinutesFormat: true,
  comingUpCaps: true,
  upNextCaps: true,
  happeningNowCaps: true,
  startsIn: true,
  startsInCaps: true,
  untilCapsFormat: true,
  reminderAtFormat: true,
  minutesBeforeFormat: true,
  noLaterSavedEvents: true,
  noLaterSavedEventsShort: true,
  noPicksTitle: true,
  noPicksHint: true,
  noConventionTitle: true,
  noConventionHint: true,
  finishedTitle: true,
  finishedHint: true,
  nextEventA11yFormat: true,
  planLastUpdatedFormat: true,
  staleHint: true,
  moreTodayFormat: true,
  hoursUnit: true,
  daysUnit: true,
  monthsUnit: true,
  minutesUnit: true,
} satisfies Record<keyof WidgetStrings, true>);

/**
 * Every iOS timeline entry carries its own copy of these strings, so the
 * Watch's share of the table would only use up the timeline's size budget.
 */
function phoneWidgetStrings(
  table: Record<string, unknown> | null | undefined,
): WidgetStrings | undefined {
  if (!table) return undefined;
  return Object.fromEntries(
    PHONE_WIDGET_STRING_KEYS.filter((key) => key in table).map((key) => [
      key,
      table[key],
    ]),
  ) as WidgetStrings;
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
  return toWidgetEvent(event, localeIdentifier);
}

/** One row in the widget's shape; null without a usable start. */
function toWidgetEvent(
  event: ConventionEvent,
  localeIdentifier: string,
): WidgetEventSnapshot | null {
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
    // Archived is off the plan: its reminders are cancelled and tracking is
    // refused, so it must not become the widget's or Watch's next convention.
    if (convention.archivedAt) return [];
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
  const eventsByConvention = new Map(eventEntries);
  const snapshot = buildWidgetSnapshot(
    conventions,
    eventsByConvention,
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
  snapshot.presentation.strings = phoneWidgetStrings(
    nativeWidgetModule.getWidgetStrings?.(snapshot.localeIdentifier),
  );
  // Watch and the Android timer only need schedule data, not phone layout
  // strings. On iOS the Watch also gets descriptions and the options it may
  // add from; the phone widgets below keep the plain snapshot.
  const published = await nativeWidgetModule.publishSnapshot(
    withWatchExtras(snapshot, eventsByConvention, {
      os: process.env.EXPO_OS,
      nowMs: snapshot.generatedAtMs,
      // Unsaved, so no reminder: a stale one on the row would claim one.
      toOption: (event) =>
        toWidgetEvent(
          { ...event, reminderMinutes: null },
          snapshot.localeIdentifier,
        ),
      handledCommandIds: handledWatchCommandIds(snapshot.generatedAtMs),
    }),
  );
  const { publishPhoneWidget } = await import("./widget-publication");
  publishPhoneWidget(snapshot);
  return published;
}
