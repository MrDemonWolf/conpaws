import type { MetadataRoute } from "next";

import { languageAlternates, prefixedLocales } from "@/i18n/routing";
import { LEGAL_LAST_UPDATED } from "@/lib/constants";
import { absoluteUrl, PUBLIC_ROUTES } from "@/lib/site";

const LEGAL_PATHS = new Set(["/privacy", "/terms", "/support"]);

/**
 * Serves /sitemap.xml from the same route list llms.txt reads.
 *
 * `lastModified` is only set where we actually know it — the legal pages carry
 * a real reviewed date. The landing page gets none rather than a build
 * timestamp, which would claim the content changed every time we deployed and
 * teach crawlers to ignore the field.
 *
 * The landing page is emitted once per translated locale, and every one of
 * those entries carries the *same* full `alternates.languages` map. That
 * repetition is the specification, not an oversight: hreflang annotations have
 * to be reciprocal, and a set where `/de` points at `/` but `/` does not point
 * back at `/de` is discarded wholesale by Google rather than partially honoured.
 *
 * Only the landing page is translated. The legal pages are English-only MDX
 * documents, so they appear once and carry no language alternates — claiming
 * alternates that do not exist is worse than claiming none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const legalDate = new Date(LEGAL_LAST_UPDATED);
  const alternates = { languages: languageAlternates() };

  const entries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    ...(LEGAL_PATHS.has(route.path) ? { lastModified: legalDate } : {}),
    ...(route.path === "/" ? { alternates } : {}),
  }));

  const landing = PUBLIC_ROUTES.find((route) => route.path === "/");
  if (!landing) return entries;

  for (const locale of prefixedLocales()) {
    entries.push({
      url: absoluteUrl(`/${locale}`),
      changeFrequency: landing.changeFrequency,
      // Slightly below the English page. They are the same content in
      // different languages, and the default locale is the one to prefer when
      // a crawler has no signal either way.
      priority: 0.9,
      alternates,
    });
  }

  return entries;
}
