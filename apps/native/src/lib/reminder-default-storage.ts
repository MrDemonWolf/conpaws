import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_STORAGE_KEY } from "./onboarding-storage";

/** The suggested lead time for a newly enabled reminder; saving an event stays separate. */
export const REMINDER_DEFAULT_STORAGE_KEY = "reminderDefaultMinutes";

/** The options Settings offers, matching the sheet's picker. */
export const REMINDER_DEFAULT_OPTIONS = [0, 5, 10, 15, 30, 60] as const;

let cachedDefault: number | null | undefined;

export async function getDefaultReminderMinutes(): Promise<number | null> {
  if (cachedDefault !== undefined) return cachedDefault;
  try {
    const stored = await AsyncStorage.getItem(REMINDER_DEFAULT_STORAGE_KEY);
    if (stored === null) {
      // Old versions removed the key for None, so preserve that on existing installs.
      const existing = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      await setDefaultReminderMinutes(existing === "true" ? null : 15);
    } else {
      const parsed =
        stored === "none" || stored.trim() === "" ? Number.NaN : Number(stored);
      cachedDefault = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    }
  } catch {
    return null;
  }
  return cachedDefault ?? null;
}

export function getCachedDefaultReminderMinutes(): number | null {
  return cachedDefault ?? null;
}

export async function setDefaultReminderMinutes(
  minutes: number | null,
): Promise<void> {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0)) {
    throw new RangeError("Invalid reminder lead time");
  }
  await AsyncStorage.setItem(
    REMINDER_DEFAULT_STORAGE_KEY,
    minutes === null ? "none" : String(minutes),
  );
  cachedDefault = minutes;
}
