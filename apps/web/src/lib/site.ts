import { env } from "@conpaws/env/web";

export const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

/**
 * True only when this deploy is serving the canonical domain.
 *
 * Preview deploys land on `*.workers.dev` with the same code, and a preview
 * that gets indexed competes with the real site for its own terms. `robots.ts`
 * reads this to fail closed: anything that is not conpaws.com asks not to be
 * crawled at all.
 */
export const IS_CANONICAL_HOST = new URL(SITE_URL).hostname === "conpaws.com";

export interface PublicRoute {
  path: string;
  /** Used as the link text in llms.txt. */
  title: string;
  /** One line, written for a reader who has not seen the page. */
  summary: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
  /** Omitted where we do not have an honest date — better absent than invented. */
  lastModified?: string;
}

/**
 * Every publicly indexable route.
 *
 * `sitemap.ts` and `llms.txt` both read this list, so a page cannot appear in
 * one and be missing from the other — which is the usual way these two drift.
 *
 * `/confirmed` is deliberately absent: it is `noindex` because it duplicates
 * landing-page copy and has no search value. `/api/*` is absent for the
 * obvious reason.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    path: "/",
    title: "ConPaws",
    summary:
      "What ConPaws is, who it is for, and the beta waitlist. The waitlist is currently closed.",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    summary:
      "What the app stores on your device, what the website collects, and what is never collected. The app is local-first and needs no account.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/terms",
    title: "Terms of Service",
    summary: "The terms covering use of the ConPaws app and website.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/support",
    title: "Support",
    summary: "How to get help with ConPaws, and where to report a problem.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
] as const;

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}
