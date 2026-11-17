import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCalendars } from "expo-localization";
import { useSyncExternalStore } from "react";

export type TimeFormatPreference = "system" | "12" | "24";
const STORAGE_KEY = "timeFormat";
let preference: TimeFormatPreference = "system";
const listeners = new Set<() => void>();

export function getTimeFormatPreference(): TimeFormatPreference {
  return preference;
}

export function subscribeTimeFormat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyPreference(next: TimeFormatPreference): void {
  if (next === preference) return;
  preference = next;
  for (const listener of listeners) listener();
}

export async function loadTimeFormatPreference(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  applyPreference(stored === "12" || stored === "24" ? stored : "system");
}

export async function saveTimeFormatPreference(
  next: TimeFormatPreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, next);
  applyPreference(next);
}

export function resolveHour12(
  preference: TimeFormatPreference,
  uses24hourClock: boolean | null | undefined,
): boolean | undefined {
  if (preference !== "system") return preference === "12";
  return uses24hourClock == null ? undefined : !uses24hourClock;
}

export function useHour12(): boolean | undefined {
  const preference = useSyncExternalStore(
    subscribeTimeFormat,
    getTimeFormatPreference,
    getTimeFormatPreference,
  );
  return resolveHour12(preference, useCalendars()[0]?.uses24hourClock);
}
