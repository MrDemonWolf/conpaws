/**
 * Locale configuration for the website.
 *
 * These are the same 23 locales the app ships in `apps/native/src/locales/`.
 * Keep the two lists in step: a language offered in one surface and not the
 * other is worse than not offering it at all, because a visitor who reads the
 * site in Polish and then downloads an English-only app has been misled.
 *
 * Codes are BCP-47. Two are deliberate and easy to "correct" wrongly:
 *   - `es-419` is the UN M49 region for Latin America, not a country. It is
 *     the right code for "Spanish, not Spain" and must not become `es-MX`.
 *   - `nb` is Bokmål specifically. The macrolanguage `no` is ambiguous between
 *     Bokmål and Nynorsk and search engines treat it inconsistently.
 *
 * There is no i18n library here on purpose. The site is a landing page with a
 * flat string catalog, no plurals, no date or number formatting, and no
 * runtime locale negotiation. `next-intl` would add a middleware layer, and
 * middleware is the part most likely to behave differently under the OpenNext
 * Cloudflare adapter with Next pinned at 16.2.12. If this site ever grows
 * plurals or formatted dates, revisit — that is when a library starts paying
 * for itself.
 */

export const DEFAULT_LOCALE = "en" as const;

/**
 * `nativeName` is what the language switcher shows. A locale list written in
 * the *current* language ("German", "Japanese") is useless to someone who
 * cannot read the current language — the whole point is that they are trying
 * to leave it.
 */
export const LOCALES = [
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "es-419", nativeName: "Español (Latinoamérica)", dir: "ltr" },
  { code: "es-ES", nativeName: "Español (España)", dir: "ltr" },
  { code: "pt-BR", nativeName: "Português (Brasil)", dir: "ltr" },
  { code: "pt-PT", nativeName: "Português (Portugal)", dir: "ltr" },
  { code: "ja", nativeName: "日本語", dir: "ltr" },
  { code: "zh-TW", nativeName: "繁體中文", dir: "ltr" },
  { code: "zh-CN", nativeName: "简体中文", dir: "ltr" },
  { code: "ko", nativeName: "한국어", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
  { code: "fr", nativeName: "Français", dir: "ltr" },
  { code: "pl", nativeName: "Polski", dir: "ltr" },
  { code: "it", nativeName: "Italiano", dir: "ltr" },
  { code: "nl", nativeName: "Nederlands", dir: "ltr" },
  { code: "ms", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "sv", nativeName: "Svenska", dir: "ltr" },
  { code: "da", nativeName: "Dansk", dir: "ltr" },
  { code: "nb", nativeName: "Norsk bokmål", dir: "ltr" },
  { code: "fi", nativeName: "Suomi", dir: "ltr" },
  { code: "cs", nativeName: "Čeština", dir: "ltr" },
  { code: "hu", nativeName: "Magyar", dir: "ltr" },
  { code: "uk", nativeName: "Українська", dir: "ltr" },
  { code: "ru", nativeName: "Русский", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const LOCALE_CODES: readonly Locale[] = LOCALES.map((l) => l.code);

export function isLocale(value: string): value is Locale {
  return (LOCALE_CODES as readonly string[]).includes(value);
}

/**
 * Writing direction for `<html dir>`.
 *
 * Every locale in the table is `ltr` today, so this returns the same answer
 * every time. It exists so that adding an RTL language is a row in `LOCALES`
 * and nothing else — the alternative is `dir="ltr"` written literally in the
 * document shell, which is the kind of correct-until-it-isn't that nobody
 * thinks to grep for.
 */
export function localeDir(locale: Locale): "ltr" | "rtl" {
  return LOCALES.find((entry) => entry.code === locale)?.dir ?? "ltr";
}
