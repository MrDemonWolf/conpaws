import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../global.css", import.meta.url), "utf8");

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
  it("keeps primary and muted text at WCAG AA", () => {
    for (const surface of ["background", "card"]) {
      expect(
        contrast(color(theme, "primary"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(color(theme, "muted-foreground"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrast(color(theme, "primary-foreground"), color(theme, "primary")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(
        color(theme, "destructive-foreground"),
        color(theme, "destructive"),
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps body text at WCAG AAA", () => {
    for (const surface of ["background", "card"]) {
      expect(
        contrast(color(theme, "foreground"), color(theme, surface)),
      ).toBeGreaterThanOrEqual(7);
    }
  });
});

it("keeps the brand heading readable over the strongest onboarding glow", () => {
  expect(contrast("#00729c", "#d4f0fc")).toBeGreaterThanOrEqual(4.5);
  expect(contrast("#18b7f2", "#0b3c63")).toBeGreaterThanOrEqual(4.5);
});
