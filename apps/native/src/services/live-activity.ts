import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import i18n from "@/lib/i18n";
import {
  buildWidgetSnapshot,
  type WidgetConventionSnapshot,
  type WidgetEventSnapshot,
  type WidgetSnapshot,
} from "./widget-snapshot";

export type LiveActivityPhase = "upcoming" | "current" | "leave" | "finished";

export interface LiveActivityStatus {
  availability: "available" | "disabled" | "unsupported";
  active: boolean;
  activityId?: string;
  phase?: LiveActivityPhase;
  reason?: "no-plan" | "invalid-payload";
}

interface LiveActivityEventContent {
  phase: LiveActivityPhase;
  localeIdentifier: string;
  timeZoneIdentifier: string;
  conventionName: string;
  eventId: string;
  eventTitle: string;
  room: string | null;
  publishedStartAtMs: number;
  publishedEndAtMs: number | null;
  attendanceStartAtMs: number;
  attendanceEndAtMs: number | null;
  attendanceNeedsReview: boolean;
  hasPersonalStart: boolean;
  hasPersonalEnd: boolean;
  nextEventTitle: string | null;
  nextRoom: string | null;
  nextAttendanceStartAtMs: number | null;
}

export interface LiveActivityPayload {
  conventionId: string;
  staleAtMs: number | null;
  content: LiveActivityEventContent;
}

interface NativeLiveActivityModule {
  getLiveActivityStatus?(): Promise<LiveActivityStatus>;
  startOrUpdateLiveActivity?(json: string): Promise<LiveActivityStatus>;
  endLiveActivity?(showFinishedState: boolean): Promise<LiveActivityStatus>;
}

const nativeModule =
  requireOptionalNativeModule<NativeLiveActivityModule>("ConPawsWidgets");
const UNKNOWN_END_MS = 60 * 60 * 1000;
const LEAVE_WINDOW_MS = 60 * 1000;

function hasNativePlanSurface(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

interface ProjectedEvent {
  event: WidgetEventSnapshot;
  start: number;
  end: number;
}

function projectedEvents(
  convention: WidgetConventionSnapshot,
): ProjectedEvent[] {
  const sorted = convention.events
    .filter((event) => Number.isFinite(event.attendanceStartAtMs))
    .sort(
      (left, right) =>
        left.attendanceStartAtMs - right.attendanceStartAtMs ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );

  return sorted.map((event, index) => {
    const laterStart = sorted
      .slice(index + 1)
      .find(
        (candidate) =>
          candidate.attendanceStartAtMs > event.attendanceStartAtMs,
      )?.attendanceStartAtMs;
    const fallbackEnd = Math.min(
      laterStart ?? Number.POSITIVE_INFINITY,
      event.attendanceStartAtMs + UNKNOWN_END_MS,
    );
    const end =
      event.attendanceEndAtMs !== null &&
      event.attendanceEndAtMs > event.attendanceStartAtMs
        ? event.attendanceEndAtMs
        : fallbackEnd;
    return { event, start: event.attendanceStartAtMs, end };
  });
}

function conventionProjection(
  convention: WidgetConventionSnapshot,
  nowMs: number,
): {
  events: ProjectedEvent[];
  current: ProjectedEvent | undefined;
  next: ProjectedEvent | undefined;
} {
  const events = projectedEvents(convention);
  const current = events
    .filter(({ start, end }) => start <= nowMs && nowMs < end)
    .at(-1);
  const next = events.find(({ start }) => start > nowMs);
  return { events, current, next };
}

/** Project the shared persistent plan once; every ActivityKit view receives it. */
export function projectLiveActivity(
  snapshot: WidgetSnapshot,
  nowMs = Date.now(),
): LiveActivityPayload | null {
  const candidates = snapshot.conventions
    .map((convention) => ({
      convention,
      projection: conventionProjection(convention, nowMs),
    }))
    .filter(
      ({ convention, projection }) =>
        projection.events.length > 0 &&
        (convention.endAtMs >= nowMs ||
          projection.current !== undefined ||
          projection.next !== undefined),
    )
    .sort(
      (left, right) =>
        left.convention.startAtMs - right.convention.startAtMs ||
        left.convention.name.localeCompare(right.convention.name),
    );
  const selected = candidates[0];
  if (!selected || selected.projection.events.length === 0) return null;

  const { convention, projection } = selected;
  const primary =
    projection.current ?? projection.next ?? projection.events.at(-1);
  if (!primary) return null;
  const next = projection.current ? projection.next : undefined;
  const hasPersonalStart =
    !primary.event.attendanceNeedsReview &&
    Math.abs(primary.event.attendanceStartAtMs - primary.event.startAtMs) >= 1;
  const hasPersonalEnd =
    !primary.event.attendanceNeedsReview &&
    primary.event.attendanceEndAtMs !== null &&
    (primary.event.endAtMs === null ||
      Math.abs(primary.event.attendanceEndAtMs - primary.event.endAtMs) >= 1);
  const phase: LiveActivityPhase = projection.current
    ? hasPersonalEnd && primary.end - nowMs <= LEAVE_WINDOW_MS
      ? "leave"
      : "current"
    : projection.next
      ? "upcoming"
      : "finished";
  const staleAtMs =
    phase === "upcoming"
      ? primary.start
      : phase === "current" || phase === "leave"
        ? primary.end
        : null;

  return {
    conventionId: convention.id,
    staleAtMs,
    content: {
      phase,
      localeIdentifier: snapshot.localeIdentifier,
      timeZoneIdentifier: convention.timeZoneIdentifier,
      conventionName: convention.name,
      eventId: primary.event.id,
      eventTitle: primary.event.title,
      room: primary.event.room ?? primary.event.location,
      publishedStartAtMs: primary.event.startAtMs,
      publishedEndAtMs: primary.event.endAtMs,
      attendanceStartAtMs: primary.event.attendanceStartAtMs,
      attendanceEndAtMs: primary.event.attendanceEndAtMs,
      attendanceNeedsReview: primary.event.attendanceNeedsReview,
      hasPersonalStart,
      hasPersonalEnd,
      nextEventTitle: next?.event.title ?? null,
      nextRoom: next ? (next.event.room ?? next.event.location) : null,
      nextAttendanceStartAtMs: next?.start ?? null,
    },
  };
}

async function loadSnapshot(): Promise<WidgetSnapshot> {
  const conventions = await conventionsRepo.getAll();
  const entries = await Promise.all(
    conventions.map(
      async (convention) =>
        [
          convention.id,
          await eventsRepo.getByConventionId(convention.id),
        ] as const,
    ),
  );
  return buildWidgetSnapshot(
    conventions,
    new Map(entries),
    i18n.resolvedLanguage || i18n.language || "en",
  );
}

function unsupportedStatus(): LiveActivityStatus {
  return { availability: "unsupported", active: false };
}

export async function getLiveActivityStatus(): Promise<LiveActivityStatus> {
  if (!hasNativePlanSurface() || !nativeModule?.getLiveActivityStatus) {
    return unsupportedStatus();
  }
  return nativeModule.getLiveActivityStatus();
}

/** Explicit opt-in only: nothing starts an OS plan surface automatically. */
export async function startOrUpdateLiveActivity(
  snapshot?: WidgetSnapshot,
  nowMs = Date.now(),
): Promise<LiveActivityStatus> {
  if (!hasNativePlanSurface() || !nativeModule?.startOrUpdateLiveActivity) {
    return unsupportedStatus();
  }
  const payload = projectLiveActivity(
    snapshot ?? (await loadSnapshot()),
    nowMs,
  );
  if (!payload) {
    if (nativeModule.endLiveActivity) {
      await nativeModule.endLiveActivity(false);
    }
    return { availability: "available", active: false, reason: "no-plan" };
  }
  return nativeModule.startOrUpdateLiveActivity(JSON.stringify(payload));
}

export async function endLiveActivity(
  showFinishedState = true,
): Promise<LiveActivityStatus> {
  if (!hasNativePlanSurface() || !nativeModule?.endLiveActivity) {
    return unsupportedStatus();
  }
  return nativeModule.endLiveActivity(showFinishedState);
}
