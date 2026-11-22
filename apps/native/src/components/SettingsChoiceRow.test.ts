import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Source-level: the row imports native-only modules.
const read = (file: string) =>
  readFileSync(path.resolve(__dirname, file), "utf8");

describe("Settings choice rows", () => {
  it("hands each section the FieldRow element itself", () => {
    // Android's FieldGroup.Section compares each child's type with the
    // universal ListItem; a wrapper component drew every row as a card in a
    // card.
    const source = read("SettingsChoiceRow.tsx");
    const start = source.indexOf("export function settingsChoiceRow(");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).toMatch(/return \(\s*<FieldRow\b/);
    // The selection in the key is what moves the mark on Android.
    expect(body).toMatch(/key=\{`\$\{id\}-\$\{selected\}`\}/);
  });

  it("is called as a function by every Settings screen", () => {
    const settingsDir = path.resolve(__dirname, "../../app/(tabs)/settings");
    const screens = (readdirSync(settingsDir, { recursive: true }) as string[])
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => readFileSync(path.join(settingsDir, file), "utf8"));
    expect(screens.length).toBeGreaterThan(5);
    expect(
      screens.some((source) => source.includes("settingsChoiceRow(")),
    ).toBe(true);
    for (const source of screens) {
      expect(source).not.toMatch(/<SettingsChoiceRow\b/);
    }
  });
});
