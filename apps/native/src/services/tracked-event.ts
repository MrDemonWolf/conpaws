import Constants from "expo-constants";
import { getCalendars } from "expo-localization";
import * as conventionsRepo from "@/db/repositories/conventions";
import * as eventsRepo from "@/db/repositories/events";
import { getTimeFormatPreference, resolveHour12 } from "@/lib/device-clock";
import { reportError } from "@/lib/error-reporting";
import i18n from "@/lib/i18n";
import {
  planTrackedEvent,
  type TrackedEventContext,
  trackedEventBlocker,
} from "@/lib/tracked-event";
import type {
  TrackedEventChange,
  TrackedEventPresenterStart,
  TrackedEventProps,
  TrackedEventSelection,
  TrackedEventStartResult,
  TrackedEventStopReason,
} from "@/lib/tracked-event.types";
import { buildTrackedEventLabels } from "@/lib/tracked-event-labels";
import {
  clearTrackedEventSelection,
  getCachedTrackedEventSelection,
  loadTrackedEventSelection,
  saveTrackedEventSelection,
} from "@/lib/tracked-event-storage";
import {
  dismissTrackedEvent,
  isTrackedEventSupported,
  presentTrackedEvent,
  readTrackedEventPresentation,
  restoreTrackedEvent,
  subscribeTrackedEventStop,
  updateTrackedEvent,
} from "./tracked-event-presenter";

type Listener = (
  selection: TrackedEventSelection | null,
  change: TrackedEventChange,
) => void;

const listeners = new Set<Listener>();

/** What was last handed to the presenter, serialized, so an unchanged
 * reconcile does not redraw the Lock Screen on every widget publish. */
let lastSentProps: string | null = null;

/**
 * The props carry no clock, but what the presenter does with them changes
 * once the event starts: iOS moves the activity's stale date from the start
 * to the cleanup time, which is the only thing that lets it show the event as
 * over with the app closed. Crossing the start therefore counts as a change.
 */
function presentationKey(props: TrackedEventProps, nowMs: number): string {
  return JSON.stringify([props, nowMs >= props.startAtMs]);
}

let loading: Promise<unknown> | null = null;

/**
 * Every operation waits for the stored selection first. Reconciling before it
 * loads would read "nothing tracked" and end a presentation the user wanted.
 */
function ensureLoaded(): Promise<unknown> {
  // Screens that mounted before the read finished saw "nothing tracked", and
  // nothing else would tell them otherwise: a reconcile that keeps tracking
  // is silent.
  loading ??= loadTrackedEventSelection().then((selection) => {
    if (selection) notify(selection, { kind: "loaded" });
    return selection;
  });
  return loading;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * One operation at a time. A start racing a reconcile could otherwise read the
 * old selection, see the new presentation, and end it as an orphan.
 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    await ensureLoaded();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

function trackedEventContext(): TrackedEventContext {
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  return {
    locale,
    hour12: resolveHour12(
      getTimeFormatPreference(),
      getCalendars()[0]?.uses24hourClock,
    ),
    fallbackTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    labels: buildTrackedEventLabels((key) => i18n.t(key, { lng: locale })),
    appScheme:
      Constants.expoConfig?.extra?.appVariant === "development"
        ? "conpaws-dev"
        : "conpaws",
  };
}

function notify(
  selection: TrackedEventSelection | null,
  change: TrackedEventChange,
): void {
  for (const listener of listeners) {
    try {
      listener(selection, change);
    } catch (error) {
      reportError(error, { scope: "tracked-event.listener" });
    }
  }
}

/**
 * Ends what is shown and forgets the selection. A failure in either step is
 * reported rather than thrown: the other step still has to happen, and a
 * leftover on either side is cleaned up by the next reconcile.
 */
async function endTracking(): Promise<void> {
  lastSentProps = null;
  try {
    await dismissTrackedEvent();
  } catch (error) {
    reportError(error, { scope: "tracked-event.dismiss" });
  }
  try {
    await clearTrackedEventSelection();
  } catch (error) {
    reportError(error, { scope: "tracked-event.clear" });
  }
}

async function plan(selection: TrackedEventSelection) {
  const [event, convention] = await Promise.all([
    eventsRepo.getById(selection.eventId),
    conventionsRepo.getById(selection.conventionId),
  ]);
  return planTrackedEvent(event, convention, Date.now(), trackedEventContext());
}

/** Loads the selection and listens for Stop pressed outside the app. */
export function initTrackedEvent(): () => void {
  ensureLoaded().catch((error) =>
    reportError(error, { scope: "tracked-event.load" }),
  );
  return subscribeTrackedEventStop(() => {
    reconcileTrackedEvent().catch((error) =>
      reportError(error, { scope: "tracked-event.reconcile" }),
    );
  });
}

/** False where the platform cannot show, or reliably end, a tracked event. */
export function isTrackingSupported(): boolean {
  return isTrackedEventSupported();
}

/** Null until the stored selection has loaded. */
export function getTrackedEventSelection(): TrackedEventSelection | null {
  return getCachedTrackedEventSelection();
}

export function subscribeTrackedEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startTrackingEvent(
  eventId: string,
  conventionId: string,
): Promise<TrackedEventStartResult> {
  return enqueue(async () => {
    const [event, convention] = await Promise.all([
      eventsRepo.getById(eventId),
      conventionsRepo.getById(conventionId),
    ]);
    const nowMs = Date.now();
    const blocker = trackedEventBlocker(event, convention, nowMs);
    if (blocker) return { status: "not-trackable", reason: blocker };
    const planned = planTrackedEvent(
      event,
      convention,
      nowMs,
      trackedEventContext(),
    );
    if (planned.kind === "stop")
      return { status: "not-trackable", reason: planned.reason };

    const previous = getCachedTrackedEventSelection();
    let started: TrackedEventPresenterStart;
    try {
      started = await presentTrackedEvent(planned.props);
    } catch (error) {
      reportError(error, { scope: "tracked-event.present" });
      started = "failed";
    }
    if (started !== "started") {
      // The presenter keeps what was showing when it cannot start the new
      // one, but that is not guaranteed on every platform, so the previous
      // selection is checked against what is actually on screen.
      if (previous) {
        await runReconcile().catch((error) =>
          reportError(error, { scope: "tracked-event.reconcile" }),
        );
      }
      return { status: started };
    }

    const selection: TrackedEventSelection = {
      eventId,
      conventionId,
      startedAtMs: nowMs,
    };
    try {
      await saveTrackedEventSelection(selection);
    } catch (error) {
      // Without a stored selection the next launch would end it as an orphan
      // anyway; ending it now keeps the app from claiming what it cannot keep.
      reportError(error, { scope: "tracked-event.save" });
      await endTracking();
      if (previous) notify(null, { kind: "stopped-by-user" });
      return { status: "failed" };
    }
    lastSentProps = presentationKey(planned.props, Date.now());
    notify(selection, { kind: "started" });
    return { status: "started" };
  });
}

/** The user pressed Stop in the app. */
export function stopTrackingEvent(): Promise<void> {
  return enqueue(async () => {
    const current = getCachedTrackedEventSelection();
    await endTracking();
    if (current) notify(null, { kind: "stopped-by-user" });
  });
}

/**
 * Called by the code that unsaves, deletes or archives, so tracking ends at
 * the same moment instead of on the next reconcile.
 */
export function stopTrackingIfAffected(
  target: { eventIds?: readonly string[]; conventionId?: string },
  reason: TrackedEventStopReason,
): Promise<void> {
  return enqueue(async () => {
    const current = getCachedTrackedEventSelection();
    if (!current) return;
    const affected =
      target.eventIds?.includes(current.eventId) === true ||
      (target.conventionId !== undefined &&
        target.conventionId === current.conventionId);
    if (!affected) return;
    await endTracking();
    notify(null, { kind: "ended", reason });
  });
}

async function runReconcile(): Promise<void> {
  const selection = getCachedTrackedEventSelection();
  const presentation = await readTrackedEventPresentation();

  if (!selection) {
    // Left over from a selection that was cleared while the dismissal failed,
    // or from storage that could not be read.
    if (presentation.showing) await endTracking();
    lastSentProps = null;
    return;
  }

  if (presentation.stoppedByUser) {
    await endTracking();
    notify(null, { kind: "stopped-by-user" });
    return;
  }

  const planned = await plan(selection);
  if (planned.kind === "stop") {
    await endTracking();
    notify(null, { kind: "ended", reason: planned.reason });
    return;
  }

  const serialized = presentationKey(planned.props, Date.now());
  if (!presentation.showing) {
    // Android brings back a notification a reboot took away; iOS cannot tell
    // a lost activity from one the user swiped away, so it lets it go.
    if (await restoreTrackedEvent(planned.props)) {
      lastSentProps = serialized;
      return;
    }
    await endTracking();
    notify(null, { kind: "stopped-by-user" });
    return;
  }

  if (serialized === lastSentProps) return;
  if (await updateTrackedEvent(planned.props)) lastSentProps = serialized;
}

let waiting: Promise<void> | null = null;

/**
 * Serialized with every other operation, and coalesced: calls that arrive
 * before a queued run has started share it, and a call that arrives during a
 * run gets one follow-up that reads the database after that run.
 */
export function reconcileTrackedEvent(): Promise<void> {
  if (waiting) return waiting;
  const run = enqueue(async () => {
    waiting = null;
    await runReconcile();
  });
  waiting = run;
  return run;
}
