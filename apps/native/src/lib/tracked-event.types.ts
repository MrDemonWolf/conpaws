/**
 * Shared contract for Track event: one saved event the user chose to keep
 * visible outside the app (a Live Activity on iOS, an ongoing notification on
 * Android) until it ends or they stop it.
 *
 * Everything that crosses into the isolated Live Activity runtime or the
 * Android module is JSON-safe: plain strings and epoch milliseconds, already
 * formatted and translated on this side of the bridge.
 */

/**
 * How long before its start an event can be tracked.
 *
 * iOS ends a Live Activity after eight hours. Four hours of lead leaves room
 * for the event itself, and the same window on Android keeps the two platforms
 * from disagreeing about what "track this" means.
 */
export const TRACKED_EVENT_LEAD_MS = 4 * 60 * 60 * 1000;

/**
 * When the feed gives no end time, tracking is cleaned up an hour after the
 * start. This is the rule My plan and the widgets already use for "is it
 * over"; it is never shown as an end time.
 */
export const TRACKED_EVENT_OPEN_END_MS = 60 * 60 * 1000;

/** The Live Activity name registered with expo-widgets. */
export const TRACKED_EVENT_ACTIVITY_NAME = "ConPawsTrackedEvent";

/** The button target the Live Activity's Stop sends; native code matches it too. */
export const TRACKED_EVENT_STOP_TARGET = "conpaws-tracked-event-stop";

/** What this device remembers about the tracked event. Never backed up. */
export interface TrackedEventSelection {
  eventId: string;
  conventionId: string;
  startedAtMs: number;
}

/** Translated in the app: the surfaces that show them cannot reach i18n. */
export interface TrackedEventLabels {
  /** Caption above a countdown to the start, e.g. "Starts in". */
  startsIn: string;
  /** Caption above a countdown to the real end, e.g. "Ends in". */
  endsIn: string;
  /** Shown while an event with no end time is under way, e.g. "Now". */
  now: string;
  /** Shown once the event is over, e.g. "Ended". */
  ended: string;
  /** The Stop action, e.g. "Stop". */
  stop: string;
  /** Android notification channel name, e.g. "Tracked event". */
  channelName: string;
  /** Android notification channel description. */
  channelDescription: string;
}

export interface TrackedEventProps {
  eventId: string;
  conventionId: string;
  title: string;
  conventionName: string;
  /** Room, else location, else null. */
  place: string | null;
  startAtMs: number;
  /** The real end. Null when the event has none; never invented. */
  endAtMs: number | null;
  /**
   * When tracking is cleaned up: the real end, or the start plus
   * `TRACKED_EVENT_OPEN_END_MS`. Not for display.
   */
  cleanupAtMs: number;
  /**
   * "10:00 AM – 11:00 AM", or only the start when there is no end, in the
   * convention's time zone and the user's clock preference.
   */
  timeLabel: string;
  labels: TrackedEventLabels;
  /** Opens the event's convention; the scheme differs by app variant. */
  url: string;
}

/** Why tracking ended without the user pressing Stop. */
export type TrackedEventStopReason =
  | "deleted"
  | "unsaved"
  | "cancelled"
  | "removed"
  | "archived"
  | "ended"
  | "invalid";

/** Why an event cannot be tracked right now. */
export type TrackedEventBlocker = TrackedEventStopReason | "too-early";

export type TrackedEventPlan =
  | { kind: "show"; props: TrackedEventProps }
  | { kind: "stop"; reason: TrackedEventStopReason };

/** What the platform said when asked to show a tracked event. */
export type TrackedEventPresenterStart =
  | "started"
  /** Android: notifications are off, or the tracked-event channel is blocked. */
  | "notifications-denied"
  /** iOS: Live Activities are turned off for ConPaws, or unsupported here. */
  | "live-activities-disabled"
  /** No native support in this build or on this platform. */
  | "unavailable"
  | "failed";

export interface TrackedEventPresentation {
  /** A Live Activity or ongoing notification for a tracked event is visible. */
  showing: boolean;
  /**
   * The user pressed Stop, or dismissed it, outside the app since this was
   * last read. Reading consumes it.
   */
  stoppedByUser: boolean;
}

export type TrackedEventStartResult =
  | { status: "started" }
  | { status: "notifications-denied" }
  | { status: "live-activities-disabled" }
  | { status: "not-trackable"; reason: TrackedEventBlocker }
  | { status: "unavailable" }
  | { status: "failed" };

/** Passed to subscribers so the UI can tell a deliberate stop from a cleanup. */
export type TrackedEventChange =
  /** The stored selection finished loading; nothing was started or stopped. */
  | { kind: "loaded" }
  | { kind: "started" }
  | { kind: "stopped-by-user" }
  | { kind: "ended"; reason: TrackedEventStopReason };
