import { Document, rootMetadata, rootViewport } from "@/components/document";
import { DEFAULT_LOCALE } from "@/i18n/config";

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

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function MarketingRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <Document locale={DEFAULT_LOCALE}>{children}</Document>;
}
