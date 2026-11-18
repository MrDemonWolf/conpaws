import type {
  TrackedEventPresentation,
  TrackedEventPresenterStart,
  TrackedEventProps,
} from "@/lib/tracked-event.types";

// Non-native tooling and platforms without a Live Activity or ongoing
// notification: nothing is ever shown, so tracking never starts.

export function isTrackedEventSupported(): boolean {
  return false;
}

export async function presentTrackedEvent(
  _props: TrackedEventProps,
): Promise<TrackedEventPresenterStart> {
  return "unavailable";
}

export async function updateTrackedEvent(
  _props: TrackedEventProps,
): Promise<boolean> {
  return false;
}

export async function restoreTrackedEvent(
  _props: TrackedEventProps,
): Promise<boolean> {
  return false;
}

export async function dismissTrackedEvent(): Promise<void> {}

export async function readTrackedEventPresentation(): Promise<TrackedEventPresentation> {
  return { showing: false, stoppedByUser: false };
}

export function subscribeTrackedEventStop(_listener: () => void): () => void {
  return () => {};
}
