import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";
import nl from "../locales/nl.json";
import pl from "../locales/pl.json";
import ptBR from "../locales/pt-BR.json";
import sv from "../locales/sv.json";

export const SUPPORTED_LANGUAGES = [
  "en",
  "es",
  "nl",
  "de",
  "fr",
  "pt-BR",
  "sv",
  "pl",
] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_META: Record<SupportedLanguage, { nativeName: string }> =
  {
    en: { nativeName: "English" },
    es: { nativeName: "Español" },
    nl: { nativeName: "Nederlands" },
    de: { nativeName: "Deutsch" },
    fr: { nativeName: "Français" },
    "pt-BR": { nativeName: "Português (Brasil)" },
    sv: { nativeName: "Svenska" },
    pl: { nativeName: "Polski" },
  };

export function parseSupportedLanguage(
  value: unknown,
): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage)
    ? (value as SupportedLanguage)
    : null;
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
  const saved = parseSupportedLanguage(
    await AsyncStorage.getItem("appLanguage"),
  );
  const deviceCode = Localization.getLocales()[0]?.languageCode ?? "en";
  const deviceLang = SUPPORTED_LANGUAGES.find(
    (l) => l === deviceCode || l.startsWith(deviceCode),
  );
  const lng = saved ?? deviceLang ?? "en";

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      nl: { translation: nl },
      de: { translation: de },
      fr: { translation: fr },
      "pt-BR": { translation: ptBR },
      sv: { translation: sv },
      pl: { translation: pl },
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
