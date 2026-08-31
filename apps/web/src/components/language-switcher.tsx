import { LOCALES, type Locale } from "@/i18n/config";
import { localeHref, publishedLocales } from "@/i18n/routing";

/**
 * Language picker.
 *
 * A `<details>` rather than a `<select>` so it needs no JavaScript to open:
 * the site is statically rendered and this is the one control a visitor might
 * reach for before anything has hydrated — someone who cannot read the current
 * language is exactly the person who should not have to wait for a bundle.
 *
 * The conventions this follows, because a language menu that invents its own
 * are worse than useless to someone who cannot read the page around it:
 *
 *   - A globe, which is the one symbol that means "language" without words.
 *   - Every option written in its own language. A list that says "German" and
 *     "Japanese" in English is no help to the people trying to leave English.
 *   - The current language named on the button and marked in the list.
 *   - `hreflang` on every option, so the link says what it leads to.
 *   - Closes on Escape and on a click outside.
 *
 * The last one and the remembering of a choice are not in this file: they need
 * event listeners, and this component deliberately does not hydrate. They live
 * in the inline script in `locale-detect.tsx`, which finds this menu by
 * `data-lang-menu` and each option by `data-locale`. Renaming either attribute
 * here silently disables both.
 */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const active = LOCALES.find((l) => l.code === current) ?? LOCALES[0];
  const published = new Set(publishedLocales());
  const menuLocales = LOCALES.filter((l) => published.has(l.code));

  return (
    <details className="group relative" data-lang-menu>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border px-3 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.16em] transition hover:text-primary [&::-webkit-details-marker]:hidden">
        <span className="sr-only">{label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-[15px] w-[15px] shrink-0 text-primary"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          {/* The two meridians that make a bare circle read as a globe. */}
          <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
        </svg>
        <span aria-hidden="true">{active.nativeName}</span>
        <span
          aria-hidden="true"
          className="text-primary transition group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      {/* A bare `z-10`, not one of the named page layers, because raising it
          here cannot work: the site nav around this is positioned, so it opens
          a stacking context and this menu can never climb out of it however
          high the number goes. It used to be `z-30` and still lost to the hero
          badge at `z-40` — on a phone the badge covered ten of the twenty-three
          options and swallowed their clicks. The fix is on the nav itself,
          which rises to `z-menu` while this is open. */}
      <nav
        aria-label={label}
        className="absolute right-0 z-10 mt-2 max-h-[60vh] w-[220px] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]"
      >
        {/* `publishedLocales()`, not LOCALES: `[locale]/page.tsx` sets
            `dynamicParams = false`, so a locale listed in config without a
            catalog is a hard 404 -- reached from the site's own menu, by
            exactly the visitor who cannot read the page they land on. This
            works today only because all 23 catalogs happen to exist. */}
        {menuLocales.map((locale) => (
          <a
            key={locale.code}
            href={localeHref(locale.code)}
            hrefLang={locale.code}
            lang={locale.code}
            data-locale={locale.code}
            aria-current={locale.code === current ? "true" : undefined}
            className={`block rounded-lg px-3 py-2 text-[13px] transition hover:bg-primary/10 hover:text-primary ${
              locale.code === current
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground"
            }`}
          >
            {locale.nativeName}
          </a>
        ))}
      </nav>
    </details>
  );
}
