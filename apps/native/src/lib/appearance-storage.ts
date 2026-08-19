import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import {
  type AppearancePreference,
  parseAppearancePreference,
  toNativeColorScheme,
} from "./appearance";

const APPEARANCE_STORAGE_KEY = "appAppearance";
let currentPreference: AppearancePreference = "system";
const listeners = new Set<() => void>();

export function getAppearancePreference(): AppearancePreference {
  return currentPreference;
}

export function subscribeAppearancePreference(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyAppearancePreference(
  preference: AppearancePreference,
): void {
  const changed = preference !== currentPreference;
  currentPreference = preference;
  Appearance.setColorScheme(toNativeColorScheme(preference));
  if (changed) for (const listener of listeners) listener();
}

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  currentPreference = parseAppearancePreference(
    await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
  );
  return currentPreference;
}

export async function saveAppearancePreference(
  preference: AppearancePreference,
): Promise<void> {
  await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  const stored = parseAppearancePreference(
    await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
  );
  if (stored !== preference) {
    throw new Error("Appearance preference was not persisted");
  }
}
