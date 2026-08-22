import type { MetadataRoute } from "next";

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
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const legalDate = new Date(LEGAL_LAST_UPDATED);

  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    ...(LEGAL_PATHS.has(route.path) ? { lastModified: legalDate } : {}),
  }));
}
