import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type OnboardingDestination, onboardingExit } from "./onboarding-exit";

const getStartedSource = readFileSync(
  path.resolve(__dirname, "../../app/(onboarding)/get-started.tsx"),
  "utf8",
);

describe("onboarding exits", () => {
  // First run: onboarding is all the root stack holds, so the exit replaces
  // it with the tabs and remembers that onboarding is done.
  it.each<OnboardingDestination>([
    "/convention/find",
    "/convention/new/import",
    "/(tabs)/(home)",
  ])("replaces first-run onboarding with %s", (destination) => {
    expect(onboardingExit(undefined, destination)).toEqual({
      method: "replace",
      href: destination,
      markComplete: true,
    });
  });

  // Replay is pushed over tabs that are already mounted. Replacing it put a
  // second tab navigator on the root stack, so Back from the new Find or
  // Import screen slid to the old tab bar on Settings instead of leaving the
  // app. Every replay exit must pop back to the existing tabs.
  it.each<OnboardingDestination>([
    "/convention/find",
    "/convention/new/import",
  ])(
    "pops a replay back to the existing tabs before opening %s",
    (destination) => {
      expect(onboardingExit("1", destination)).toEqual({
        method: "dismissTo",
        href: destination,
        markComplete: false,
      });
    },
  );

  it("returns a replay explored to the end to where it started", () => {
    expect(onboardingExit("1", "/(tabs)/(home)")).toEqual({
      method: "dismissTo",
      href: "/(tabs)/settings/getting-started",
      markComplete: false,
    });
  });

  it("never replaces a replay, whichever button ends it", () => {
    for (const destination of [
      "/convention/find",
      "/convention/new/import",
      "/(tabs)/(home)",
    ] as const) {
      expect(onboardingExit("1", destination).method).toBe("dismissTo");
    }
  });

  it("is the decision the Get started screen follows", () => {
    expect(getStartedSource).toContain("onboardingExit(replay, destination)");
    expect(getStartedSource).not.toContain("router.replace(destination)");
  });
});
