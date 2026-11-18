import type { Convention, ConventionEvent } from "@/db/schema";
import { isValidTimeZone } from "./convention-time";
import { plannedEvent } from "./drop-in-visit";
import { formatEventEndTime, formatEventTime } from "./event-time-format";
import {
  TRACKED_EVENT_LEAD_MS,
  TRACKED_EVENT_OPEN_END_MS,
  type TrackedEventBlocker,
  type TrackedEventLabels,
  type TrackedEventPlan,
  type TrackedEventStopReason,
} from "./tracked-event.types";

/** Everything the planner needs from the device that is not in the database. */
export interface TrackedEventContext {
  locale: string;
  hour12: boolean | undefined;
  /** Used when the convention has no time zone, or one Intl cannot load. */
  fallbackTimeZone: string;
  labels: TrackedEventLabels;
  appScheme: string;
}

type Resolved =
  | { kind: "stop"; reason: TrackedEventStopReason }
  | {
      kind: "ok";
      event: ConventionEvent;
      convention: Convention;
      startAtMs: number;
      endAtMs: number | null;
      cleanupAtMs: number;
    };

/**
 * The checks shared by "can this be tracked" and "should this still be shown".
 *
 * The order matters: a deleted or unsaved event reads as that, not as "ended",
 * so the UI can say what actually happened to it.
 */
function resolveTrackedEvent(
  sourceEvent: ConventionEvent | undefined,
  convention: Convention | undefined,
  nowMs: number,
): Resolved {
  // An event that moved to another convention cannot be the one the user
  // chose, so it is treated the same as one that disappeared.
  if (
    !sourceEvent ||
    !convention ||
    sourceEvent.conventionId !== convention.id
  ) {
    return { kind: "stop", reason: "deleted" };
  }
  // A drop-in is tracked by the visit the user planned, not by the room's
  // opening hours; without a valid visit it is not on their plan at all.
  const event = plannedEvent(sourceEvent);
  if (!event.isInSchedule) return { kind: "stop", reason: "unsaved" };
  if (event.feedStatus === "cancelled")
    return { kind: "stop", reason: "cancelled" };
  if (event.feedStatus === "removed")
    return { kind: "stop", reason: "removed" };
  if (convention.archivedAt) return { kind: "stop", reason: "archived" };

  const startAtMs = Date.parse(event.startTime);
  if (!Number.isFinite(startAtMs)) return { kind: "stop", reason: "invalid" };
  const parsedEnd = event.endTime ? Date.parse(event.endTime) : Number.NaN;
  // An end at or before the start is a feed mistake, not a zero-length event,
  // so it is shown as no end rather than as a time that already passed.
  const endAtMs =
    Number.isFinite(parsedEnd) && parsedEnd > startAtMs ? parsedEnd : null;
  const cleanupAtMs = endAtMs ?? startAtMs + TRACKED_EVENT_OPEN_END_MS;
  if (nowMs >= cleanupAtMs) return { kind: "stop", reason: "ended" };

  return { kind: "ok", event, convention, startAtMs, endAtMs, cleanupAtMs };
}

/** Null when the event can be tracked now. */
export function trackedEventBlocker(
  event: ConventionEvent | undefined,
  convention: Convention | undefined,
  nowMs: number,
): TrackedEventBlocker | null {
  const resolved = resolveTrackedEvent(event, convention, nowMs);
  if (resolved.kind === "stop") return resolved.reason;
  // Only a new start is held back by the lead time. Once tracked, an event
  // stays tracked even if the feed moves it later.
  if (resolved.startAtMs - nowMs > TRACKED_EVENT_LEAD_MS) return "too-early";
  return null;
}

function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** For an event that is already tracked: never returns "too-early". */
export function planTrackedEvent(
  sourceEvent: ConventionEvent | undefined,
  convention: Convention | undefined,
  nowMs: number,
  context: TrackedEventContext,
): TrackedEventPlan {
  const resolved = resolveTrackedEvent(sourceEvent, convention, nowMs);
  if (resolved.kind === "stop") return resolved;
  const { event, startAtMs, endAtMs, cleanupAtMs } = resolved;

  const timeZone = isValidTimeZone(resolved.convention.timeZone)
    ? resolved.convention.timeZone
    : context.fallbackTimeZone;
  const startLabel = formatEventTime(
    event.startTime,
    timeZone,
    context.locale,
    context.hour12,
  );
  // The end carries a weekday when it falls on another convention day, so an
  // overnight event never reads as ending before it starts.
  const endLabel =
    endAtMs === null
      ? ""
      : formatEventEndTime(
          event.startTime,
          event.endTime,
          timeZone,
          context.locale,
          context.hour12,
        );

  return {
    kind: "show",
    props: {
      eventId: event.id,
      conventionId: event.conventionId,
      title: event.title,
      conventionName: resolved.convention.name,
      place: trimmedOrNull(event.room) ?? trimmedOrNull(event.location),
      startAtMs,
      endAtMs,
      cleanupAtMs,
      timeLabel: endLabel ? `${startLabel} – ${endLabel}` : startLabel,
      labels: context.labels,
      url: `${context.appScheme}://convention/${encodeURIComponent(
        event.conventionId,
      )}?highlightEventId=${encodeURIComponent(event.id)}`,
    },
  };
}
