import { requireOptionalNativeModule } from "expo";
import { addUserInteractionListener, type LiveActivity } from "expo-widgets";
import { Platform } from "react-native";
import {
  TRACKED_EVENT_STOP_TARGET,
  type TrackedEventPresentation,
  type TrackedEventPresenterStart,
  type TrackedEventProps,
} from "@/lib/tracked-event.types";
import TrackedEventActivity from "@/widgets/TrackedEventActivity";

interface NativeTrackedEventModule {
  consumePendingTrackedEventStop?(): boolean;
}

const nativeModule =
  requireOptionalNativeModule<NativeTrackedEventModule>("ConPawsWidgets");

/**
 * When the system should redraw the activity without the app.
 *
 * Before the start that is the start itself, which is what flips "Starts in"
 * to "Ends in" with the app closed; after it, the cleanup time, when the
 * layout can show the event as over.
 */
function staleDate(props: TrackedEventProps): Date {
  return new Date(
    Date.now() < props.startAtMs ? props.startAtMs : props.cleanupAtMs,
  );
}

function instances(): LiveActivity<TrackedEventProps>[] {
  return TrackedEventActivity.getInstances();
}

async function endAll(
  activities: readonly LiveActivity<TrackedEventProps>[],
): Promise<void> {
  // One activity that already went away must not keep the rest on screen.
  await Promise.all(
    activities.map((activity) =>
      activity.end("immediate").catch(() => undefined),
    ),
  );
}

/**
 * The app installs on iOS 16.4, but the extension that draws the activity and
 * runs its Stop button needs iOS 17. Below that a start would succeed with
 * nothing on screen, so tracking is not offered at all.
 */
export function isTrackedEventSupported(): boolean {
  return Number.parseInt(String(Platform.Version), 10) >= 17;
}

/**
 * Starts the new activity before ending the old ones, so a refused start (Live
 * Activities turned off, the system limit reached) leaves the event the user
 * was already tracking on screen instead of nothing.
 */
export async function presentTrackedEvent(
  props: TrackedEventProps,
): Promise<TrackedEventPresenterStart> {
  if (!isTrackedEventSupported()) return "unavailable";
  let previous: LiveActivity<TrackedEventProps>[];
  let started: LiveActivity<TrackedEventProps>;
  try {
    previous = instances();
    // A Stop pressed on the last activity belongs to that activity. Left
    // unread, it would end this one the first time the app reconciles.
    nativeModule?.consumePendingTrackedEventStop?.();
    started = TrackedEventActivity.start(props, props.url, staleDate(props));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return /not supported/i.test(message)
      ? "live-activities-disabled"
      : "failed";
  }
  const startedId = started.getId();
  await endAll(previous.filter((activity) => activity.getId() !== startedId));
  return "started";
}

export async function updateTrackedEvent(
  props: TrackedEventProps,
): Promise<boolean> {
  const [current, ...extra] = instances();
  if (!current) return false;
  // Only one event is ever tracked; anything else is left over from a start
  // that was interrupted part way.
  await endAll(extra);
  await current.update(props, staleDate(props));
  return true;
}

/**
 * A missing activity cannot be told apart from one the user swiped away, so
 * it is never restarted: the app must not bring back what the user removed.
 */
export async function restoreTrackedEvent(
  _props: TrackedEventProps,
): Promise<boolean> {
  return false;
}

export async function dismissTrackedEvent(): Promise<void> {
  await endAll(instances());
}

export async function readTrackedEventPresentation(): Promise<TrackedEventPresentation> {
  return {
    showing: instances().length > 0,
    stoppedByUser: nativeModule?.consumePendingTrackedEventStop?.() === true,
  };
}

export function subscribeTrackedEventStop(listener: () => void): () => void {
  const subscription = addUserInteractionListener((event) => {
    if (event.target === TRACKED_EVENT_STOP_TARGET) listener();
  });
  return () => subscription.remove();
}
