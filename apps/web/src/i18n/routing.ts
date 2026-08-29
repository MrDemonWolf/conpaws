import { DEFAULT_LOCALE, LOCALE_CODES, type Locale } from "./config";
import { translatedLocales } from "./index";

/**
 * URL shape, and why English has no prefix.
 *
 * English stays at `/` and every other locale gets `/<code>`. The alternative —
 * prefixing everything, so English becomes `/en` — is tidier to reason about
 * but throws away the indexing the site has already earned. conpaws.com is a
 * pre-launch page whose entire job is being found; moving its one ranked URL
 * to buy internal symmetry is a bad trade.
 *
 * The consequence to remember: `/` and `/en` are not both live. `/` is the
 * English page and `/en` does not exist, which is why `localeHref` special-
 * cases the default rather than templating every code.
 */
export function localeHref(locale: Locale, path = ""): string {
  const suffix = path && path !== "/" ? path : "";
  return locale === DEFAULT_LOCALE
    ? `/${suffix}`.replace(/\/$/, "") || "/"
    : `/${locale}${suffix}`;
}

/**
 * The locales that get a published URL, in `LOCALES` display order.
 *
 * Driven by which catalogs actually exist rather than by the full list, so a
 * locale is only ever advertised once there is something to read at the other
 * end.
 */
export function publishedLocales(): Locale[] {
  const translated = new Set(translatedLocales());
  return LOCALE_CODES.filter((code) => translated.has(code));
}

/** Locales other than the default, i.e. the ones `[locale]` actually serves. */
export function prefixedLocales(): Locale[] {
  return publishedLocales().filter((code) => code !== DEFAULT_LOCALE);
}

/**
 * `alternates` for Next metadata: every published locale plus `x-default`.
 *
 * `x-default` points at English because that is the page served when a
 * crawler has no better match, and omitting it makes Google pick one of the
 * regional variants arbitrarily.
 */
export function languageAlternates(path = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of publishedLocales()) {
    out[code] = localeHref(code, path);
  }
  out["x-default"] = localeHref(DEFAULT_LOCALE, path);
  return out;
}
