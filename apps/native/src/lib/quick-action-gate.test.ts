import { describe, expect, it } from "vitest";
import { canOpenQuickAction } from "./quick-action-gate";

describe("cold shortcut handoff", () => {
  it("waits for the index redirect to commit a tab route", () => {
    const routeChanges = [undefined, "index", "(tabs)"];

    expect(
      routeChanges.map((segment) => canOpenQuickAction(true, true, segment)),
    ).toEqual([false, false, true]);
  });

  it("keeps actions parked while onboarding or bootstrap is incomplete", () => {
    expect(canOpenQuickAction(false, true, "(tabs)")).toBe(false);
    expect(canOpenQuickAction(true, false, "(tabs)")).toBe(false);
    expect(canOpenQuickAction(true, true, "onboarding")).toBe(false);
  });
});
