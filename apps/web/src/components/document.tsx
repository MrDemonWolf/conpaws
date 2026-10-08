import type { Viewport } from "next";
import { Montserrat, Roboto_Mono } from "next/font/google";

import { JsonLd } from "@/components/json-ld";
import { LocaleDetect } from "@/components/locale-detect";
import Providers from "@/components/providers";
import { ServiceWorker } from "@/components/service-worker";
import { type Locale, localeDir } from "@/i18n/config";
import { graph, organizationNode, webSiteNode } from "@/lib/structured-data";

// The global stylesheet lives with the <html> element it styles, not in each
// root layout. There is more than one root layout and the 404 renders with no
// root layout at all; importing it here is what makes "renders inside
// <Document>" and "is styled" the same statement.
import "../index.css";

// Subsets are wider than `latin` because the site ships in 23 locales.
// `latin-ext` carries Polish, Czech and Hungarian; `cyrillic` carries Russian
// and Ukrainian. Each subset is emitted as its own @font-face with its own
// unicode-range, so an English reader still downloads only the latin file —
// listing them costs nothing until someone needs the glyphs. Japanese, Chinese
// and Korean are not in these families at all and fall back to the system
// font, which is the right outcome: a CJK webfont is megabytes.
//
// Montserrat sets headings, body text and the badge; Roboto Mono sets
// technical micro-labels, times and badge numbers. Both are
// variable fonts, so no `weight` array — one file per subset covers the whole
// range and `font-bold` is a real weight rather than a synthesised one.
//
// The subset list is repeated rather than hoisted to a constant:
// next/font parses these calls at build time and rejects anything that is not
// a literal ("Font loader values must be explicitly written literals").
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export const rootViewport: Viewport = {
  themeColor: "#091533",
};

/**
 * The `<html>` document, shared by every root layout.
 *
 * `lang` is a parameter because it has to be: only the root layout renders
 * `<html>`, and a root layout that cannot see the locale can only hardcode
 * one. It hardcoded "en" for a long time, with the real locale set on a
 * `<div>` deep inside the page. That is valid HTML and screen readers do
 * honour the subtree, but the attribute browsers and crawlers read first is
 * the root one: Chrome and Safari offer to translate a Japanese page because
 * `<html lang>` disagrees with the text, and Google reads it as a
 * language signal alongside hreflang.
 *
 * The fix is two root layouts rather than one — `(marketing)` for the
 * English-only routes and `[locale]` for the translated landing pages — which
 * is why this component exists. Everything that used to sit in the single root
 * layout lives here, so the two cannot drift: one set of fonts, one set of
 * metadata, one body.
 *
 * `dir` comes from the locale table rather than being assumed. Every locale
 * shipped today is `ltr`, so this changes nothing now; it means the first RTL
 * language is a row in `i18n/config.ts` and not a bug report.
 */
export function Document({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <html lang={locale} dir={localeDir(locale)} suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${robotoMono.variable} font-sans antialiased`}
      >
        {/* First thing in the body so the language redirect is decided before
            anything paints. Everything below it is content. */}
        <LocaleDetect />
        {/* Who publishes this and what site it is -- true of every page,
            including the legal pages and the 404, which is why it lives in the
            document rather than on the landing page. The app and FAQ entities
            are page-scoped and emitted by <Landing>: structured data has to
            describe the page it is on, and /terms has no FAQ. */}
        <JsonLd data={graph(organizationNode(), webSiteNode())} />
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
