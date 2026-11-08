import { describe, expect, it, vi } from "vitest";
import { previewIndexForKey } from "./app-preview";
import { startPreviewRotation } from "./app-preview-playback";

describe("app preview keyboard selection", () => {
  it("wraps arrow navigation and keeps ordinary keys available to the browser", () => {
    expect(previewIndexForKey(0, 3, "ArrowLeft")).toBe(2);
    expect(previewIndexForKey(2, 3, "ArrowRight")).toBe(0);
    expect(previewIndexForKey(1, 3, "Home")).toBe(0);
    expect(previewIndexForKey(1, 3, "End")).toBe(2);
    expect(previewIndexForKey(1, 3, "Tab")).toBeNull();
    expect(previewIndexForKey(0, 0, "ArrowRight")).toBeNull();
  });
});

describe("appearance preview playback", () => {
  it("changes at 12 seconds, stops for reduced motion and cleans up on pause", () => {
    vi.useFakeTimers();
    let change = () => {};
    const motion = {
      matches: false,
      addEventListener: (_: string, callback: () => void) => {
        change = callback;
      },
      removeEventListener: vi.fn(),
    };
    const tick = vi.fn();
    const reset = vi.fn();
    const stop = startPreviewRotation(
      motion as unknown as MediaQueryList,
      tick,
      reset,
    );
    try {
      vi.advanceTimersByTime(11_999);
      expect(tick).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(tick).toHaveBeenCalledTimes(1);
      motion.matches = true;
      change();
      vi.advanceTimersByTime(24_000);
      expect(tick).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalledOnce();
      motion.matches = false;
      change();
      stop();
      vi.advanceTimersByTime(24_000);
      expect(tick).toHaveBeenCalledTimes(1);
      expect(motion.removeEventListener).toHaveBeenCalledWith("change", change);
    } finally {
      stop();
      vi.useRealTimers();
    }
  });
});
