export type OnboardingDestination =
  | "/convention/find"
  | "/convention/new/import"
  | "/(tabs)/(home)";

export interface OnboardingExit {
  method: "dismissTo" | "replace";
  href: OnboardingDestination | "/(tabs)/settings/getting-started";
  markComplete: boolean;
}

/**
 * How the last onboarding screen leaves for the place the user picked.
 *
 * First run: onboarding is all the root stack holds, so it is replaced by the
 * tabs and the flag is set.
 *
 * Replay (Settings > Getting started): onboarding was pushed over tabs that
 * are still mounted. A replace would add a second tab navigator on top of
 * them, and Back from the new screen would slide to the old tab bar instead of
 * leaving the app. `dismissTo` pops the root stack back to the existing tabs
 * and opens the destination inside them, so Find and Import land on the Home
 * stack. Exploring returns to Getting started, where the replay began.
 */
export function onboardingExit(
  replay: string | undefined,
  destination: OnboardingDestination,
): OnboardingExit {
  if (replay === "1") {
    return {
      method: "dismissTo",
      href:
        destination === "/(tabs)/(home)"
          ? "/(tabs)/settings/getting-started"
          : destination,
      markComplete: false,
    };
  }
  return { method: "replace", href: destination, markComplete: true };
}
