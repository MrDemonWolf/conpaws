import { describe, expect, it } from "vitest";
import {
  CATEGORY_ACCENTS,
  categoryAccentColor,
  categoryAccentIndex,
} from "./category-color";

// The same arithmetic theme-contrast.test.ts uses, kept local so this file
// stays independent of the token parser.
function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(left: string, right: string): number {
  const [high, low] = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

const SURFACES = {
  light: ["#ffffff", "#f2f2f7"],
  dark: ["#000000", "#1c1c1e"],
} as const;

describe("categoryAccentIndex", () => {
  it("is stable and ignores case and spacing", () => {
    const art = categoryAccentIndex("Art");
    expect(art).not.toBeNull();
    expect(categoryAccentIndex(" art ")).toBe(art);
    expect(categoryAccentIndex("ART")).toBe(art);
    expect(categoryAccentIndex("Art")).toBe(art);
  });

  it("returns null for no category", () => {
    expect(categoryAccentIndex(null)).toBeNull();
    expect(categoryAccentIndex("   ")).toBeNull();
  });

  it("spreads a realistic set of names across the accents", () => {
    const names = [
      "Art",
      "Community",
      "Fursuiting",
      "Games",
      "Writing",
      "Performance",
      "Making",
      "Photography",
      "Gaming",
      "Social",
      "Wellness",
      "Music",
      "Dance",
      "Panels",
      "Workshops",
      "Meetups",
    ];
    const used = new Set(names.map((name) => categoryAccentIndex(name)));
    expect(used.size).toBeGreaterThanOrEqual(6);
  });
});

describe("categoryAccentColor", () => {
  it("resolves a hex per scheme", () => {
    expect(categoryAccentColor("Art", "light")).toMatch(/^#[0-9a-f]{6}$/);
    expect(categoryAccentColor("Art", "dark")).toMatch(/^#[0-9a-f]{6}$/);
    expect(categoryAccentColor(null, "light")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "every %s accent clears 3:1 against the page and the card",
    (scheme) => {
      for (const hex of CATEGORY_ACCENTS[scheme]) {
        for (const surface of SURFACES[scheme]) {
          expect(contrast(hex, surface)).toBeGreaterThanOrEqual(3);
        }
      }
    },
  );
});
