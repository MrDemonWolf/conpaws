import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The preferred lead time for new leave reminders, settable in Settings.
 * The reminder picker pre-checks this option for events that have no reminder
 * yet, so the common case is open picker → tap the already-suggested row.
 * `null` (no stored value) keeps the old behavior: "No leave reminder" checked.
 *
 * Values mirror the picker: minutes before the event, 0 = at event time.
 */
export const REMINDER_DEFAULT_STORAGE_KEY = "reminderDefaultMinutes";

/** The options Settings offers, matching the sheet's picker. */
export const REMINDER_DEFAULT_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

let cachedDefault: number | null | undefined;

export async function getDefaultReminderMinutes(): Promise<number | null> {
  if (cachedDefault !== undefined) return cachedDefault;
  const stored = await AsyncStorage.getItem(REMINDER_DEFAULT_STORAGE_KEY).catch(
    () => null,
  );
  const parsed = stored === null ? Number.NaN : Number(stored);
  cachedDefault = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  return cachedDefault;
}

export function getCachedDefaultReminderMinutes(): number | null {
  return cachedDefault ?? null;
}

export async function setDefaultReminderMinutes(
  minutes: number | null,
): Promise<void> {
  cachedDefault = minutes;
  if (minutes === null) {
    await AsyncStorage.removeItem(REMINDER_DEFAULT_STORAGE_KEY).catch(
      () => undefined,
    );
    return;
  }
  await AsyncStorage.setItem(
    REMINDER_DEFAULT_STORAGE_KEY,
    String(minutes),
  ).catch(() => undefined);
}
