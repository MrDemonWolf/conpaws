import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "@/lib/supported-locales";

/**
 * `Intl.DateTimeFormat` and `Intl.PluralRules` are polyfilled by @formatjs,
 * and a polyfill only knows the languages whose data files were imported. That
 * list lives in `app/_layout.tsx` as a wall of side-effect imports, which is
 * exactly the kind of list that stops matching reality quietly.
 *
 * It did. The app went from 8 languages to 23 and the imports stayed at 8, so
 * thirteen languages formatted dates in English -- a Russian convention card
 * read "Sep 3, 2026". Nothing failed, because a date formatted in the wrong
 * language is still a date.
 *
 * This is the third list to drift the same way, after CFBundleLocalizations
 * and the Swift widget string tables. Hence a test rather than a fix.
 */
const layout = readFileSync(
  path.join(__dirname, "../../app/_layout.tsx"),
  "utf8",
);

function imported(pkg: "intl-datetimeformat" | "intl-pluralrules"): string[] {
  const re = new RegExp(`@formatjs/${pkg}/locale-data/([A-Za-z-]+)\\.js`, "g");
  return [...layout.matchAll(re)].map((m) => m[1]);
}

/**
 * The data file a locale resolves to.
 *
 * @formatjs ships one file per language, not per regional variant: `es-419`
 * and `es-ES` both read `es`. Chinese is the exception — it is split by script
 * rather than region, so `zh-CN` needs `zh-Hans` and `zh-TW` needs `zh-Hant`.
 */
function dataKeysFor(locale: string): string[] {
  if (locale === "zh-CN") return ["zh-Hans", "zh"];
  if (locale === "zh-TW") return ["zh-Hant", "zh"];
  return [locale.split("-")[0]];
}

describe("Intl polyfill data covers every shipped language", () => {
  it("has date-format data for every SUPPORTED_LANGUAGES entry", () => {
    const have = new Set(imported("intl-datetimeformat"));
    const missing = SUPPORTED_LANGUAGES.filter(
      (code) => !dataKeysFor(code).some((k) => have.has(k)),
    );

    // Missing data is not a crash. It is a date silently rendered in English
    // inside an otherwise translated screen, which is why it survived a year.
    expect(missing).toEqual([]);
  });

  it("has plural-rules data for every SUPPORTED_LANGUAGES entry", () => {
    const have = new Set(imported("intl-pluralrules"));
    const missing = SUPPORTED_LANGUAGES.filter(
      (code) => !dataKeysFor(code).some((k) => have.has(k)),
    );

    // No catalog uses i18next plural suffixes today, so this one is a
    // landmine rather than a live bug: it goes off the moment somebody adds a
    // `_one`/`_few` key in a language whose rules were never loaded.
    expect(missing).toEqual([]);
  });

  it("imports no locale data for a language the app does not ship", () => {
    const shipped = new Set(SUPPORTED_LANGUAGES.flatMap(dataKeysFor));
    const extra = [
      ...new Set([
        ...imported("intl-datetimeformat"),
        ...imported("intl-pluralrules"),
      ]),
    ].filter((key) => !shipped.has(key));

    // Each file is bundle weight paid on every launch, on a phone, for a
    // language nobody can select.
    expect(extra).toEqual([]);
  });
});
