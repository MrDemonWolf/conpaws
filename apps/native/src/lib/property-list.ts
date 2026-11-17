/**
 * Drops `null` and `undefined` fields, at any depth.
 *
 * expo-widgets keeps an iOS widget's timeline in App Group `UserDefaults`,
 * which stores property lists. A property list has no null: one `null` field
 * anywhere makes iOS refuse the whole timeline, and the widget is left showing
 * its empty first-run state however much the app publishes. Readers on the
 * other side have to treat a missing field as they would a null one.
 */
export function withoutNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map(withoutNulls) as T;
  }
  if (value instanceof Date || typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined)
      .map(([key, item]) => [key, withoutNulls(item)]),
  ) as T;
}
