import type { Href } from "expo-router";

/**
 * Every route a Home Screen quick action is allowed to open, keyed by the path
 * the native side sends.
 *
 * The paths are authored as plain Swift strings in
 * `modules/conpaws-widgets/ios/ConPawsQuickActionsSubscriber.swift`, so nothing
 * in that file changes when a route is renamed, and pushing the string straight
 * through erased its type along with any chance of catching the drift. Naming
 * the same paths here as `Href` values puts them back under typed routes: a
 * rename now fails `bun check-types` instead of leaving a shortcut that
 * silently opens nothing on a user's phone.
 */
const QUICK_ACTION_ROUTES: Record<string, Href> = {
  "/schedule": "/schedule",
  "/convention/create": "/convention/create",
  // `new` is the sentinel the import screen reads for "no convention yet", so
  // this is a real route rather than a lookup that happens to miss.
  "/convention/new/import": "/convention/new/import",
};

/**
 * The typed route for a parked quick action, or null when the native side sent
 * a path this build has no screen for.
 */
export function resolveQuickActionRoute(route: string | null): Href | null {
  if (!route) return null;
  return QUICK_ACTION_ROUTES[route] ?? null;
}
