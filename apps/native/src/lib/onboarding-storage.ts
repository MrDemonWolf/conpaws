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

/**
 * Last value read from or written to storage, so the route gate can decide
 * synchronously. The launch bootstrap reads the flag before the splash screen
 * hides, which primes this; `app/index.tsx` then redirects on its first render
 * instead of painting a blank frame while it re-reads AsyncStorage. `null`
 * means no read has completed yet (fast refresh, or a bootstrap error path).
 */
let cachedFlag: boolean | null = null;

export function getCachedOnboardingFlag(): boolean | null {
  return cachedFlag;
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
  cachedFlag = stored === "true";
  return cachedFlag;
}

/** Never rejects: failing to remember this is not worth blocking the app on. */
export async function markOnboardingComplete(): Promise<void> {
  cachedFlag = true;
  await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true").catch(
    () => undefined,
  );
}

export async function resetOnboarding(): Promise<void> {
  cachedFlag = false;
  await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
}
