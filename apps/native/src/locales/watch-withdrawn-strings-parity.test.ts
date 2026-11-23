import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "@/lib/supported-locales";

/**
 * What the Watch says about a saved panel the convention withdrew reuses the
 * phone's words: the status badge on the panel's row and the schedule-update
 * banner's "off the schedule" line. The Swift table cannot read the JSON
 * catalogs, so the copies in `ConPawsStrings+Withdrawn.swift` are held to them
 * here, per field and per language. A catalog's `{{count}}` is the table's
 * `%@`.
 */
const FIELDS = {
  cancelled: "convention.feedStatus.cancelled",
  removed: "convention.feedStatus.removed",
  goneOne: "convention.scheduleUpdate.goneOne",
  goneManyFormat: "convention.scheduleUpdate.goneMany",
} as const;

const sharedDir = path.join(__dirname, "../../targets/_shared");
const strings = readFileSync(
  path.join(sharedDir, "ConPawsStrings.swift"),
  "utf8",
);
const swift = readFileSync(
  path.join(sharedDir, "ConPawsStrings+Withdrawn.swift"),
  "utf8",
);

/** i18next's one named value as the Swift table's positional `%@`. */
function swiftFormat(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const placeholders = value.match(/\{\{\w+\}\}/g) ?? [];
  if (placeholders.length > 1) {
    throw new Error(`"${value}" needs positional specifiers, not one %@`);
  }
  return value.replace(/\{\{\w+\}\}/, "%@");
}

/** `case zhTW = "zh-TW"` → { zhTW: "zh-TW" }; `case ja` → { ja: "ja" }. */
function languageCodes(): Map<string, string> {
  const body = strings.match(/enum ConPawsLanguage:[^{]+\{([\s\S]*?)\n\n/)?.[1];
  if (!body) throw new Error("Could not find enum ConPawsLanguage");
  return new Map(
    [...body.matchAll(/^\s*case (\w+)(?:\s*=\s*"([^"]+)")?\s*$/gm)].map(
      (match) => [match[1], match[2] ?? match[1]],
    ),
  );
}

/** Each table's argument list, keyed by its language code. */
function tables(): Map<string, string> {
  const codes = languageCodes();
  const result = new Map<string, string>();
  for (const match of swift.matchAll(
    /private static let (\w+) = ConPawsWithdrawnStrings\(\n {4}language: \.(\w+),([\s\S]*?)\n {2}\)/g,
  )) {
    // A table named for one language must declare that language.
    expect(match[2]).toBe(match[1]);
    const code = codes.get(match[2]);
    if (code) result.set(code, match[3]);
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

describe("Watch withdrawn-panel strings copied from the app catalogs", () => {
  const byLanguage = tables();

  it("has a table for every shipped language", () => {
    expect([...byLanguage.keys()].sort()).toEqual(
      [...SUPPORTED_LANGUAGES].sort(),
    );
  });

  it("hands each language its own table", () => {
    const body = swift.match(
      /static func table\(for language: ConPawsLanguage\) -> ConPawsWithdrawnStrings \{[\s\S]*?switch language \{([\s\S]*?)\n {4}\}/,
    )?.[1];
    const cases = [...(body ?? "").matchAll(/case \.(\w+): (\w+)/g)];
    expect(cases.map((match) => match[1]).sort()).toEqual(
      [...languageCodes().keys()].sort(),
    );
    for (const match of cases) expect(match[2]).toBe(match[1]);
  });

  it("declares every field", () => {
    for (const field of Object.keys(FIELDS)) {
      expect(swift).toMatch(new RegExp(`^ {2}let ${field}: String$`, "m"));
    }
  });

  it.each(
    SUPPORTED_LANGUAGES.flatMap((code) =>
      Object.entries(FIELDS).map(([field, key]) => [code, field, key]),
    ),
  )("%s %s copies %s verbatim", (code, field, key) => {
    const table = byLanguage.get(code);
    expect(table, `no Swift table for ${code}`).toBeDefined();
    const expected = swiftFormat(catalogValue(code, key));
    expect(typeof expected, `${code}.json has no ${key}`).toBe("string");
    expect(swiftValue(table ?? "", field)).toBe(expected);
  });
});
