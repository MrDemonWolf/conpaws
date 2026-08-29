import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether the "tap an event to add it to My Schedule" hint card has been
 * dismissed. Dismissal is permanent and app-wide — the hint teaches one
 * mechanic, and showing it again per convention would nag. The other half of
 * the hint's visibility (hide once anything is starred) needs no storage: the
 * convention screen already holds every event.
 *
 * Same pattern as onboarding-storage: value cached for synchronous reads,
 * writes never reject.
 */
export const SCHEDULE_HINT_STORAGE_KEY = "scheduleHintDismissed";

let cachedDismissed: boolean | null = null;

export async function isScheduleHintDismissed(): Promise<boolean> {
  if (cachedDismissed !== null) return cachedDismissed;
  const stored = await AsyncStorage.getItem(SCHEDULE_HINT_STORAGE_KEY).catch(
    () => null,
  );
  cachedDismissed = stored === "true";
  return cachedDismissed;
}

export async function dismissScheduleHint(): Promise<void> {
  cachedDismissed = true;
  await AsyncStorage.setItem(SCHEDULE_HINT_STORAGE_KEY, "true").catch(
    () => undefined,
  );
}

/** Debug/testing reset. */
export async function resetScheduleHint(): Promise<void> {
  cachedDismissed = null;
  await AsyncStorage.removeItem(SCHEDULE_HINT_STORAGE_KEY).catch(
    () => undefined,
  );
}
