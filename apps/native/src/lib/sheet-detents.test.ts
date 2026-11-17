import { describe, expect, it } from "vitest";
import { peekDetent } from "./sheet-detents";

const EVENT = { phoneFraction: 0.7, targetPt: 670 };
const COMPARE = { phoneFraction: 0.75, targetPt: 720 };

describe("peekDetent", () => {
  it("returns the phone fraction exactly for any narrow window", () => {
    for (const width of [320, 375, 393, 430, 480, 599]) {
      for (const height of [568, 844, 956, 1040, 1194]) {
        expect(peekDetent({ width, height, topInset: 59, ...EVENT })).toBe(0.7);
        expect(peekDetent({ width, height, topInset: 59, ...COMPARE })).toBe(
          0.75,
        );
      }
    }
  });

  it.each([
    ["iPhone 17e", 844, 390, 0],
    ["iPhone 17 Pro Max", 956, 440, 0],
    ["Pixel 10a", 915, 412, 24],
  ])(
    "keeps the phone fraction in landscape through the clamp (%s)",
    (_name, width, height, topInset) => {
      expect(peekDetent({ width, height, topInset, ...EVENT })).toBe(0.7);
      expect(peekDetent({ width, height, topInset, ...COMPARE })).toBe(0.75);
    },
  );

  it("aims for a height in points on an iPad", () => {
    // iPad Pro 11-inch in portrait: 1210 tall with a 24pt status bar.
    expect(
      peekDetent({ width: 834, height: 1210, topInset: 24, ...EVENT }),
    ).toBeCloseTo(670 / 1186, 6);
    expect(
      peekDetent({ width: 834, height: 1210, topInset: 24, ...COMPARE }),
    ).toBeCloseTo(720 / 1186, 6);
  });

  it("never opens shorter than 40% or taller than the phone fraction", () => {
    expect(peekDetent({ width: 1366, height: 4000, ...EVENT })).toBe(0.4);
    expect(peekDetent({ width: 834, height: 700, ...EVENT })).toBe(0.7);
  });

  it("falls back to the phone fraction for a degenerate height", () => {
    expect(peekDetent({ width: 834, height: 20, topInset: 24, ...EVENT })).toBe(
      0.7,
    );
  });
});
