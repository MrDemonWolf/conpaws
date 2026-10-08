import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALL_DAYS,
  clearBrowseFilters,
  getBrowseState,
  resetBrowseState,
  setBrowseState,
  subscribeBrowseState,
} from "./schedule-browse-store";

afterEach(() => {
  resetBrowseState("a");
  resetBrowseState("b");
});

describe("schedule browse store", () => {
  it("starts unresolved and keeps conventions apart", () => {
    expect(getBrowseState("a")).toEqual({
      dayKey: null,
      slotStartMs: null,
      category: null,
      notice: null,
    });
    setBrowseState("a", { dayKey: "2026-09-19", category: "Art" });
    expect(getBrowseState("b").category).toBeNull();
    expect(getBrowseState("a").category).toBe("Art");
  });

  it("notifies listeners once per real change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBrowseState(listener);
    setBrowseState("a", { dayKey: ALL_DAYS });
    setBrowseState("a", { dayKey: ALL_DAYS });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setBrowseState("a", { dayKey: "2026-09-19" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears the category but keeps the day and hour", () => {
    setBrowseState("a", {
      dayKey: "2026-09-19",
      slotStartMs: 1,
      category: "Art",
    });
    clearBrowseFilters("a");
    expect(getBrowseState("a")).toMatchObject({
      dayKey: "2026-09-19",
      slotStartMs: 1,
      category: null,
    });
  });
});
