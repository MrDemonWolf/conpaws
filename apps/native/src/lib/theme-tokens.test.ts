import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { themeTokens } from "./theme-tokens";

// Same parsing approach as theme-contrast.test.ts: read global.css and hold
// the JS mirror to it, so a token edited in one place and not the other is a
// red test instead of a subtly wrong spinner color.
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

const blocks = {
  light: themeBlock(/@theme\s*\{([\s\S]*?)\}/),
  dark: themeBlock(
    /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}\s*\}/,
  ),
} as const;

const cssNames = {
  primary: "primary",
  primaryForeground: "primary-foreground",
  foreground: "foreground",
  destructiveForeground: "destructive-foreground",
  infoForeground: "info-foreground",
  ageMatureForeground: "age-mature-foreground",
  successForeground: "success-foreground",
  mutedForeground: "muted-foreground",
} as const;

describe.each(["light", "dark"] as const)("%s theme tokens", (scheme) => {
  it("matches global.css exactly", () => {
    for (const [key, cssName] of Object.entries(cssNames)) {
      expect(
        themeTokens[scheme][key as keyof typeof cssNames],
        `${scheme} ${cssName}`,
      ).toBe(color(blocks[scheme], cssName));
    }
  });
});
