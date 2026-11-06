import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "../app/global-error";
import { buildContentSecurityPolicy } from "../lib/csp";
import { Document, rootViewport } from "./document";

vi.mock("next/font/google", () => ({
  Montserrat: () => ({ variable: "font-montserrat" }),
  Roboto_Mono: () => ({ variable: "font-roboto-mono" }),
}));

const markup = () =>
  renderToStaticMarkup(
    <Document locale="ja">
      <main id="theme-test-content">Content</main>
    </Document>,
  );

function bootstrap() {
  const html = markup();
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].find(
    (match) => match[1]?.includes("prefers-color-scheme: dark"),
  );
  const source = script?.[1];
  if (!source || script?.index == null)
    throw new Error("Missing the actual next-themes bootstrap");
  return { html, source, tag: script[0], offset: script.index };
}

function applyBeforeHydration(
  stored: string | null,
  dark: boolean,
  blocked = false,
) {
  const classes = new Set(["dark"]);
  const style = {
    colorScheme: "dark",
    backgroundColor: "var(--background, #000)",
  };
  runInNewContext(bootstrap().source, {
    document: {
      documentElement: {
        classList: {
          remove: (...names: string[]) =>
            names.forEach((name) => {
              classes.delete(name);
            }),
          add: (name: string) => classes.add(name),
        },
        style,
      },
    },
    localStorage: {
      getItem: (key: string) => {
        expect(key).toBe("theme");
        if (blocked) throw new Error("Storage denied");
        return stored;
      },
    },
    window: {
      matchMedia: (query: string) => {
        expect(query).toBe("(prefers-color-scheme: dark)");
        return { matches: dark };
      },
    },
  });
  return { classes: [...classes], style };
}

describe("website theme before hydration", () => {
  it("renders a dark variable-based canvas before external CSS or JavaScript", () => {
    const { html, tag, offset } = bootstrap();
    expect(html).toMatch(/<html[^>]*lang="ja"[^>]*dir="ltr"[^>]*class="dark"/);
    expect(html).toContain(
      "background-color:var(--background, #000);color-scheme:dark",
    );
    expect(offset).toBeLessThan(html.indexOf('id="theme-test-content"'));
    expect(tag).toContain('data-cfasync="false"');
    // The locale redirect stays first; theme resolution does not replace it.
    expect(html.indexOf("conpaws.locale")).toBeLessThan(offset);
    expect(buildContentSecurityPolicy("production")).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(buildContentSecurityPolicy("production")).not.toContain(
      "unsafe-eval",
    );
  });

  it.each([
    [null, false, "light"],
    [null, true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
    ["dark", false, "dark"],
    ["light", true, "light"],
  ] as const)(
    "resolves stored %s and system-dark %s to %s before content",
    (stored, dark, expected) => {
      const result = applyBeforeHydration(stored, dark);
      expect(result.classes).toEqual([expected]);
      expect(result.style.colorScheme).toBe(expected);
      expect(result.style.backgroundColor).toBe("var(--background, #000)");
    },
  );

  it("keeps the safe dark fallback if storage blocks the upstream bootstrap", () => {
    // next-themes 0.4.6 catches storage denial without applying a theme. Its
    // mounted provider later resolves system; this test makes no paint claim.
    const result = applyBeforeHydration(null, false, true);
    expect(result.classes).toEqual(["dark"]);
    expect(result.style.colorScheme).toBe("dark");
  });

  it("offers matching browser chrome colors for both system appearances", () => {
    expect(rootViewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ]);
  });

  it("keeps a dark canvas if the root layout itself fails", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalError, { error: new Error("test"), reset: () => {} }),
    );
    expect(html).toContain("background-color:var(--gx-background, #000)");
    expect(html).toContain("background:var(--gx-background, #000)");
    expect(html).toContain("@media (prefers-color-scheme: light)");
  });
});
