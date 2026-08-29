import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

const localization = vi.hoisted(() => ({
  getLocales: vi.fn(() => [{ languageTag: "en-US", languageCode: "en" }]),
}));

const i18next = vi.hoisted(() => {
  const instance = {
    use: vi.fn(() => instance),
    init: vi.fn(
      async (_config: {
        lng?: string;
        fallbackLng?: string;
        resources?: Record<string, unknown>;
      }) => undefined,
    ),
    changeLanguage: vi.fn(async (_code: string) => undefined),
    language: "en",
    resolvedLanguage: "en",
  };
  return instance;
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));
vi.mock("expo-localization", () => localization);
vi.mock("i18next", () => ({ default: i18next }));
vi.mock("react-i18next", () => ({ initReactI18next: { type: "3rdParty" } }));

import {
  changeLanguage,
  initI18n,
  parseSupportedLanguage,
  resolveDeviceLocale,
  SUPPORTED_LANGUAGES,
} from "./i18n";

/** The language i18next was actually initialised with. */
function initialisedLanguage(): unknown {
  return i18next.init.mock.calls.at(-1)?.[0]?.lng;
}

async function resolve(saved: string | null, deviceTag: string | undefined) {
  asyncStorage.getItem.mockResolvedValueOnce(saved);
  localization.getLocales.mockReturnValueOnce(
    deviceTag === undefined
      ? []
      : [{ languageTag: deviceTag, languageCode: deviceTag.split("-")[0] }],
  );
  await initI18n();
  return initialisedLanguage();
}

describe("stored language validation", () => {
  it("accepts only a language this build actually ships", () => {
    for (const code of SUPPORTED_LANGUAGES) {
      expect(parseSupportedLanguage(code)).toBe(code);
    }
    // A code written by another build, a truncated write, or a hostile
    // backup must not become `i18n.language`.
    expect(parseSupportedLanguage("pt")).toBeNull();
    expect(parseSupportedLanguage("es")).toBeNull();
    expect(parseSupportedLanguage("klingon")).toBeNull();
    expect(parseSupportedLanguage("")).toBeNull();
    expect(parseSupportedLanguage(null)).toBeNull();
    expect(parseSupportedLanguage(42)).toBeNull();
  });
});

describe("resolveDeviceLocale", () => {
  it("takes an exact match on the full tag", () => {
    expect(resolveDeviceLocale("de")).toBe("de");
    expect(resolveDeviceLocale("pt-BR")).toBe("pt-BR");
    expect(resolveDeviceLocale("es-419")).toBe("es-419");
    expect(resolveDeviceLocale("zh-TW")).toBe("zh-TW");
  });

  it("maps bare base codes to their regional default", () => {
    expect(resolveDeviceLocale("es")).toBe("es-419");
    expect(resolveDeviceLocale("pt")).toBe("pt-BR");
    expect(resolveDeviceLocale("zh")).toBe("zh-CN");
  });

  it("sends only Spain to es-ES and every other Spanish region to es-419", () => {
    expect(resolveDeviceLocale("es-ES")).toBe("es-ES");
    expect(resolveDeviceLocale("es-MX")).toBe("es-419");
    expect(resolveDeviceLocale("es-AR")).toBe("es-419");
    expect(resolveDeviceLocale("es-US")).toBe("es-419");
  });

  it("sends only Portugal to pt-PT and every other Portuguese region to pt-BR", () => {
    expect(resolveDeviceLocale("pt-PT")).toBe("pt-PT");
    expect(resolveDeviceLocale("pt-AO")).toBe("pt-BR");
  });

  it("resolves Chinese by script, with region as the fallback signal", () => {
    expect(resolveDeviceLocale("zh-Hans")).toBe("zh-CN");
    expect(resolveDeviceLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(resolveDeviceLocale("zh-Hant")).toBe("zh-TW");
    expect(resolveDeviceLocale("zh-Hant-TW")).toBe("zh-TW");
    expect(resolveDeviceLocale("zh-HK")).toBe("zh-TW");
    expect(resolveDeviceLocale("zh-MO")).toBe("zh-TW");
    expect(resolveDeviceLocale("zh-SG")).toBe("zh-CN");
  });

  it("reads both written Norwegians as the Bokmål build", () => {
    expect(resolveDeviceLocale("nb")).toBe("nb");
    expect(resolveDeviceLocale("nb-NO")).toBe("nb");
    expect(resolveDeviceLocale("no")).toBe("nb");
    expect(resolveDeviceLocale("nn")).toBe("nb");
    expect(resolveDeviceLocale("nn-NO")).toBe("nb");
  });

  it("matches regional device tags of single-build languages by base code", () => {
    expect(resolveDeviceLocale("de-AT")).toBe("de");
    expect(resolveDeviceLocale("fr-CA")).toBe("fr");
    expect(resolveDeviceLocale("ja-JP")).toBe("ja");
  });

  it("returns null for a language this build does not ship", () => {
    expect(resolveDeviceLocale("th")).toBeNull();
    expect(resolveDeviceLocale("")).toBeNull();
    expect(resolveDeviceLocale(undefined)).toBeNull();
  });
});

describe("initial language resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localization.getLocales.mockReturnValue([
      { languageTag: "en-US", languageCode: "en" },
    ]);
  });

  it("takes an exact device match", async () => {
    await expect(resolve(null, "de")).resolves.toBe("de");
    await expect(resolve(null, "sv")).resolves.toBe("sv");
  });

  it("matches a bare device code to its regional build", async () => {
    // A Brazilian device may report "pt", not "pt-BR".
    await expect(resolve(null, "pt")).resolves.toBe("pt-BR");
    await expect(resolve(null, "es")).resolves.toBe("es-419");
  });

  it("resolves regional device tags through the explicit table", async () => {
    await expect(resolve(null, "es-MX")).resolves.toBe("es-419");
    await expect(resolve(null, "es-ES")).resolves.toBe("es-ES");
    await expect(resolve(null, "zh-Hant-TW")).resolves.toBe("zh-TW");
    await expect(resolve(null, "no")).resolves.toBe("nb");
  });

  it("falls back to English for a language this build does not ship", async () => {
    await expect(resolve(null, "th")).resolves.toBe("en");
  });

  it("falls back to English when the device reports no locale at all", async () => {
    await expect(resolve(null, undefined)).resolves.toBe("en");
  });

  it("lets a stored choice beat the device", async () => {
    await expect(resolve("sv", "de")).resolves.toBe("sv");
  });

  it('migrates the pre-split stored "es" to es-419', async () => {
    // Builds before the es-419/es-ES split stored "es". That choice must
    // keep meaning Spanish, even on a non-Spanish device.
    await expect(resolve("es", "fr")).resolves.toBe("es-419");
  });

  it("ignores a stored value that is not a shipped language", async () => {
    // Falling through to the device is the point: a junk value must not
    // strand the app on a language with no resources behind it.
    await expect(resolve("klingon", "fr")).resolves.toBe("fr");
    await expect(resolve("pt", "fr")).resolves.toBe("fr");
  });

  it("always registers every shipped language as a resource", async () => {
    await resolve(null, "en");
    const resources = i18next.init.mock.calls.at(-1)?.[0]?.resources ?? {};
    expect(Object.keys(resources).sort()).toEqual(
      [...SUPPORTED_LANGUAGES].sort(),
    );
    expect(i18next.init.mock.calls.at(-1)?.[0]?.fallbackLng).toBe("en");
  });

  // es, pt, and zh each ship two regional builds, so a bare prefix match
  // over SUPPORTED_LANGUAGES would depend on declaration order. The
  // resolver therefore carries an explicit per-language table; these two
  // assertions pin the defaults that table must preserve.
  it("keeps the regional defaults order-independent", async () => {
    await expect(resolve(null, "es")).resolves.toBe("es-419");
    await expect(resolve(null, "zh")).resolves.toBe("zh-CN");
  });
});

describe("changeLanguage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the choice before switching, so a relaunch keeps it", async () => {
    await changeLanguage("pl");

    expect(asyncStorage.setItem).toHaveBeenCalledWith("appLanguage", "pl");
    expect(i18next.changeLanguage).toHaveBeenCalledWith("pl");
    expect(asyncStorage.setItem.mock.invocationCallOrder[0]).toBeLessThan(
      i18next.changeLanguage.mock.invocationCallOrder[0],
    );
  });
});
