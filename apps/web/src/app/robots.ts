import type { MetadataRoute } from "next";

import { absoluteUrl, IS_CANONICAL_HOST, SITE_URL } from "@/lib/site";

/**
 * Serves /robots.txt.
 *
 * Preview deploys run this same code on a `*.workers.dev` hostname. If one of
 * those gets crawled it competes with the real site for its own terms and can
 * outrank it, so anything that is not the canonical host asks to be left alone
 * entirely. Fail closed: an unrecognised host is treated as a preview.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_CANONICAL_HOST) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api/* has nothing to index and /confirmed is already noindex —
        // saying so here keeps crawlers from spending budget to find that out.
        disallow: ["/api/", "/confirmed"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
