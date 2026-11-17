import { describe, expect, it } from "vitest";
import {
  ABOUT_HERO_MAX,
  ACTIONS_MAX,
  CAP_SCALE_MAX,
  capScale,
  capWidth,
  contentWidth,
  EMPTY_STATE_MAX,
  GUTTER,
  isRoomy,
  ONBOARDING_MAX,
  outerCap,
  PHONE_MAX_WIDTH,
  READABLE_MAX,
  SEGMENTED_MAX,
  scaledCap,
  widthClass,
} from "./content-width";

const CAPS = {
  READABLE_MAX,
  ACTIONS_MAX,
  SEGMENTED_MAX,
  EMPTY_STATE_MAX,
  ONBOARDING_MAX,
};
// iOS Dynamic Type runs from about 0.82 to 3.1 at AX5; Android from 0.85 up.
const FONT_SCALES = [0.8, 0.85, 1, 1.2, CAP_SCALE_MAX, 1.6, 2, 3.1];

function metrics(
  width: number,
  height: number,
  overrides: Partial<{
    fontScale: number;
    safeLeft: number;
    safeRight: number;
  }> = {},
) {
  return {
    width,
    height,
    fontScale: 1,
    safeLeft: 0,
    safeRight: 0,
    ...overrides,
  };
}

describe("phones keep their layout", () => {
  it("adds nothing in portrait at any width or text size", () => {
    for (let width = 320; width <= PHONE_MAX_WIDTH; width += 4) {
      for (const height of [568, 667, 844, 956, 1040]) {
        for (const fontScale of FONT_SCALES) {
          const layout = contentWidth(metrics(width, height, { fontScale }));
          expect(layout.roomy).toBe(false);
          expect(layout.listPadding).toEqual({ paddingHorizontal: 0 });
          expect(layout.rowInset).toEqual({ left: GUTTER, right: GUTTER });
          expect(layout.formSectionMargin).toBeNull();
          expect(layout.formGutter).toBe(0);
          for (const cap of Object.values(CAPS)) {
            expect(capWidth(cap, { width, height, fontScale })).toBeUndefined();
          }
        }
      }
    }
  });

  it.each([
    ["iPhone 17e", 844, 390, 47, 47],
    ["iPhone 17 Pro Max", 956, 440, 62, 62],
    ["Pixel 10a, cutout on the left", 915, 412, 30, 0],
    ["Pixel 10a, three-button bar on the right", 915, 412, 0, 48],
  ])(
    "only respects the safe area in landscape (%s)",
    (_name, width, height, safeLeft, safeRight) => {
      for (const fontScale of FONT_SCALES) {
        const layout = contentWidth(
          metrics(width, height, { fontScale, safeLeft, safeRight }),
        );
        expect(layout.roomy).toBe(false);
        // Wider than 600, so the width class alone would call it expanded.
        expect(layout.widthClass).toBe("expanded");
        expect(layout.listPadding).toEqual({
          paddingHorizontal: Math.max(safeLeft, safeRight),
        });
        expect(layout.rowInset).toEqual({ left: GUTTER, right: GUTTER });
        expect(layout.formSectionMargin).toBeNull();
        expect(layout.formGutter).toBe(0);
        for (const cap of Object.values(CAPS)) {
          expect(capWidth(cap, { width, height, fontScale })).toBeUndefined();
        }
      }
    },
  );

  it("puts a one-sided safe area on both sides, so RTL cannot flip it", () => {
    const layout = contentWidth(metrics(915, 412, { safeRight: 48 }));
    expect(layout.left).toBe(GUTTER);
    expect(layout.right).toBe(48 + GUTTER);
    expect(layout.listPadding).toEqual({ paddingHorizontal: 48 });
  });
});

describe("caps", () => {
  it("never narrow a phone-width block, at any text size", () => {
    for (const [name, cap] of Object.entries(CAPS)) {
      for (const fontScale of FONT_SCALES) {
        expect(outerCap(cap, fontScale), name).toBeGreaterThanOrEqual(
          PHONE_MAX_WIDTH,
        );
      }
    }
    expect(ABOUT_HERO_MAX).toBeGreaterThanOrEqual(PHONE_MAX_WIDTH - 64);
  });

  it("scale with text size through one clamp", () => {
    expect(capScale(0.8)).toBe(1);
    expect(capScale(1)).toBe(1);
    expect(capScale(1.2)).toBe(1.2);
    expect(capScale(CAP_SCALE_MAX)).toBe(CAP_SCALE_MAX);
    expect(capScale(3.1)).toBe(CAP_SCALE_MAX);
    expect(capScale(Number.NaN)).toBe(1);
    for (const cap of Object.values(CAPS)) {
      expect(scaledCap(cap, 0.8)).toBe(cap);
      expect(scaledCap(cap, 1)).toBe(cap);
      expect(scaledCap(cap, CAP_SCALE_MAX)).toBe(
        Math.round(cap * CAP_SCALE_MAX),
      );
      expect(scaledCap(cap, 3.1)).toBe(scaledCap(cap, CAP_SCALE_MAX));
    }
  });

  it("apply in a roomy window, with or without the gutters", () => {
    const window = { width: 834, height: 1210, fontScale: 1 };
    expect(capWidth(ACTIONS_MAX, window)).toBe(ACTIONS_MAX + 2 * GUTTER);
    expect(capWidth(ACTIONS_MAX, window, { gutter: false })).toBe(ACTIONS_MAX);
    expect(capWidth(ACTIONS_MAX, { ...window, fontScale: 2 })).toBe(
      Math.round(ACTIONS_MAX * CAP_SCALE_MAX) + 2 * GUTTER,
    );
  });
});

describe("the readable column", () => {
  it("centres a 680pt column on an iPad Pro 11-inch in portrait", () => {
    const layout = contentWidth(metrics(834, 1210));
    expect(layout.roomy).toBe(true);
    expect(layout.widthClass).toBe("medium");
    expect(layout.column).toBe(READABLE_MAX);
    expect(layout.centeredInset).toBe(77);
    expect(layout.listPadding).toEqual({ paddingHorizontal: 77 - GUTTER });
    expect(layout.rowInset).toEqual({ left: 77, right: 77 });
    expect(layout.formSectionMargin).toBe(77);
    expect(layout.formGutter).toBe(77 - GUTTER);
  });

  it("keeps the same column in landscape", () => {
    const layout = contentWidth(metrics(1210, 834));
    expect(layout.roomy).toBe(true);
    expect(layout.column).toBe(READABLE_MAX);
    expect(layout.centeredInset).toBe((1210 - READABLE_MAX) / 2);
  });

  it("widens with larger text, up to the clamp", () => {
    expect(contentWidth(metrics(1366, 1024, { fontScale: 1.2 })).column).toBe(
      Math.round(READABLE_MAX * 1.2),
    );
    expect(contentWidth(metrics(1366, 1024, { fontScale: 3.1 })).column).toBe(
      Math.round(READABLE_MAX * CAP_SCALE_MAX),
    );
  });

  it("never lets the column eat the gutters in a narrow roomy window", () => {
    const layout = contentWidth(metrics(620, 900));
    expect(layout.column).toBe(620 - 2 * GUTTER);
    expect(layout.centeredInset).toBe(GUTTER);
    expect(layout.listPadding).toEqual({ paddingHorizontal: 0 });
    // The column is no narrower than the system's own form margins.
    expect(layout.formSectionMargin).toBeNull();
  });

  it("keeps content clear of a large side inset", () => {
    // The closed iPhone Duo moves sheet bars into a side rail.
    const layout = contentWidth(metrics(700, 700, { safeLeft: 84 }));
    expect(layout.left).toBeGreaterThanOrEqual(84 + GUTTER);
    expect(layout.listPadding.paddingHorizontal).toBe(84);
    // SwiftUI applies the safe area itself, so the row inset leaves it out.
    expect(layout.rowInset).toEqual({ left: GUTTER, right: GUTTER });
  });

  it.each([
    ["left", 84, 0],
    ["right", 0, 84],
  ])(
    "keeps SwiftUI rows centred with a %s-only safe area",
    (_side, safeLeft, safeRight) => {
      const width = 1000;
      const layout = contentWidth(metrics(width, 800, { safeLeft, safeRight }));
      expect(layout.column).toBe(READABLE_MAX);
      expect(layout.centeredInset).toBe(160);
      expect(layout.rowInset).toEqual({
        left: 160 - safeLeft,
        right: 160 - safeRight,
      });
      // SwiftUI adds the safe area to the row inset; React Native lists add
      // their px-4 gutter to listPadding. Both must land on the same column.
      const rnEdge = layout.listPadding.paddingHorizontal + GUTTER;
      const rowLeft = safeLeft + layout.rowInset.left;
      const rowRight = width - safeRight - layout.rowInset.right;
      expect(rowLeft).toBe(rnEdge);
      expect(rowRight).toBe(width - rnEdge);
      expect(rowRight - rowLeft).toBe(READABLE_MAX);
    },
  );

  it("treats a narrow iPad window like a phone", () => {
    for (const width of [320, 375, 507, 599]) {
      const layout = contentWidth(metrics(width, 1194));
      expect(layout.roomy).toBe(false);
      expect(layout.listPadding).toEqual({ paddingHorizontal: 0 });
    }
  });
});

describe("window classes", () => {
  it("matches Android's width classes at the edges", () => {
    expect(widthClass(599)).toBe("compact");
    expect(widthClass(600)).toBe("medium");
    expect(widthClass(839)).toBe("medium");
    expect(widthClass(840)).toBe("expanded");
  });

  it("needs both dimensions to be roomy", () => {
    expect(isRoomy(600, 600)).toBe(true);
    expect(isRoomy(599, 1000)).toBe(false);
    expect(isRoomy(1000, 599)).toBe(false);
  });
});
