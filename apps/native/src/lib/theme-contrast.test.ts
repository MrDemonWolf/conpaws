import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../global.css"),
  "utf8",
);

function themeBlock(pattern: RegExp): string {
  const match = css.match(pattern);
  if (!match?.[1]) throw new Error(`Missing theme block: ${pattern}`);
  return match[1];
}

function color(block: string, name: string): string {
  const match = block.match(
    new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, "i"),
  );
  if (!match?.[1]) throw new Error(`Missing --color-${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  if (!channels) throw new Error(`Invalid color: ${hex}`);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const brightest = Math.max(luminance(first), luminance(second));
  const darkest = Math.min(luminance(first), luminance(second));
  return (brightest + 0.05) / (darkest + 0.05);
}

const light = themeBlock(/@theme\s*\{([\s\S]*?)\}/);
const dark = themeBlock(
  /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}\s*\}/,
);

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_, theme) => {
  // Raised from 4.5 to 7 on 2026-08-28: brand text and button fills must
  // clear AAA in both themes, not just AA. Light primary/destructive were
  // darkened (#00729c -> #005575, #dc2626 -> #991b1b) to get there.
  it("keeps primary text and button fills at WCAG AAA", () => {
    for (const surface of ["background", "card"]) {
      expect(
        contrast(color(theme, "primary"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(7);
      expect(
        contrast(color(theme, "muted-foreground"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrast(color(theme, "primary-foreground"), color(theme, "primary")),
    ).toBeGreaterThanOrEqual(7);
    expect(
      contrast(
        color(theme, "destructive-foreground"),
        color(theme, "destructive"),
      ),
    ).toBeGreaterThanOrEqual(7);
  });

  // These pairs were previously hardcoded Tailwind palette classes inside
  // Badge.tsx, so nothing checked them. Pill text is small, so AAA for small
  // text (7:1) is the bar, not AA.
  it.each(["age-teen", "age-mature", "age-adult", "info", "success"])(
    "keeps %s pill text at WCAG AAA against its own fill",
    (name) => {
      expect(
        contrast(color(theme, `${name}-foreground`), color(theme, name)),
      ).toBeGreaterThanOrEqual(7);
    },
  );

  it("keeps pill text readable if the fill fails to render", () => {
    // A pill whose background is dropped -- by a theme override or a
    // rendering fallback -- must not leave unreadable text on bare card.
    for (const name of ["age-teen", "age-mature", "age-adult", "info"]) {
      expect(
        contrast(color(theme, `${name}-foreground`), color(theme, "card")),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps body text at WCAG AAA", () => {
    for (const surface of ["background", "card"]) {
      expect(
        contrast(color(theme, "foreground"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("Android platform colors", () => {
  // The app's generated theme is Theme.AppCompat.DayNight.NoActionBar, which
  // defines none of the Material 3 colour attributes. PlatformColor cannot
  // resolve them, and RCTView throws "None of the paths in the
  // `resource_paths` array resolved to a color resource" on the first bordered
  // view — which killed the app at launch, on every Android device, for as
  // long as the block existed.
  //
  // Re-adding these means moving the app theme to Material 3 through a config
  // plugin first. android/ is generated, so editing styles.xml does not
  // survive a prebuild.
  it("declares no Material 3 theme attributes", () => {
    const attrColors = css.match(/platformColor\(\\\?attr[^)]*\)/g) ?? [];

    expect(attrColors).toEqual([]);
  });

  it("has no @media android block to reintroduce them", () => {
    expect(css).not.toMatch(/@media\s+android\s*\{/);
  });
});
