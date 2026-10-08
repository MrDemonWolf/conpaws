import type { Metadata } from "next";

import { Document, rootViewport } from "@/components/document";
import { SiteModePage } from "@/components/site-mode-page";
import { LAUNCH } from "@/content/launch";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { rootMetadata } from "@/lib/root-metadata";

/**
 * Root layout for the English routes: `/`, `/confirmed`, and the legal and
 * support pages nested below.
 *
 * This is a *root* layout — it renders `<html>` and `<body>` — and it is one
 * of two, the other being `app/[locale]/layout.tsx`. There is deliberately no
 * `app/layout.tsx` any more: a single root layout cannot see which locale is
 * being served, so it can only hardcode `lang`, which is what it did.
 *
 * Everything under this group is English by construction. The legal pages are
 * English-only MDX and the confirmation page reads the default catalog, so
 * `DEFAULT_LOCALE` here is a fact about the routes rather than a fallback.
 */

const pausedMode =
  LAUNCH.mode === "maintenance" || LAUNCH.mode === "coming-soon"
    ? LAUNCH.mode
    : null;

export const metadata: Metadata = pausedMode
  ? { ...rootMetadata, robots: { index: false, follow: false } }
  : rootMetadata;
export const viewport = rootViewport;

export default function MarketingRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Document locale={DEFAULT_LOCALE}>
      {pausedMode ? (
        <SiteModePage
          mode={pausedMode}
          locale={DEFAULT_LOCALE}
          messages={getMessages(DEFAULT_LOCALE)}
        />
      ) : (
        children
      )}
    </Document>
  );
}
