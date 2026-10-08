import type { Metadata } from "next";

import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { SITE_URL } from "@/lib/site";

/**
 * The social card. Link-preview scrapers (Facebook, LinkedIn, X, Slack,
 * Discord, iMessage) cache by URL, so replacing the file at this path does not
 * refresh a preview someone has already shared; re-scrape those by hand.
 */
export const OG_IMAGE_PATH = "/og.png";

// Root-layout defaults. Per-locale pages override title and description with
// their own catalog; these are the fallback for every route that does not,
// which is why they read the default catalog rather than being retyped.
const messages = getMessages(DEFAULT_LOCALE);

/**
 * Metadata every root layout shares.
 *
 * There is more than one root layout now (see `Document`), and these values —
 * `metadataBase`, the title template, the OG and Twitter cards — are about the
 * site rather than about a language. Duplicating them per layout is how the
 * `/ja` OG card would eventually end up pointing at a different image from the
 * `/` one for no reason anybody remembers.
 */
export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: messages.meta.title,
    template: messages.meta.titleTemplate,
  },
  description: messages.meta.description,
  openGraph: {
    type: "website",
    siteName: "ConPaws",
    title: messages.meta.title,
    description: messages.meta.description,
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: messages.meta.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: messages.meta.title,
    // The short form exists because Twitter truncates harder than OG does.
    description: messages.meta.descriptionShort,
    images: [OG_IMAGE_PATH],
  },
};
