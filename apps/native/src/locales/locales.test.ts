import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import en from "./en.json";

const dir = __dirname;
const appRoot = path.join(dir, "../..");

type Json = { [key: string]: Json | string };

function flatten(value: Json, prefix = ""): string[] {
  return Object.entries(value).flatMap(([k, v]) =>
    typeof v === "object" && v !== null
      ? flatten(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

const enKeys = flatten(en as unknown as Json);

const locales = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .map((f) => f.replace(/\.json$/, ""));

describe("locale catalogs", () => {
  it("ships more than just English", () => {
    expect(locales.length).toBe(22);
  });

  it.each(locales)("%s has exactly the same keys as en", (locale) => {
    const catalog = JSON.parse(
      readFileSync(path.join(dir, `${locale}.json`), "utf8"),
    ) as Json;
    expect(flatten(catalog).sort()).toEqual([...enKeys].sort());
  });
});

/**
 * Catches both directions of drift between the catalogs and the code.
 *
 * A key the code asks for and no catalog has renders as the raw dotted string
 * to the user — that shipped: `convention.scheduleUpdate.alsoMoved` was called
 * with `{ count }` while only `alsoMovedOne`/`alsoMovedMany` existed, so any
 * refresh that both moved and dropped saved panels printed the key itself.
 *
 * Keys nothing asks for are the cheaper direction: 38 of them (a whole removed
 * sign-in feature among them) sat translated into 23 languages.
 */
describe("catalog and code agree", () => {
  const source = execSync('find src app -name "*.ts" -o -name "*.tsx"', {
    cwd: appRoot,
    maxBuffer: 1e9,
  })
    .toString()
    .trim()
    .split("\n")
    .map((f) => readFileSync(path.join(appRoot, f), "utf8"))
    .join("\n");

  // Two scanners, because the two directions fail in opposite ways.
  //
  // A false positive in "unused" deletes a live string, so that direction is
  // permissive: any quoted occurrence anywhere counts as a use. Plenty of call
  // sites pick the key with a ternary inside t(), e.g.
  // `t(n === 1 ? "…movedOne" : "…movedMany")`, which no t(-anchored pattern
  // sees.
  //
  // A false positive in "missing" fails the build over a Sentry scope tag
  // ("import.apply") or a filename in a test ("import.tsx"), so that direction
  // is strict: only strings sitting directly in a t() call.
  const ANY_QUOTED = /["'`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g;
  const mentioned = new Set([...source.matchAll(ANY_QUOTED)].map((m) => m[1]));

  const T_CALL =
    /\bt\(\s*["'`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)["'`]/g;
  const called = new Set([...source.matchAll(T_CALL)].map((m) => m[1]));

  // `t(\`prefix.${expr}\`)` covers every key under that prefix.
  const DYNAMIC = /`([a-zA-Z][a-zA-Z0-9_.]*\.)\$\{/g;
  const dynamicPrefixes = [...source.matchAll(DYNAMIC)].map((m) => m[1]);

  const covered = (key: string) =>
    mentioned.has(key) || dynamicPrefixes.some((p) => key.startsWith(p));

  it("has no key the code never asks for", () => {
    expect(enKeys.filter((k) => !covered(k))).toEqual([]);
  });

  it("has no literal t() key missing from the catalog", () => {
    const known = new Set(enKeys);
    // Plural and context suffixes resolve from a base key at runtime.
    const resolves = (k: string) =>
      known.has(k) ||
      known.has(`${k}_one`) ||
      known.has(`${k}_other`) ||
      [...known].some((c) => c.startsWith(`${k}.`));
    expect([...called].filter((k) => !resolves(k))).toEqual([]);
  });
});
