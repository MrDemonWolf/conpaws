import { LOCALES, type Locale } from "@/i18n/config";
import { localeHref } from "@/i18n/routing";

/**
 * Language picker.
 *
 * A `<details>` rather than a `<select>` so it needs no JavaScript: the site is
 * statically rendered and this is the one control a visitor might reach for
 * before anything has hydrated — someone who cannot read the current language
 * is exactly the person who should not have to wait for a bundle.
 *
 * Every option is written in its own language. A list that says "German" and
 * "Japanese" in English is useless to the people trying to leave English.
 */
export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const active = LOCALES.find((l) => l.code === current) ?? LOCALES[0];

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border px-3 font-tech text-[11px] text-muted-foreground uppercase tracking-[0.16em] transition hover:text-primary [&::-webkit-details-marker]:hidden">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true">{active.nativeName}</span>
        <span
          aria-hidden="true"
          className="text-primary transition group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <nav
        aria-label={label}
        className="absolute right-0 z-30 mt-2 max-h-[60vh] w-[220px] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)]"
      >
        {LOCALES.map((locale) => (
          <a
            key={locale.code}
            href={localeHref(locale.code)}
            hrefLang={locale.code}
            lang={locale.code}
            aria-current={locale.code === current ? "true" : undefined}
            className={`block rounded-lg px-3 py-2 text-[13px] transition hover:bg-primary/10 hover:text-primary ${
              locale.code === current
                ? "bg-primary/10 text-primary"
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
