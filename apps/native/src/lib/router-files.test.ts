import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const conventionRoute = path.resolve(
  __dirname,
  "../../app/(tabs)/(home)/convention/[id]",
);
const conventionDetailSource = readFileSync(`${conventionRoute}.tsx`, "utf8");
const homeLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/(home)/_layout.tsx"),
  "utf8",
);
const settingsLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/settings/_layout.tsx"),
  "utf8",
);

describe("Expo Router convention routes", () => {
  it("uses one detail route with its nested import screen", () => {
    expect(existsSync(`${conventionRoute}.tsx`)).toBe(true);
    expect(existsSync(path.join(conventionRoute, "_layout.tsx"))).toBe(false);
    expect(existsSync(path.join(conventionRoute, "import.tsx"))).toBe(true);
  });

  // Bouncing is tied to whether there are rows, and both halves matter.
  //
  // Off when empty: a centred "no events" panel that rubber-bands reads as
  // broken. On when populated: the screen sets headerLargeTitleEnabled, and
  // UIKit only lays the large title into the scroll view's content inset when
  // that view can scroll. Hard-coding false put the title on top of the first
  // event row for any schedule short enough to fit on one screen.
  it("bounces the convention schedule only when it has rows", () => {
    expect(conventionDetailSource).toMatch(
      /<SectionList\s+(?:\/\/[^\n]*\n\s*)*alwaysBounceVertical=\{dayGroups\.length > 0\}/,
    );
  });

  it("keeps convention scroll content connected to the native header", () => {
    expect(conventionDetailSource).toContain("collapsable={false}");
    expect(conventionDetailSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });
});

describe("iOS native stack headers", () => {
  it("uses native large titles without a competing fixed blur", () => {
    for (const source of [homeLayoutSource, settingsLayoutSource]) {
      expect(source).toContain(
        'headerLargeTitleEnabled: process.env.EXPO_OS === "ios"',
      );
      expect(source).not.toContain("headerBlurEffect");
      expect(source).not.toContain("headerTransparent");
    }
  });

  it("keeps every form sheet compact", () => {
    // Counting occurrences would just need bumping each time a sheet is added,
    // and would pass if a new sheet were added while an old one lost the flag.
    // Assert the invariant instead: a form sheet never gets a large title.
    const sheets = homeLayoutSource
      .match(/options=\{\{[\s\S]*?\}\}/g)
      ?.filter((block) => block.includes('presentation: "formSheet"'));

    expect(sheets?.length).toBeGreaterThan(0);
    for (const sheet of sheets ?? []) {
      expect(sheet).toContain("headerLargeTitleEnabled: false");
    }
  });
});
