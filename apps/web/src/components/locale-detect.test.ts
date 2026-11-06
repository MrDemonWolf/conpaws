import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LocaleDetect, storedLocaleTarget } from "./locale-detect";

describe("storedLocaleTarget", () => {
  const available = ["en", "es-419", "pt-BR"];

  it("returns a valid stored choice", () => {
    expect(storedLocaleTarget("pt-BR", available)).toBe("pt-BR");
  });

  it("ignores missing and unpublished choices", () => {
    expect(storedLocaleTarget(null, available)).toBeNull();
    expect(storedLocaleTarget("fr", available)).toBeNull();
  });
});

function runLocaleScript(stored: string | null) {
  const handlers = new Map<string, (event: unknown) => void>();
  const focus = vi.fn();
  const language = { open: true, querySelector: () => ({ focus }) };
  const html = renderToStaticMarkup(createElement(LocaleDetect));
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!script) throw new Error("Missing locale script");
  runInNewContext(script, {
    localStorage: { getItem: () => stored, setItem: vi.fn() },
    navigator: { languages: ["en"], onLine: true },
    location: { pathname: "/", search: "", hash: "", replace: vi.fn() },
    document: {
      documentElement: { lang: "en" },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      querySelector: () => (language.open ? language : null),
      querySelectorAll: () => [],
    },
  });
  return { handlers, language, focus };
}

describe("locale disclosure dismissal", () => {
  it("installs dismissal handlers for a returning English visitor", () => {
    const { handlers } = runLocaleScript("en");
    expect(handlers.has("click")).toBe(true);
    expect(handlers.has("keydown")).toBe(true);
  });

  it("consumes Escape so closing the language picker does not cancel its dialog", () => {
    const { handlers, language, focus } = runLocaleScript(null);
    const preventDefault = vi.fn();
    handlers.get("keydown")?.({ key: "Escape", preventDefault });
    expect(language.open).toBe(false);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
  });
});
