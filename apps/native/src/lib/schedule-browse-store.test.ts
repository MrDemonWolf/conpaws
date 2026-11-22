import { describe, expect, it, vi } from "vitest";
import {
  ALL_DAYS,
  getBrowseState,
  setBrowseState,
  subscribeBrowseState,
} from "./schedule-browse-store";

// The store is module state with no reset, so each test uses its own
// convention ids and cannot see another test's selection.
describe("schedule browse store", () => {
  it("starts unresolved and keeps conventions apart", () => {
    expect(getBrowseState("isolation-a")).toEqual({
      dayKey: null,
      slotStartMs: null,
      category: null,
      notice: null,
    });
    setBrowseState("isolation-a", { dayKey: "2026-09-19", category: "Art" });
    expect(getBrowseState("isolation-b").category).toBeNull();
    expect(getBrowseState("isolation-a").category).toBe("Art");
  });

  it("notifies listeners once per real change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBrowseState(listener);
    setBrowseState("notify", { dayKey: ALL_DAYS });
    setBrowseState("notify", { dayKey: ALL_DAYS });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setBrowseState("notify", { dayKey: "2026-09-19" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
