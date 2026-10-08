import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCH } from "../content/launch";
import { getMessages, parseInline, translatedLocales } from "./index";
import en from "./messages/en.json";

/**
 * `parseInline` turns translator-supplied strings into `href` attributes, which
 * makes it the one place on the site where copy becomes markup. It had no tests.
 */
describe("parseInline", () => {
  it("returns plain text unchanged", () => {
    expect(parseInline("no markup here")).toEqual([
      { kind: "text", value: "no markup here" },
    ]);
  });

  it("parses a link and keeps the surrounding text", () => {
    expect(parseInline("see [docs](https://conpaws.com/privacy) now")).toEqual([
      { kind: "text", value: "see " },
      {
        kind: "link",
        value: "docs",
        href: "https://conpaws.com/privacy",
      },
      { kind: "text", value: " now" },
    ]);
  });

  it("parses inline code", () => {
    expect(parseInline("an `.ics` file")).toEqual([
      { kind: "text", value: "an " },
      { kind: "code", value: ".ics" },
      { kind: "text", value: " file" },
    ]);
  });

  it("refuses a javascript: href, leaving it as literal text", () => {
    // The whole reason INLINE_RE requires https?:// — a translator (or anyone
    // who can edit a catalog) must not be able to introduce a script URL.
    const parts = parseInline("[click](javascript:alert(1))");
    expect(parts.every((part) => part.kind === "text")).toBe(true);
    expect(parts.map((p) => p.value).join("")).toBe(
      "[click](javascript:alert(1))",
    );
  });

  it("refuses data: and relative hrefs the same way", () => {
    for (const input of ["[x](data:text/html,<script>)", "[x](/local)"]) {
      expect(parseInline(input).every((part) => part.kind === "text")).toBe(
        true,
      );
    }
  });

  it("returns a mangled bracket as visible text rather than a broken link", () => {
    expect(parseInline("[unclosed(https://conpaws.com)")).toEqual([
      { kind: "text", value: "[unclosed(https://conpaws.com)" },
    ]);
  });
});

describe("live launch copy", () => {
  it("keeps localized download labels and removes the launch question by ID", () => {
    const previousMode = LAUNCH.mode;
    const previousItems = en.faq.items;
    try {
      LAUNCH.mode = "live";
      en.faq.items = [...previousItems].reverse();
      for (const locale of translatedLocales()) {
        const messages = getMessages(locale);
        expect(messages.faq.items).toHaveLength(5);
        expect(
          messages.faq.items.some((item) => item.id === "launch-timing"),
        ).toBe(false);
        expect(messages.cta.button).toBe(messages.steps.items[0]?.title);
        expect(messages.cta.body).toBe(messages.waitlist.body);
      }
    } finally {
      LAUNCH.mode = previousMode;
      en.faq.items = previousItems;
    }
  });
});

/**
 * `CATALOGS` is typed `Partial<Record<Locale, unknown>>`, so a locale file that
 * drops a key or shortens a content array type-checks fine and is silently
 * backfilled from English by `deepMerge` at runtime. This is the only thing
 * that notices.
 */
describe("catalog parity", () => {
  const flatten = (value: unknown, prefix = ""): string[] => {
    if (Array.isArray(value)) {
      return value.flatMap((v, i) => flatten(v, `${prefix}[${i}]`));
    }
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([k, v]) =>
        flatten(v, prefix ? `${prefix}.${k}` : k),
      );
    }
    return [prefix];
  };

  const expected = flatten(en);
  // Read from disk, not through getMessages: deepMerge backfills English for
  // any key a catalog is missing, so the merged output can never disagree.
  // The drift only exists in the files.
  const dir = path.join(__dirname, "messages");
  const locales = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "en.json")
    .map((f) => f.replace(/\.json$/, ""));

  it("has more than one catalog to compare", () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  it("has removed the unused nav.established key from every catalog", () => {
    expect(flatten(en)).not.toContain("nav.established");
    for (const locale of locales) {
      const catalog = JSON.parse(
        readFileSync(path.join(dir, `${locale}.json`), "utf8"),
      );
      expect(flatten(catalog)).not.toContain("nav.established");
    }
  });

  it("uses word-order-neutral copyright copy in CJK catalogs", () => {
    for (const locale of ["ja", "ko", "zh-CN", "zh-TW"]) {
      const catalog = JSON.parse(
        readFileSync(path.join(dir, `${locale}.json`), "utf8"),
      );
      expect(catalog.footer.copyright).toBe("© {year} ConPaws");
    }
  });

  it.each(locales)("%s has the same keys and array lengths as en", (locale) => {
    const catalog = JSON.parse(
      readFileSync(path.join(dir, `${locale}.json`), "utf8"),
    );
    expect(flatten(catalog)).toEqual(expected);
  });

  it("falls back to English for an unknown locale", () => {
    expect(getMessages("en").meta.title).toBe(en.meta.title);
  });
});
