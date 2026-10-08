import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/landing";
import { LAUNCH, launchForPreview } from "@/content/launch";
import { getMessages } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import {
  languageAlternates,
  localeHref,
  prefixedLocales,
} from "@/i18n/routing";
import { rootMetadata } from "@/lib/root-metadata";

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const messages = getMessages(locale);
  const preview =
    (await searchParams).mode === "live" && LAUNCH.mode !== "live";
  return {
    // See the note on the English route: the catalog title already carries the
    // brand, so the root layout's title template must not append it again.
    title: { absolute: messages.meta.title },
    description: messages.meta.description,
    alternates: {
      canonical: localeHref(locale),
      languages: languageAlternates(),
    },
    // A page's `openGraph` replaces the layout's wholesale rather than merging
    // into it, so spread the shared card or this route drops its image, type and
    // site name — `/ja` once shipped with no `og:image` at all.
    openGraph: {
      ...rootMetadata.openGraph,
      title: messages.meta.title,
      description: messages.meta.description,
      url: localeHref(locale),
      locale,
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function LocaleHome({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const launch = launchForPreview((await searchParams).mode);
  return (
    <Landing
      locale={locale}
      messages={getMessages(locale, launch.mode)}
      launch={launch}
    />
  );
}
