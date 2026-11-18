import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "./supported-locales";

/**
 * `app.config.ts` carries its own copy of this list because Expo transpiles that
 * file in isolation and cannot resolve a relative TypeScript import from it.
 * A duplicated list is only safe if something fails when the copies diverge --
 * they already had, with the config declaring 8 locales while the app shipped
 * 23, so CFBundleLocalizations under-reported the App Store listing.
 */
function readConfigLocales(): string[] {
  const source = readFileSync(
    path.join(__dirname, "../../app.config.ts"),
    "utf8",
  );
  const match = source.match(/const SUPPORTED_LOCALES = \[([\s\S]*?)\];/);
  if (!match) throw new Error("No SUPPORTED_LOCALES literal in app.config.ts");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("supported locales", () => {
  it("matches the list app.config.ts writes into CFBundleLocalizations", () => {
    expect(readConfigLocales()).toEqual([...SUPPORTED_LANGUAGES]);
  });

  it("matches the Watch app's CFBundleLocalizations", () => {
    // The Watch target's Info.plist is written by hand, not by Expo, so the
    // system text it draws (a dialog's Cancel, a spinner's label) follows
    // the same languages only while this list is kept in step.
    const plist = readFileSync(
      path.join(__dirname, "../../targets/watch/Info.plist"),
      "utf8",
    );
    const array = plist.match(
      /<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );
    if (!array) throw new Error("No CFBundleLocalizations in the Watch plist");
    expect(
      [...array[1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]),
    ).toEqual([...SUPPORTED_LANGUAGES]);
  });

  it("has a locale JSON file for every entry", () => {
    for (const locale of SUPPORTED_LANGUAGES) {
      const file = path.join(__dirname, `../locales/${locale}.json`);
      expect(() => readFileSync(file, "utf8")).not.toThrow();
    }
  });
});
