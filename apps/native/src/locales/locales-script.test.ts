import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No Cyrillic characters in a Latin-script language.
 *
 * This exists because it caught a real one: a Brazilian Portuguese string
 * shipped as "Esse link abre uma página web, не um arquivo de calendário" --
 * Cyrillic "не" where "não" belonged, from a stray keystroke while writing 23
 * translations at once. It is invisible in review. The sentence scans, the
 * word is the right length, and the two characters look plausible until a
 * Portuguese speaker reads it.
 *
 * Deliberately one-directional. The mirror check -- Latin letters inside a
 * Cyrillic string -- is unusable: every `{{count}}` placeholder and every
 * brand name is Latin, so it flags roughly sixty legitimate strings per
 * language. A guard that cries wolf is worse than no guard.
 */
const LATIN_SCRIPT_LOCALES = new Set([
  "en",
  "de",
  "fr",
  "es-ES",
  "es-419",
  "pt-BR",
  "pt-PT",
  "it",
  "nl",
  "pl",
  "sv",
  "da",
  "nb",
  "fi",
  "cs",
  "hu",
  "ms",
]);

type Json = { [key: string]: Json | string };

function flatten(value: Json, prefix = ""): Array<[string, string]> {
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v as Json, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v as string] as [string, string]],
  );
}

const dir = __dirname;
const catalogs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    locale: f.replace(/\.json$/, ""),
    entries: flatten(
      JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Json,
    ),
  }))
  .filter(({ locale }) => LATIN_SCRIPT_LOCALES.has(locale));

describe("Latin-script catalogs contain no Cyrillic", () => {
  for (const { locale, entries } of catalogs) {
    it(`${locale} is free of Cyrillic characters`, () => {
      const offenders = entries
        .filter(([, text]) => /[Ѐ-ӿ]/.test(text))
        .map(([key, text]) => `${key}: ${text.slice(0, 60)}`);

      expect(offenders).toEqual([]);
    });
  }
});
