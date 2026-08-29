import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import cs from "../locales/cs.json";
import da from "../locales/da.json";
import de from "../locales/de.json";
import en from "../locales/en.json";
import es419 from "../locales/es-419.json";
import esES from "../locales/es-ES.json";
import fi from "../locales/fi.json";
import fr from "../locales/fr.json";
import hu from "../locales/hu.json";
import it from "../locales/it.json";
import ja from "../locales/ja.json";
import ko from "../locales/ko.json";
import ms from "../locales/ms.json";
import nb from "../locales/nb.json";
import nl from "../locales/nl.json";
import pl from "../locales/pl.json";
import ptBR from "../locales/pt-BR.json";
import ptPT from "../locales/pt-PT.json";
import ru from "../locales/ru.json";
import sv from "../locales/sv.json";
import uk from "../locales/uk.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";

export const SUPPORTED_LANGUAGES = [
  "en",
  "es-419",
  "es-ES",
  "pt-BR",
  "pt-PT",
  "ja",
  "zh-TW",
  "zh-CN",
  "ko",
  "de",
  "fr",
  "pl",
  "it",
  "nl",
  "ms",
  "sv",
  "da",
  "nb",
  "fi",
  "cs",
  "hu",
  "uk",
  "ru",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_META: Record<SupportedLanguage, { nativeName: string }> =
  {
    en: { nativeName: "English" },
    "es-419": { nativeName: "Español (Latinoamérica)" },
    "es-ES": { nativeName: "Español (España)" },
    "pt-BR": { nativeName: "Português (Brasil)" },
    "pt-PT": { nativeName: "Português (Portugal)" },
    ja: { nativeName: "日本語" },
    "zh-TW": { nativeName: "繁體中文" },
    "zh-CN": { nativeName: "简体中文" },
    ko: { nativeName: "한국어" },
    de: { nativeName: "Deutsch" },
    fr: { nativeName: "Français" },
    pl: { nativeName: "Polski" },
    it: { nativeName: "Italiano" },
    nl: { nativeName: "Nederlands" },
    ms: { nativeName: "Bahasa Melayu" },
    sv: { nativeName: "Svenska" },
    da: { nativeName: "Dansk" },
    nb: { nativeName: "Norsk bokmål" },
    fi: { nativeName: "Suomi" },
    cs: { nativeName: "Čeština" },
    hu: { nativeName: "Magyar" },
    uk: { nativeName: "Українська" },
    ru: { nativeName: "Русский" },
  };

/**
 * Codes written by older builds that no longer name a shipped locale.
 * "es" shipped before the es-419/es-ES split; a stored "es" must keep
 * resolving to Spanish instead of silently falling back to the device
 * language.
 */
const LEGACY_STORED_ALIASES: Record<string, SupportedLanguage> = {
  es: "es-419",
};

export function parseSupportedLanguage(
  value: unknown,
): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
    ? (value as SupportedLanguage)
    : null;
}

/**
 * Maps a device BCP 47 tag onto the locale this build ships.
 *
 * Three languages ship two regional builds each, so a bare prefix match
 * would depend on declaration order (see i18n.test.ts). The mapping is
 * explicit instead: es → es-419 unless the region is Spain, pt → pt-BR
 * unless the region is Portugal, and Chinese resolves by script — Hant
 * (or the traditional-script regions TW/HK/MO) → zh-TW, everything else
 * → zh-CN. Both written Norwegians (no/nn) read the Bokmål build.
 */
export function resolveDeviceLocale(
  tag: string | null | undefined,
): SupportedLanguage | null {
  if (!tag) return null;
  const subtags = tag
    .replace(/_/g, "-")
    .split("-")
    .map((part) => part.toLowerCase());
  const [base, ...rest] = subtags;

  const exact = SUPPORTED_LANGUAGES.find(
    (code) => code.toLowerCase() === subtags.join("-"),
  );
  if (exact) return exact;

  switch (base) {
    case "es":
      return rest.includes("es") ? "es-ES" : "es-419";
    case "pt":
      return rest.includes("pt") ? "pt-PT" : "pt-BR";
    case "zh":
      return rest.some((part) => ["hant", "tw", "hk", "mo"].includes(part))
        ? "zh-TW"
        : "zh-CN";
    case "no":
    case "nn":
    case "nb":
      return "nb";
    default:
      return (
        SUPPORTED_LANGUAGES.find((code) => code.split("-")[0] === base) ?? null
      );
  }
}

/**
 * The one spelling of "the current locale", for formatters as well as text.
 *
 * `i18n.language` is what was asked for and `i18n.resolvedLanguage` is what
 * i18next actually has resources for. They differ after a stored language is
 * dropped from a build, and mixing the two spellings across screens rendered
 * the same dates in two languages at once.
 */
export function currentLocale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? "en";
}

export async function initI18n(): Promise<void> {
  const stored = await AsyncStorage.getItem("appLanguage");
  const saved =
    parseSupportedLanguage(stored) ??
    (typeof stored === "string"
      ? (LEGACY_STORED_ALIASES[stored] ?? null)
      : null);
  const deviceLocale = Localization.getLocales()[0];
  const deviceTag = deviceLocale?.languageTag ?? deviceLocale?.languageCode;
  const lng = saved ?? resolveDeviceLocale(deviceTag) ?? "en";

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      "es-419": { translation: es419 },
      "es-ES": { translation: esES },
      "pt-BR": { translation: ptBR },
      "pt-PT": { translation: ptPT },
      ja: { translation: ja },
      "zh-TW": { translation: zhTW },
      "zh-CN": { translation: zhCN },
      ko: { translation: ko },
      de: { translation: de },
      fr: { translation: fr },
      pl: { translation: pl },
      it: { translation: it },
      nl: { translation: nl },
      ms: { translation: ms },
      sv: { translation: sv },
      da: { translation: da },
      nb: { translation: nb },
      fi: { translation: fi },
      cs: { translation: cs },
      hu: { translation: hu },
      uk: { translation: uk },
      ru: { translation: ru },
    },
    lng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });
}

export async function changeLanguage(code: SupportedLanguage): Promise<void> {
  await AsyncStorage.setItem("appLanguage", code);
  await i18n.changeLanguage(code);
}

export default i18n;
