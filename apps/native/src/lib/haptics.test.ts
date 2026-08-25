import { describe, expect, it } from "vitest";
import { parseHapticsPreference, serializeHapticsPreference } from "./haptics";

describe("haptics preference", () => {
  it("defaults to on when nothing is stored", () => {
    expect(parseHapticsPreference(null)).toBe(true);
  });

  it("only an explicit opt-out turns haptics off", () => {
    expect(parseHapticsPreference("off")).toBe(false);
    expect(parseHapticsPreference("on")).toBe(true);
    // A value written by some future version must not silently disable haptics.
    expect(parseHapticsPreference("something-else")).toBe(true);
  });

  it("round-trips through storage", () => {
    for (const enabled of [true, false]) {
      expect(parseHapticsPreference(serializeHapticsPreference(enabled))).toBe(
        enabled,
      );
    }
  });
});
