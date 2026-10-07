import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Document, rootMetadata, rootViewport } from "@/components/document";
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
 * `isLocale` is re-checked here even though `page.tsx` sets
 * `dynamicParams = false` and returns only real locales. A layout renders
 * before the page it wraps, so without this an unexpected segment would reach
 * `<html lang>` before the page had a chance to 404.
 */

const pausedMode =
  LAUNCH.mode === "maintenance" || LAUNCH.mode === "coming-soon"
    ? LAUNCH.mode
    : null;

export const metadata: Metadata = pausedMode
  ? { ...rootMetadata, robots: { index: false, follow: false } }
  : rootMetadata;
export const viewport = rootViewport;

export default async function LocaleRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const displayLocale = pausedMode ? "en" : locale;

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
