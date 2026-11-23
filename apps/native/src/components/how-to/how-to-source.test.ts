import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source checks for the "Show me how" pictures and walkthrough. These rules
 * only show on a device (a screen reader, a hardware keyboard, landscape), so
 * they are pinned here where a unit test can see them.
 */
const read = (file: string) => readFileSync(path.join(__dirname, file), "utf8");

const pictures = read("pictures.tsx");
const frame = read("MockupFrame.tsx");
const walkthrough = read("HowToWalkthrough.tsx");
const modal = read("HowToModal.tsx");
const helpRows = read("../ImportHelpRows.tsx");

const count = (source: string, pattern: RegExp) =>
  source.match(pattern)?.length ?? 0;

describe("how-to pictures", () => {
  // A picture is a mockup, never a control. Anything pressable in it would be
  // a target VoiceOver skips but a finger or keyboard can still reach.
  it.each([
    ["pictures.tsx", pictures],
    ["MockupFrame.tsx", frame],
  ])("%s imports neither @expo/ui nor Pressable", (_file, source) => {
    expect(source).not.toMatch(/from "@expo\/ui/);
    expect(source).not.toMatch(/\bPressable\b/);
  });

  it("hides the frame from screen readers and touches", () => {
    expect(frame).toContain("accessibilityElementsHidden");
    expect(frame).toContain('importantForAccessibility="no-hide-descendants"');
    expect(frame).toContain('pointerEvents="none"');
  });

  // Hiding a view from TalkBack does not take it out of keyboard focus: in
  // React Native 0.88 a Pressable is focusable by default.
  it("takes every pretend control out of keyboard focus", () => {
    const controls = count(
      pictures,
      /<(Button|Input|CatalogEditionRow|CatalogFallbackCard)\b/g,
    );
    expect(controls).toBeGreaterThan(0);
    expect(count(pictures, /focusable=\{false\}/g)).toBeGreaterThanOrEqual(
      controls,
    );
  });

  it("never gives a pretend button something to do", () => {
    expect(pictures).not.toMatch(/<Button[^>]*\bonPress=/);
  });
});

describe("how-to walkthrough", () => {
  it("follows Reduce Motion when a button turns the page", () => {
    expect(walkthrough).toContain("useReducedMotion");
    expect(walkthrough).toContain("animated: !reduceMotion");
  });

  // react-native-screens switches the first scroll view in a screen's
  // first-subview chain from "never" to "automatic" insets. A horizontal
  // pager given automatic insets shifts sideways in landscape.
  it("keeps the pager out of automatic content insets", () => {
    expect(walkthrough).toContain('contentInsetAdjustmentBehavior="never"');
    const progress = walkthrough.indexOf("<OnboardingProgress");
    const pager = walkthrough.indexOf("horizontal\n");
    expect(progress).toBeGreaterThan(0);
    expect(pager).toBeGreaterThan(progress);
  });

  it("lets a screen reader reach only the current page", () => {
    expect(walkthrough).toContain("accessibilityElementsHidden={i !== index}");
    expect(walkthrough).toMatch(
      /importantForAccessibility=\{\s*i === index \? "auto" : "no-hide-descendants"\s*\}/,
    );
  });

  it("moves focus to the new title after Next and Back", () => {
    expect(walkthrough).toContain(
      'AccessibilityInfo.sendAccessibilityEvent(node, "focus")',
    );
    expect(walkthrough).toMatch(/accessible\s+accessibilityRole="header"/);
  });
});

describe("how-to modal over the import screen", () => {
  // The import screen is an iOS form sheet, and iOS drops a sheet presented
  // from a sheet. The provider stops it inheriting the sheet's top inset of 0.
  it("covers the sheet in full and measures its own safe area", () => {
    expect(modal).toContain('presentationStyle="fullScreen"');
    expect(modal).toContain("<SafeAreaProvider>");
  });
});

describe("import help rows", () => {
  // Android's FieldGroup.Section draws only a bare universal ListItem as a
  // flat row and wraps anything else in a second card.
  it("returns only bare FieldRows", () => {
    const tags = new Set(
      [...helpRows.matchAll(/<([A-Z][A-Za-z.]*)/g)].map((match) => match[1]),
    );
    expect([...tags].sort()).toEqual(["FieldRow", "NavigationIndicator"]);
  });

  it("offers Show me how for both import methods", () => {
    expect(helpRows).toContain('showMeRow("sched")');
    expect(helpRows).toContain('showMeRow("ics")');
  });
});
