import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Landing } from "@/components/landing";
import { getMessages } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import {
  languageAlternates,
  localeHref,
  prefixedLocales,
} from "@/i18n/routing";

/**
 * Landing page for every locale except the default.
 *
 * `dynamicParams = false` is load-bearing. Without it this dynamic segment
 * would match any single path segment, so `/nonsense` would render the English
 * fallback with a 200 instead of a 404 — a soft-404 on an unbounded number of
 * URLs, which is exactly what search engines penalise. With it, only the
 * locales returned by `generateStaticParams` exist and everything else 404s
 * through the normal not-found route.
 *
 * Static segments win over dynamic ones in the App Router, so `/privacy`,
 * `/confirmed` and `/api/*` keep resolving to their own routes and never reach
 * this one.
 */

export const dynamicParams = false;

export function generateStaticParams(): { locale: Locale }[] {
  return prefixedLocales().map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const messages = getMessages(locale);
  return {
    // See the note on the English route: the catalog title already carries the
    // brand, so the root layout's title template must not append it again.
    title: { absolute: messages.meta.title },
    description: messages.meta.description,
    alternates: {
      canonical: localeHref(locale),
      languages: languageAlternates(),
    },
    openGraph: {
      title: messages.meta.title,
      description: messages.meta.description,
      locale,
    },
  };
}

export default async function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <Landing locale={locale} messages={getMessages(locale)} />;
}
