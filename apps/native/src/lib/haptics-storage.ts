import AsyncStorage from "@react-native-async-storage/async-storage";
import { setHapticsEnabled } from "@/services/haptics";
import { parseHapticsPreference, serializeHapticsPreference } from "./haptics";

const HAPTICS_STORAGE_KEY = "appHaptics";

export async function loadHapticsPreference(): Promise<boolean> {
  const enabled = parseHapticsPreference(
    await AsyncStorage.getItem(HAPTICS_STORAGE_KEY),
  );
  setHapticsEnabled(enabled);
  return enabled;
}

export async function saveHapticsPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(
    HAPTICS_STORAGE_KEY,
    serializeHapticsPreference(enabled),
  );
  setHapticsEnabled(enabled);
}
