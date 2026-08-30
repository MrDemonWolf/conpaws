/**
 * The locales ConPaws ships, as a plain list with no imports.
 *
 * This is deliberately separate from `i18n.ts`, which pulls in AsyncStorage,
 * expo-localization and i18next. `app.config.ts` is evaluated by Node at
 * prebuild time and cannot load any of those, so it needs a module it can
 * import without dragging the runtime in.
 *
 * Both readers matter. `i18n.ts` uses this to decide what the language picker
 * offers; `app.config.ts` uses it for `expo-localization`'s `supportedLocales`,
 * which becomes CFBundleLocalizations and is what the App Store listing
 * advertises. Those two drifted before -- the app offered 23 languages while
 * the listing claimed 8 -- which is the reason the list lives in one file.
 */
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
