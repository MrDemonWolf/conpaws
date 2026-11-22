import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level: the platform files import native-only modules.
const read = (file: string) =>
  readFileSync(path.resolve(__dirname, file), "utf8");

const names = [
  ...read("SettingsLeadingIcon.types.ts").matchAll(/\|\s*"([a-z]+)"/g),
].map((match) => match[1]);

function keysOf(source: string, objectStart: RegExp) {
  const start = source.search(objectStart);
  const body = source.slice(start, source.indexOf("};", start));
  return [...body.matchAll(/^\s{2}([a-z]+):/gm)].map((match) => match[1]);
}

describe("Settings row icons", () => {
  it("names every icon the rows use", () => {
    expect(names.length).toBeGreaterThan(10);
  });

  it("gives every name an iOS tile with a symbol and a hex colour", () => {
    const ios = read("SettingsLeadingIcon.ios.tsx");
    expect(keysOf(ios, /SETTINGS_ICON_TILES[^=]*=/).sort()).toEqual(
      [...names].sort(),
    );
    for (const name of names) {
      expect(ios).toMatch(
        new RegExp(
          `${name}: \\{ symbol: "[a-z0-9.]+", color: "#[0-9A-F]{6}" \\}`,
        ),
      );
    }
  });

  it("gives every name an Android Material glyph", () => {
    const android = read("SettingsLeadingIcon.android.tsx");
    expect(keysOf(android, /const GLYPHS[^=]*=/).sort()).toEqual(
      [...names].sort(),
    );
  });

  it("uses a leading icon on every Settings row, so titles line up", () => {
    const screen = read("../../app/(tabs)/settings/index.tsx");
    // Rows go through the shared components, which always take an icon.
    expect(screen).not.toMatch(/<NativeSwitch\b/);
    const bareRows = [...screen.matchAll(/<FieldRow\b[^>]*>/g)].filter(
      (match) => !match[0].includes("leading="),
    );
    expect(bareRows).toEqual([]);
  });
});

describe("Settings rows on iOS", () => {
  const ios = read("SettingsRows.ios.tsx");

  it("never names a UIKit label colour, which Expo's converter drops", () => {
    // "secondaryLabel" is not a colour Expo knows, so the style vanished and
    // values and subtitles drew in the primary colour.
    expect(ios).not.toMatch(/color:\s*["'][A-Za-z]*Label["']/);
  });

  it("styles the subtitle itself instead of passing ListItem a string", () => {
    // ListItem styles a plain-string supportingText with "secondaryLabel".
    expect(ios).not.toMatch(/supportingText=\{(description|value|subtitle)\}/);
    expect(ios).toMatch(/<Text modifiers=\{\[SUBTITLE, SECONDARY\]\}>/);
  });

  it("moves the value under the title at accessibility text sizes", () => {
    expect(ios).toMatch(/fontScale >= SETTINGS_STACKED_FONT_SCALE/);
    expect(ios).toMatch(/value=\{stacked \? undefined : value\}/);
    const screen = read("../../app/(tabs)/settings/index.tsx");
    expect(screen).toMatch(/fontScale < SETTINGS_STACKED_FONT_SCALE/);
  });
});

describe("Settings rows on Android", () => {
  it("hands each section the FieldRow element itself", () => {
    // FieldGroup.Section compares each child's type with the universal
    // ListItem; a wrapper component drew every row as a card in a card.
    const android = read("SettingsRows.android.tsx");
    for (const name of ["settingsLinkRow", "settingsSwitchRow"]) {
      const start = android.indexOf(`export function ${name}(`);
      expect(start).toBeGreaterThan(-1);
      const body = android.slice(start, android.indexOf("\n}\n", start));
      expect(body).toMatch(/return \(\s*<FieldRow\b/);
    }
    const screen = read("../../app/(tabs)/settings/index.tsx");
    expect(screen).not.toMatch(/<Settings(Link|Switch)Row\b/);
  });
});
