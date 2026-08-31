import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "./en.json";

/**
 * Every `{{placeholder}}` a string uses, in every language.
 *
 * `locales.test.ts` already proves the two catalogs have the same KEYS. It says
 * nothing about what is inside them, and an interpolated string is where the
 * difference bites: drop `{{suggestion}}` from one translation and i18next
 * renders the sentence without complaint, just missing the only part that made
 * it useful. "Sched addresses are the other way round. Try instead." is a
 * worse message than the generic one it replaced.
 *
 * Extra placeholders matter too. i18next leaves an unknown one as literal
 * text, so a typo'd `{{sugestion}}` ships those braces to the reader.
 */
type Json = { [key: string]: Json | string };

const dir = __dirname;

function flatten(value: Json, prefix = ""): Array<[string, string]> {
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v as Json, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v as string] as [string, string]],
  );
}

/** `{{count}}` and `{{ count }}` are the same placeholder to i18next. */
function placeholders(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1]),
  );
}

const english = new Map(flatten(en as unknown as Json));
const others = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .map((f) => ({
    locale: f.replace(/\.json$/, ""),
    entries: new Map(
      flatten(JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Json),
    ),
  }));

describe("interpolation placeholders match English", () => {
  for (const { locale, entries } of others) {
    it(`${locale} uses the same placeholders as en`, () => {
      const wrong: string[] = [];

      for (const [key, englishText] of english) {
        const translated = entries.get(key);
        // A missing key is locales.test.ts's job, not this one's.
        if (typeof translated !== "string") continue;

        const want = placeholders(englishText);
        const got = placeholders(translated);
        if (want.size === 0 && got.size === 0) continue;

        const missing = [...want].filter((p) => !got.has(p));
        const extra = [...got].filter((p) => !want.has(p));
        if (missing.length || extra.length) {
          wrong.push(
            `${key}: missing [${missing.join(", ")}] extra [${extra.join(", ")}]`,
          );
        }
      }

      expect(wrong).toEqual([]);
    });
  }
});
