import type { Metadata } from "next";

import { Document, rootMetadata, rootViewport } from "@/components/document";
import { notFoundMetadata } from "@/components/not-found-page";
import { SiteModePage } from "@/components/site-mode-page";
import { LAUNCH } from "@/content/launch";
import { getMessages } from "@/i18n";
import { isLocale } from "@/i18n/config";

/**
 * Root layout for every translated landing page.
 *
 * The whole reason this file exists is `lang`. A layout only receives `params`
 * when it sits at or below the dynamic segment, and only a *root* layout may
 * render `<html>` — so the one place that can put the real locale on the root
 * element is a root layout underneath `[locale]`. Next allows more than one
 * root layout precisely for this, as long as no `app/layout.tsx` exists.
 *
 * The URLs do not move. `/` stays the English page and `/ja` stays `/ja`;
 * `(marketing)` is a route group and contributes nothing to the path. That was
 * the constraint that made this look unaffordable before — the alternative
 * reading of "restructure" is putting every route under `[locale]`, which
 * would drag `/privacy` to `/en/privacy` and throw away the indexing this
 * pre-launch site exists to earn.
 *
 * Unknown single-segment paths also match `[locale]`. Use English for their
 * error document so they keep the site's styling and fonts.
 */

const pausedMode =
  LAUNCH.mode === "maintenance" || LAUNCH.mode === "coming-soon"
    ? LAUNCH.mode
    : null;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return notFoundMetadata;
  return pausedMode
    ? { ...rootMetadata, robots: { index: false, follow: false } }
    : rootMetadata;
}
export const viewport = rootViewport;

export default async function LocaleRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const displayLocale = pausedMode || !isLocale(locale) ? "en" : locale;

  return (
    <Document locale={displayLocale}>
      {pausedMode ? (
        <SiteModePage
          mode={pausedMode}
          locale={displayLocale}
          messages={getMessages(displayLocale)}
        />
      ) : (
        children
      )}
    </Document>
  );
}
