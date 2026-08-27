import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The flag that decides whether the app opens on onboarding or on the tabs.
 *
 * Named here rather than typed out at each call site, the way the appearance
 * and haptics preferences already are: a typo in one of the four places this
 * key is touched would report success and change nothing, with no compiler or
 * test to catch it.
 */
export const ONBOARDING_STORAGE_KEY = "hasCompletedOnboarding";

export async function hasCompletedOnboarding(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  return stored === "true";
}

/** Never rejects: failing to remember this is not worth blocking the app on. */
export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true").catch(
    () => undefined,
  );
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
}
