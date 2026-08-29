import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every locale file must carry exactly the same key set. i18next silently
 * falls back to English for a missing key, so a locale that drifts loses
 * translations with no error anywhere — this is the only guard.
 */
const localesDir = path.resolve(__dirname, "../locales");

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("locale parity", () => {
  const files = readdirSync(localesDir).filter((f) => f.endsWith(".json"));

  it("has all eight locales", () => {
    expect(files.sort()).toEqual([
      "de.json",
      "en.json",
      "es.json",
      "fr.json",
      "nl.json",
      "pl.json",
      "pt-BR.json",
      "sv.json",
    ]);
  });

  const reference = flattenKeys(
    JSON.parse(readFileSync(path.join(localesDir, "en.json"), "utf8")),
  ).sort();

  it.each(files.filter((f) => f !== "en.json"))(
    "%s has exactly the keys en.json has",
    (file) => {
      const keys = flattenKeys(
        JSON.parse(readFileSync(path.join(localesDir, file), "utf8")),
      ).sort();

      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    },
  );
});
