import { type EventSubscription, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import type {
  TrackedEventPresentation,
  TrackedEventPresenterStart,
  TrackedEventProps,
} from "@/lib/tracked-event.types";
import { requestNotificationPermission } from "./notifications";

/** The notification's fields, already formatted; Kotlin only lays them out. */
interface NativeTrackedEventInput {
  eventId: string;
  conventionId: string;
  title: string;
  text: string;
  subText: string;
  startAtMs: number;
  cleanupAtMs: number;
  stopLabel: string;
  channelName: string;
  channelDescription: string;
}

interface NativeTrackedEventModule {
  addListener?(
    eventName: "onTrackedEventStop",
    listener: () => void,
  ): EventSubscription;
  presentTrackedEvent?(input: NativeTrackedEventInput): Promise<string>;
  updateTrackedEvent?(input: NativeTrackedEventInput): Promise<boolean>;
  restoreTrackedEvent?(input: NativeTrackedEventInput): Promise<boolean>;
  dismissTrackedEvent?(): Promise<boolean>;
  readTrackedEventPresentation?(): Promise<{
    showing?: unknown;
    stoppedByUser?: unknown;
  }>;
}

// The same module object the widget snapshot publishes through; an older
// build without the tracked-event functions reads as unavailable.
const nativeModule =
  requireOptionalNativeModule<NativeTrackedEventModule>("ConPawsWidgets");

function nativeInput(props: TrackedEventProps): NativeTrackedEventInput {
  return {
    eventId: props.eventId,
    conventionId: props.conventionId,
    title: props.title,
    text: props.place ? `${props.timeLabel} · ${props.place}` : props.timeLabel,
    subText: props.conventionName,
    startAtMs: props.startAtMs,
    cleanupAtMs: props.cleanupAtMs,
    stopLabel: props.labels.stop,
    channelName: props.labels.channelName,
    channelDescription: props.labels.channelDescription,
  };
}

/**
 * Android 8 is the first version that can remove a notification at a set
 * time. Before it an ongoing notification would outlive its event until the
 * app next ran, so tracking is not offered there.
 */
export function isTrackedEventSupported(): boolean {
  return !!nativeModule?.presentTrackedEvent && Number(Platform.Version) >= 26;
}

export async function presentTrackedEvent(
  props: TrackedEventProps,
): Promise<TrackedEventPresenterStart> {
  if (!isTrackedEventSupported() || !nativeModule?.presentTrackedEvent)
    return "unavailable";
  // Asking here, at the moment the user chose to track something, is when the
  // prompt makes sense; it returns at once when permission is already granted.
  if ((await requestNotificationPermission()) !== "granted")
    return "notifications-denied";
  try {
    const result = await nativeModule.presentTrackedEvent(nativeInput(props));
    return result === "started" || result === "notifications-denied"
      ? result
      : "failed";
  } catch {
    return "failed";
  }
}

export async function updateTrackedEvent(
  props: TrackedEventProps,
): Promise<boolean> {
  if (!nativeModule?.updateTrackedEvent) return false;
  return (await nativeModule.updateTrackedEvent(nativeInput(props))) === true;
}

/**
 * Re-posts a notification that a reboot, force-stop or app update took away.
 * Native code keeps it gone when the user dismissed it or turned
 * notifications off.
 */
export async function restoreTrackedEvent(
  props: TrackedEventProps,
): Promise<boolean> {
  if (!nativeModule?.restoreTrackedEvent) return false;
  return (await nativeModule.restoreTrackedEvent(nativeInput(props))) === true;
}

export async function dismissTrackedEvent(): Promise<void> {
  await nativeModule?.dismissTrackedEvent?.();
}

export async function readTrackedEventPresentation(): Promise<TrackedEventPresentation> {
  const presentation = await nativeModule?.readTrackedEventPresentation?.();
  return {
    showing: presentation?.showing === true,
    stoppedByUser: presentation?.stoppedByUser === true,
  };
}

export function subscribeTrackedEventStop(listener: () => void): () => void {
  if (!nativeModule?.addListener) return () => {};
  const subscription = nativeModule.addListener("onTrackedEventStop", () =>
    listener(),
  );
  return () => subscription.remove();
}
