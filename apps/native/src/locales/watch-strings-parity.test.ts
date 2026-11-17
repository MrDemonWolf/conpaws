import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "@/lib/supported-locales";

/**
 * The Watch's plan actions reuse the phone's wording rather than translating
 * it a second time: "Remove from my plan" on the wrist is the same button as
 * on the phone. The Swift table cannot read the JSON catalogs, so the copies
 * are held to them here, per field and per language.
 */
const WATCH_FIELDS = {
  aboutThisPanel: "convention.panel.about",
  removeFromPlan: "convention.removeFromSchedule",
  addToPlan: "convention.addToSchedule",
  otherOptionsThisHour: "convention.now.otherOptions",
  remove: "common.remove",
  saved: "convention.savedLabel",
} as const;

const swift = readFileSync(
  path.join(__dirname, "../../targets/_shared/ConPawsStrings.swift"),
  "utf8",
);

/** `case zhTW = "zh-TW"` → { zhTW: "zh-TW" }; `case ja` → { ja: "ja" }. */
function languageCodes(): Map<string, string> {
  const body = swift.match(/enum ConPawsLanguage:[^{]+\{([\s\S]*?)\n\n/)?.[1];
  if (!body) throw new Error("Could not find enum ConPawsLanguage");
  return new Map(
    [...body.matchAll(/^\s*case (\w+)(?:\s*=\s*"([^"]+)")?\s*$/gm)].map(
      (match) => [match[1], match[2] ?? match[1]],
    ),
  );
}

/** Each `ConPawsStrings(` table's argument list, keyed by its language. */
function tables(): Map<string, string> {
  const codes = languageCodes();
  const result = new Map<string, string>();
  for (const match of swift.matchAll(
    /private static let \w+ = ConPawsStrings\(\n {4}language: \.(\w+),([\s\S]*?)\n {2}\)/g,
  )) {
    const code = codes.get(match[1]);
    if (code) result.set(code, match[2]);
  }
  return result;
}

function swiftValue(table: string, field: string): string | undefined {
  const literal = table.match(
    new RegExp(`^ {4}${field}: ("(?:[^"\\\\]|\\\\.)*"),$`, "m"),
  )?.[1];
  // A Swift string literal without interpolation reads the same as JSON.
  return literal === undefined ? undefined : JSON.parse(literal);
}

function catalogValue(code: string, key: string): unknown {
  const catalog = JSON.parse(
    readFileSync(path.join(__dirname, `${code}.json`), "utf8"),
  );
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
}

describe("Watch plan strings match the app catalogs", () => {
  const byLanguage = tables();

  it("has a table for every shipped language", () => {
    expect([...byLanguage.keys()].sort()).toEqual(
      [...SUPPORTED_LANGUAGES].sort(),
    );
  });

  it("declares every field on ConPawsStrings", () => {
    for (const field of Object.keys(WATCH_FIELDS)) {
      expect(swift).toMatch(new RegExp(`^ {2}let ${field}: String$`, "m"));
    }
  });

  it.each(
    SUPPORTED_LANGUAGES.flatMap((code) =>
      Object.entries(WATCH_FIELDS).map(([field, key]) => [code, field, key]),
    ),
  )("%s %s copies %s verbatim", (code, field, key) => {
    const table = byLanguage.get(code);
    expect(table, `no Swift table for ${code}`).toBeDefined();
    const expected = catalogValue(code, key);
    expect(typeof expected, `${code}.json has no ${key}`).toBe("string");
    expect(swiftValue(table ?? "", field)).toBe(expected);
  });
});
