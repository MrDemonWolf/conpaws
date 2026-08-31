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
const scheduleLayoutSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/schedule/_layout.tsx"),
  "utf8",
);
const scheduleScreenSource = readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/schedule/index.tsx"),
  "utf8",
);

describe("Expo Router convention routes", () => {
  it("uses one detail route with its nested import screen", () => {
    expect(existsSync(`${conventionRoute}.tsx`)).toBe(true);
    expect(existsSync(path.join(conventionRoute, "_layout.tsx"))).toBe(false);
    expect(existsSync(path.join(conventionRoute, "import.tsx"))).toBe(true);
  });

  it("presents the event sheet as a nested route without its own layout", () => {
    // The sheet is a pushed formSheet route so the system owns its dismissal
    // (the old RN-Modal version could be unmounted mid-dismiss and strand a
    // touch-eating window). It must stay inside the [id] group with no nested
    // _layout.tsx, or the group would stop sharing the (home) stack.
    expect(
      existsSync(path.join(conventionRoute, "event", "[eventId].tsx")),
    ).toBe(true);
    expect(existsSync(path.join(conventionRoute, "event", "_layout.tsx"))).toBe(
      false,
    );
    expect(homeLayoutSource).toContain(
      'name="convention/[id]/event/[eventId]"',
    );
  });

  // Bouncing is tied to whether there are rows, and both halves matter.
  //
  // Off when empty: a centred "no events" panel that rubber-bands reads as
  // broken. On when populated: the screen sets headerLargeTitleEnabled, and
  // UIKit only lays the large title into the scroll view's content inset when
  // that view can scroll. Hard-coding false put the title on top of the first
  // event row for any schedule short enough to fit on one screen.

  it("keeps convention scroll content connected to the native header", () => {
    expect(conventionDetailSource).toContain("collapsable={false}");
    expect(conventionDetailSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });
});

describe("iOS native stack headers", () => {
  it("uses native large titles without a competing fixed blur", () => {
    for (const source of [
      homeLayoutSource,
      settingsLayoutSource,
      scheduleLayoutSource,
    ]) {
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
      ?.filter((block) => block.includes("presentation: FORM_PRESENTATION"));

    expect(sheets?.length).toBeGreaterThan(0);
    for (const sheet of sheets ?? []) {
      expect(sheet).toContain("headerLargeTitleEnabled: false");
    }
  });

  it("presents forms as a sheet on iOS and a full-screen modal on Android", () => {
    // Android clipped the form's own header row away when the sheet re-laid-out
    // for the keyboard, so it gets a full-screen modal instead. Android also
    // renders its header in-content, because Stack.Toolbar never reaches
    // headerLeft/headerRight there -- so the native header must stay hidden or
    // the screen shows two titles.
    expect(homeLayoutSource).toContain(
      'process.env.EXPO_OS === "ios" ? "formSheet" : "modal"',
    );
    expect(homeLayoutSource).toContain(
      'const FORM_HEADER_SHOWN = process.env.EXPO_OS === "ios"',
    );
  });
});

describe("Schedule tab", () => {
  // Same failure the convention schedule hit: with bouncing hard-coded off,
  // a list short enough to fit gives the iOS large title no content inset to
  // occupy, so it paints over the first row.

  it("keeps scroll content connected to the native header", () => {
    expect(scheduleScreenSource).toContain("collapsable={false}");
    expect(scheduleScreenSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });
});

describe("Windowed lists redraw when their formatting inputs change", () => {
  // Both schedules format their rows -- and the schedule tab its day headers --
  // from values that live outside the section data: the locale, the clock
  // preference, and on the convention screen the highlighted event. A
  // VirtualizedList reuses cached cells whenever the data identity is
  // unchanged, so without `extraData` those cells keep whatever they were first
  // rendered with. That shipped as English chrome sitting above Russian day
  // headers after a language change, until the next cold start.
  //
  // Asserting the prop is present rather than its exact contents: the set of
  // inputs will grow, and a test that pins the string would only ever be
  // updated to match whatever the code already says.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s passes extraData to its SectionList", (_name, source) => {
    expect(source).toContain("extraData={");
  });

  it("keys the schedule tab's extraData on the locale and clock", () => {
    expect(scheduleScreenSource).toMatch(/extraData=\{`[^`]*\$\{locale\}/);
    expect(scheduleScreenSource).toMatch(/extraData=\{`[^`]*\$\{hour12\}/);
  });

  // The font scale is the non-obvious one. iOS delivers a Dynamic Type change
  // to a running app, and the cells that are already measured keep their old
  // heights, so the larger text is drawn clipped through the middle of the
  // glyphs. A cold start at the same text size is fine, which is exactly why
  // this is easy to reintroduce.
  it.each([
    ["schedule tab", scheduleScreenSource],
    ["convention detail", conventionDetailSource],
  ])("%s rebuilds its cells when the font scale changes", (_name, source) => {
    expect(source).toContain("useWindowDimensions");
    expect(source).toMatch(/extraData=\{`[^`]*\$\{fontScale\}/);
  });
});
