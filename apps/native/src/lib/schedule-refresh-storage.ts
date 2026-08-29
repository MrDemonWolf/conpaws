import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bookkeeping for re-checking an imported feed.
 *
 * All of it lives in AsyncStorage rather than the database on purpose. None of
 * it is the user's data — it is this device's memory of when it last looked at
 * a URL. A column on `conventions` would ride along in backup export
 * (`data-export.ts` serialises whole rows) and restore a stale "checked at"
 * onto a new phone, which is worse than having no record at all.
 */

/** Whether the app may re-check a feed without being asked. */
export const SCHEDULE_AUTO_CHECK_STORAGE_KEY = "scheduleAutoCheckEnabled";

/**
 * How long a check is good for.
 *
 * Thirty minutes is not a new number: it is already this product's definition
 * of a stale schedule, on the Watch (`WatchScheduleStore.swift`). Reusing it
 * keeps the two surfaces from disagreeing about what "recent" means.
 */
export const SCHEDULE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let cachedAutoCheck: boolean | undefined;

export async function getScheduleAutoCheck(): Promise<boolean> {
  if (cachedAutoCheck !== undefined) return cachedAutoCheck;
  const stored = await AsyncStorage.getItem(
    SCHEDULE_AUTO_CHECK_STORAGE_KEY,
  ).catch(() => null);
  // Absent means on. The feature is the reason someone imported by link.
  cachedAutoCheck = stored === null ? true : stored === "true";
  return cachedAutoCheck;
}

/** For first render, once `getScheduleAutoCheck` has primed the cache. */
export function getCachedScheduleAutoCheck(): boolean {
  return cachedAutoCheck ?? true;
}

export async function setScheduleAutoCheck(enabled: boolean): Promise<void> {
  cachedAutoCheck = enabled;
  await AsyncStorage.setItem(
    SCHEDULE_AUTO_CHECK_STORAGE_KEY,
    String(enabled),
  ).catch(() => undefined);
}

function checkedAtKey(conventionId: string): string {
  return `scheduleCheckedAt:${conventionId}`;
}

function allCategoriesKey(conventionId: string): string {
  return `scheduleAllCategories:${conventionId}`;
}

export async function getScheduleCheckedAt(
  conventionId: string,
): Promise<number | null> {
  const stored = await AsyncStorage.getItem(checkedAtKey(conventionId)).catch(
    () => null,
  );
  const parsed = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setScheduleCheckedAt(
  conventionId: string,
  checkedAt: number,
): Promise<void> {
  await AsyncStorage.setItem(
    checkedAtKey(conventionId),
    String(checkedAt),
  ).catch(() => undefined);
}

/**
 * Whether the last import of this convention took every category the feed
 * offered.
 *
 * The import screen's category checkboxes are screen state and are gone the
 * moment it unmounts, so an unattended re-check has no way to honour a
 * selection — it would quietly reinstate the categories the user removed. When
 * this is false the convention simply never auto-applies, which is an invisible
 * and honest degradation.
 *
 * ponytail: a boolean, not the selection itself. Persisting the actual set is
 * the upgrade path, and it is what would let auto-apply work for everyone and
 * let the notice report added events.
 */
export async function getScheduleAllCategories(
  conventionId: string,
): Promise<boolean> {
  const stored = await AsyncStorage.getItem(
    allCategoriesKey(conventionId),
  ).catch(() => null);
  // Absent means a convention imported before this was recorded. Treated as
  // filtered, so an older import is never silently widened.
  return stored === "true";
}

export async function setScheduleAllCategories(
  conventionId: string,
  allCategories: boolean,
): Promise<void> {
  await AsyncStorage.setItem(
    allCategoriesKey(conventionId),
    String(allCategories),
  ).catch(() => undefined);
}

/** Drops a convention's bookkeeping. Called when the convention is deleted. */
export async function clearScheduleRefreshState(
  conventionId: string,
): Promise<void> {
  await AsyncStorage.multiRemove([
    checkedAtKey(conventionId),
    allCategoriesKey(conventionId),
  ]).catch(() => undefined);
}
