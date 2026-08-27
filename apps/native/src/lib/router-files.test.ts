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

/**
 * The props of the one `<SectionList>` in a route, as written.
 *
 * Both schedule screens are `.tsx` route modules, and this suite runs under
 * `environment: "node"` with no React Native renderer, so a rendered-props
 * assertion is not available. Reading the opening tag is the next best thing,
 * and reading the whole tag rather than matching from `<SectionList` forward
 * keeps the check independent of the order the props happen to be written in.
 */
function sectionListProps(source: string, label: string): string {
  const open = "<SectionList";
  const start = source.indexOf(open);
  if (start === -1) {
    throw new Error(`No <SectionList> found in the ${label} source.`);
  }

  let depth = 0;
  for (let i = start + open.length; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    else if (char === ">" && depth === 0) return source.slice(start, i);
  }

  throw new Error(`The <SectionList> tag in the ${label} source never closes.`);
}

/**
 * Asserts the one rule both schedule lists follow: bouncing is bound to
 * whether the sections it renders have any rows.
 *
 * Deriving the collection name from `sections=` rather than hard-coding it is
 * what lets the local variable be renamed, or the list moved into a component,
 * without the invariant losing its meaning.
 */
function expectBouncesOnlyWhenPopulated(source: string, label: string) {
  const props = sectionListProps(source, label);
  const sections = props.match(/sections=\{\s*([A-Za-z0-9_$.]+)\s*\}/)?.[1];
  const bounce = props.match(/alwaysBounceVertical=\{([^}]*)\}/)?.[1];

  expect(sections, `${label} must render a sections prop`).toBeDefined();
  expect(
    bounce,
    `${label} must set alwaysBounceVertical explicitly`,
  ).toBeDefined();
  expect(
    bounce?.replace(/\s+/g, ""),
    `${label} must bounce exactly when ${sections} has rows`,
  ).toBe(`${sections}.length>0`);
}

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
    expectBouncesOnlyWhenPopulated(
      conventionDetailSource,
      "the convention schedule",
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
  it("bounces only when it has rows", () => {
    expectBouncesOnlyWhenPopulated(scheduleScreenSource, "the Schedule tab");
  });

  it("keeps scroll content connected to the native header", () => {
    expect(scheduleScreenSource).toContain("collapsable={false}");
    expect(scheduleScreenSource).toContain(
      'contentInsetAdjustmentBehavior="automatic"',
    );
  });
});
