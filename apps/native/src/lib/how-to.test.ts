import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import {
  HOW_TO_GUIDES,
  HOW_TO_METHODS,
  IMPORT_HELP_METHODS,
  isHowToMethod,
} from "./how-to";

type Json = { [key: string]: Json | string };

function lookup(key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Json)[part] : undefined,
      en as unknown as Json,
    );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort();
}

/** i18next reads these from the options object instead of interpolating. */
const RESERVED = ["count", "context", "ns", "lng", "defaultValue"];

const guides = HOW_TO_METHODS.map(
  (method) => [method, HOW_TO_GUIDES[method]] as const,
);

describe("how-to guides", () => {
  it("offers the catalog, a Sched link and a calendar file, in that order", () => {
    expect(HOW_TO_METHODS).toEqual(["find", "sched", "ics"]);
  });

  // Find would mean closing the import sheet first, so the import help
  // offers only the two methods that end on the import screen itself.
  it("offers only the import methods from the import help", () => {
    expect(IMPORT_HELP_METHODS).toEqual(["sched", "ics"]);
  });

  it.each(guides)("%s has three or four steps with unique ids", (_m, guide) => {
    expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    expect(guide.steps.length).toBeLessThanOrEqual(4);
    const ids = guide.steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(guides)("%s names only English strings that exist", (_m, guide) => {
    const keys = [
      guide.title,
      guide.summary,
      guide.finishLabel,
      ...guide.steps.flatMap((step) => [step.title, step.body]),
    ];
    for (const key of keys) {
      expect(typeof lookup(key), key).toBe("string");
    }
  });

  it.each(guides)(
    "%s fills every placeholder with a real control's label",
    (_m, guide) => {
      for (const step of guide.steps) {
        const body = lookup(step.body) as string;
        const names = Object.keys(step.labels ?? {}).sort();
        expect(placeholders(body), step.body).toEqual(names);
        for (const [name, key] of Object.entries(step.labels ?? {})) {
          expect(RESERVED, `${step.body} {{${name}}}`).not.toContain(name);
          expect(typeof lookup(key), key).toBe("string");
        }
      }
    },
  );

  it("ends each walkthrough on the screen it teaches", () => {
    expect(HOW_TO_GUIDES.find.destination).toBe("/convention/find");
    expect(HOW_TO_GUIDES.sched.destination).toBe("/convention/new/import");
    expect(HOW_TO_GUIDES.ics.destination).toBe("/convention/new/import");
  });
});

describe("isHowToMethod", () => {
  it.each(HOW_TO_METHODS)("accepts %s", (method) => {
    expect(isHowToMethod(method)).toBe(true);
  });

  // The method arrives as a route param, so anything a deep link can carry.
  it.each([
    ["an empty string", ""],
    ["undefined", undefined],
    ["the wrong case", "FIND"],
    ["an array", ["find"]],
    ["a path", "../x"],
  ])("rejects %s", (_label, value) => {
    expect(isHowToMethod(value)).toBe(false);
  });
});
