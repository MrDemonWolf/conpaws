import { describe, expect, it } from "vitest";
import { LOCALE_CODES } from "./config";
import { pickLocale } from "./negotiate";

const AVAILABLE = LOCALE_CODES as readonly string[];
const pick = (...preferred: string[]) => pickLocale(preferred, AVAILABLE);

describe("pickLocale", () => {
  it("takes an exact tag", () => {
    expect(pick("pt-BR")).toBe("pt-BR");
    expect(pick("es-ES")).toBe("es-ES");
    expect(pick("zh-CN")).toBe("zh-CN");
  });

  it("is case-insensitive, because browsers are inconsistent", () => {
    expect(pick("PT-br")).toBe("pt-BR");
    expect(pick("ES-es")).toBe("es-ES");
  });

  it("falls from a region to the bare language", () => {
    expect(pick("de-AT")).toBe("de");
    expect(pick("en-GB")).toBe("en");
    expect(pick("fr-CA")).toBe("fr");
    expect(pick("nb-NO")).toBe("nb");
  });

  it("honours order: the first preference that matches anything wins", () => {
    expect(pick("de-AT", "en-US")).toBe("de");
    expect(pick("xx", "en-US")).toBe("en");
    // A weaker match on an earlier tag still beats an exact match later —
    // that is what the browser's ordering means.
    expect(pick("de-AT", "pt-BR")).toBe("de");
  });

  // The whole reason the alias table exists. This site lists zh-TW before
  // zh-CN, so a plain `zh` resolved by list order alone would hand a
  // Simplified reader Traditional.
  it("resolves plain Chinese to Simplified, not to list order", () => {
    expect(pick("zh")).toBe("zh-CN");
    expect(pick("zh-Hans")).toBe("zh-CN");
    expect(pick("zh-Hans-CN")).toBe("zh-CN");
    expect(pick("zh-SG")).toBe("zh-CN");
  });

  it("resolves Traditional Chinese by script or territory", () => {
    expect(pick("zh-Hant")).toBe("zh-TW");
    expect(pick("zh-Hant-TW")).toBe("zh-TW");
    expect(pick("zh-HK")).toBe("zh-TW");
    expect(pick("zh-MO")).toBe("zh-TW");
  });

  it("maps every Norwegian spelling onto Bokmal", () => {
    // `no` and `nn` are not prefixes of `nb`, so without the alias table
    // nothing here would match at all.
    expect(pick("no")).toBe("nb");
    expect(pick("nn")).toBe("nb");
    expect(pick("nn-NO")).toBe("nb");
    expect(pick("nb")).toBe("nb");
  });

  it("sends unregioned Spanish and Portuguese to the larger variant", () => {
    expect(pick("es")).toBe("es-419");
    expect(pick("es-MX")).toBe("es-419");
    expect(pick("es-AR")).toBe("es-419");
    expect(pick("pt")).toBe("pt-BR");
    expect(pick("pt-AO")).toBe("pt-BR");
    // Spain and Portugal still get their own.
    expect(pick("es-ES")).toBe("es-ES");
    expect(pick("pt-PT")).toBe("pt-PT");
  });

  it("returns null when nothing matches, rather than guessing", () => {
    expect(pick("ar")).toBeNull();
    expect(pick("th-TH")).toBeNull();
    expect(pick()).toBeNull();
  });

  it("ignores junk entries instead of throwing on them", () => {
    expect(pick("", "de")).toBe("de");
    expect(pickLocale([null as unknown as string, "de"], AVAILABLE)).toBe("de");
  });

  // The function is serialised into an inline <head> script, so a stray
  // reference to anything in this module would only fail in the browser.
  it("is self-contained enough to survive toString()", () => {
    const source = pickLocale.toString();
    const rebuilt = new Function(`return (${source})`)() as typeof pickLocale;

    expect(rebuilt(["zh-Hant-TW"], AVAILABLE)).toBe("zh-TW");
    expect(rebuilt(["de-AT", "en"], AVAILABLE)).toBe("de");
    expect(rebuilt(["ar"], AVAILABLE)).toBeNull();
  });
});
