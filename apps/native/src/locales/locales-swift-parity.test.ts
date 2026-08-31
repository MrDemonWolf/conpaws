import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "@/lib/supported-locales";

/**
 * The widget, the watch app and the complications do not read the JSON
 * catalogs. They render from a Swift table in
 * `targets/_shared/ConPawsStrings.swift`, because `@bacons/apple-targets`
 * generates the Xcode project and cannot carry localized resources, and because
 * those surfaces must follow the app's language rather than the device's.
 *
 * That means the language list exists twice, and the two drifted: the app grew
 * to 23 languages while the Swift enum still had 8. Fifteen languages got
 * English widgets, an English watch app and English complications, and nothing
 * failed -- `ConPawsLanguage.resolve` falls back to English by design, so the
 * drift was invisible from either side.
 *
 * This reads the Swift rather than duplicating the list a third time.
 */
const swiftPath = path.join(
  __dirname,
  "../../targets/_shared/ConPawsStrings.swift",
);
const swift = readFileSync(swiftPath, "utf8");

/** The `case` lines of `enum ConPawsLanguage`, as the locale codes they mean. */
function swiftLanguages(): string[] {
  const enumBody = swift.match(
    /enum ConPawsLanguage: String, CaseIterable, Sendable \{([\s\S]*?)\n\n/,
  )?.[1];
  if (!enumBody) throw new Error("Could not find enum ConPawsLanguage");

  return [
    ...enumBody.matchAll(/^\s*case (\w+)(?:\s*=\s*"([^"]+)")?\s*$/gm),
  ].map(
    // `case ja` means "ja"; `case zhTW = "zh-TW"` means the raw value.
    (m) => m[2] ?? m[1],
  );
}

/** Every `private static let <name> = ConPawsStrings(` in the file. */
function swiftTables(): string[] {
  return [
    ...swift.matchAll(/private static let (\w+) = ConPawsStrings\(/g),
  ].map((m) => m[1]);
}

/** The identifiers `table(for:)` maps each case to. */
function dispatchedCases(): string[] {
  const body = swift.match(
    /static func table\(for language: ConPawsLanguage\) -> ConPawsStrings \{[\s\S]*?switch language \{([\s\S]*?)\n {4}\}/,
  )?.[1];
  if (!body) throw new Error("Could not find table(for:)");

  return [...body.matchAll(/case \.(\w+):/g)].map((m) => m[1]);
}

describe("widget and watch strings cover every shipped language", () => {
  it("has a ConPawsLanguage case for every SUPPORTED_LANGUAGES entry", () => {
    const swiftCodes = swiftLanguages();
    const missing = SUPPORTED_LANGUAGES.filter(
      (code) => !swiftCodes.includes(code),
    );

    // A missing case is not a crash, it is an English widget for a reader who
    // chose another language -- which is why this has to be asserted rather
    // than noticed.
    expect(missing).toEqual([]);
  });

  it("advertises no language the app does not ship", () => {
    const extra = swiftLanguages().filter(
      (code) => !(SUPPORTED_LANGUAGES as readonly string[]).includes(code),
    );

    expect(extra).toEqual([]);
  });

  it("gives every case its own table rather than falling back", () => {
    const cases = dispatchedCases();
    const tables = new Set(swiftTables());

    expect(cases).toHaveLength(SUPPORTED_LANGUAGES.length);
    // Two cases pointing at one table would compile and quietly ship the wrong
    // language's wording.
    expect(new Set(cases).size).toBe(cases.length);
    for (const name of cases) {
      expect(tables.has(name), `no table for case .${name}`).toBe(true);
    }
  });
});
