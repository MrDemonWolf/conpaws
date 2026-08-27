import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

const localization = vi.hoisted(() => ({
  getLocales: vi.fn(() => [{ languageCode: "en" }]),
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
  SUPPORTED_LANGUAGES,
} from "./i18n";

/** The language i18next was actually initialised with. */
function initialisedLanguage(): unknown {
  return i18next.init.mock.calls.at(-1)?.[0]?.lng;
}

async function resolve(saved: string | null, deviceCode: string | undefined) {
  asyncStorage.getItem.mockResolvedValueOnce(saved);
  localization.getLocales.mockReturnValueOnce(
    deviceCode === undefined ? [] : [{ languageCode: deviceCode }],
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
    expect(parseSupportedLanguage("klingon")).toBeNull();
    expect(parseSupportedLanguage("")).toBeNull();
    expect(parseSupportedLanguage(null)).toBeNull();
    expect(parseSupportedLanguage(42)).toBeNull();
  });
});

describe("initial language resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localization.getLocales.mockReturnValue([{ languageCode: "en" }]);
  });

  it("takes an exact device match", async () => {
    await expect(resolve(null, "de")).resolves.toBe("de");
    await expect(resolve(null, "sv")).resolves.toBe("sv");
  });

  it("matches a bare device code to its regional build", async () => {
    // A Brazilian device reports "pt", not "pt-BR".
    await expect(resolve(null, "pt")).resolves.toBe("pt-BR");
  });

  it("falls back to English for a language this build does not ship", async () => {
    await expect(resolve(null, "ja")).resolves.toBe("en");
  });

  it("falls back to English when the device reports no locale at all", async () => {
    await expect(resolve(null, undefined)).resolves.toBe("en");
  });

  it("lets a stored choice beat the device", async () => {
    await expect(resolve("sv", "de")).resolves.toBe("sv");
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

  // The device match takes the FIRST entry whose code starts with the device's
  // bare code, so two regional builds of one language would make the result
  // depend on declaration order: adding "pt-PT" above "pt-BR" would silently
  // move every Brazilian device to European Portuguese. Keep the list free of
  // that ambiguity, or replace the prefix match with an explicit table.
  it("has no two languages sharing a base code", () => {
    const bases = SUPPORTED_LANGUAGES.map((code) => code.split("-")[0]);
    expect(new Set(bases).size).toBe(bases.length);
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
