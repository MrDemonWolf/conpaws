import { afterEach, describe, expect, it, vi } from "vitest";
import { createSectionListJump } from "./section-list-jump";

afterEach(() => vi.useRealTimers());

describe("section list jump recovery", () => {
  it("advances measurement and retries the original section with a bound", () => {
    vi.useFakeTimers();
    const actions = { toLocation: vi.fn(), toOffset: vi.fn() };
    const jump = createSectionListJump(actions);
    const location = { sectionIndex: 4, itemIndex: 12, viewPosition: 0.3 };
    jump.jump(location);
    for (let attempt = 0; attempt < 5; attempt++) {
      jump.onFailure({ index: 150, averageItemLength: 60 });
      vi.advanceTimersByTime(250);
    }
    expect(actions.toOffset).toHaveBeenCalledTimes(3);
    expect(actions.toOffset).toHaveBeenCalledWith(9000);
    expect(actions.toLocation).toHaveBeenCalledTimes(4);
    expect(actions.toLocation).toHaveBeenLastCalledWith(location);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels stale retries on a new target and on unmount", () => {
    vi.useFakeTimers();
    const actions = { toLocation: vi.fn(), toOffset: vi.fn() };
    const jump = createSectionListJump(actions);
    jump.jump({ sectionIndex: 2, itemIndex: 50 });
    jump.onFailure({ index: 100, averageItemLength: 50 });
    const next = { sectionIndex: 0, itemIndex: 1 };
    jump.jump(next);
    vi.advanceTimersByTime(250);
    expect(actions.toLocation).toHaveBeenCalledTimes(2);
    expect(actions.toLocation).toHaveBeenLastCalledWith(next);
    jump.onFailure({ index: 1, averageItemLength: 50 });
    jump.cancel();
    vi.runAllTimers();
    expect(actions.toLocation).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
