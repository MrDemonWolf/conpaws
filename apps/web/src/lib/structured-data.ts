import { type Messages, parseInline } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { localeHref, publishedLocales } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/site";

/**
 * JSON-LD for the site.
 *
 * There was none at all, which for a pre-launch page is the expensive kind of
 * missing: the whole job of this site is being found, and structured data is
 * how a search engine learns that "ConPaws" is an app, that it is free, that
 * MrDemonWolf, Inc. publishes it, and what the answers to the six most common
 * questions are.
 *
 * Everything here is derived, never retyped. The FAQ entities read the same
 * `messages.faq.items` the accordion renders, so a translated answer and its
 * markup cannot disagree with the one Google is shown — which is both an SEO
 * requirement (structured data must match visible content) and the failure
 * mode a second hardcoded copy guarantees.
 *
 * Stable `@id`s tie the pieces together instead of repeating the publisher on
 * every node: the WebSite and the app both point at `#organization`, so a
 * consumer resolves one entity rather than three lookalikes.
 */

/** Schema.org node with an `@id` other nodes can reference. */
type Node = Record<string, unknown>;

const organizationId = absoluteUrl("/#organization");
const websiteId = absoluteUrl("/#website");
const applicationId = absoluteUrl("/#application");

/**
 * The publisher, and the only string on this page that is not translated.
 *
 * A registered company name is the same in every language — `footer.company`
 * happens to hold it too, but that is a catalog entry a translator can edit,
 * and a legal entity is not copy.
 */
const PUBLISHER_NAME = "MrDemonWolf, Inc.";
const PUBLISHER_URL = "https://www.mrdemonwolf.com";

export function organizationNode(): Node {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: PUBLISHER_NAME,
    url: PUBLISHER_URL,
    logo: absoluteUrl("/icon.svg"),
  };
}

export function webSiteNode(): Node {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    name: "ConPaws",
    url: absoluteUrl("/"),
    publisher: { "@id": organizationId },
    // Which translations exist, from the same list that drives hreflang and
    // the sitemap. No `potentialAction`: there is no site search to describe,
    // and claiming one that 404s is worse than claiming nothing.
    inLanguage: publishedLocales(),
  };
}

/**
 * The app itself.
 *
 * `offers` at 0 is a real claim and has to stay true — the FAQ says the
 * schedule, imports, reminders and offline mode are free, and this is the
 * other line that changes the day ConPaws+ has a price. There is deliberately
 * no `aggregateRating` and no `downloadUrl`: nothing has shipped, so there are
 * no ratings and no store listing, and inventing either is the kind of
 * structured data that gets a site's rich results turned off.
 */
export function softwareApplicationNode(
  locale: Locale,
  messages: Messages,
): Node {
  return {
    "@type": "SoftwareApplication",
    "@id": applicationId,
    name: "ConPaws",
    url: absoluteUrl(localeHref(locale)),
    description: messages.meta.description,
    applicationCategory: "TravelApplication",
    operatingSystem: "iOS, Android",
    inLanguage: locale,
    image: absoluteUrl("/og.png"),
    publisher: { "@id": organizationId },
    isPartOf: { "@id": websiteId },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/PreOrder",
    },
  };
}

/**
 * Strips the two-feature inline syntax the FAQ answers use.
 *
 * `parseInline` is the same function the accordion renders through, so the
 * text Google is given is exactly the text a reader sees — a link becomes its
 * label and a code span becomes its contents. Reimplementing the strip with a
 * regex here is how the two would eventually disagree.
 */
function plainText(input: string): string {
  return parseInline(input)
    .map((part) => part.value)
    .join("");
}

export function faqPageNode(messages: Messages): Node {
  return {
    "@type": "FAQPage",
    "@id": absoluteUrl("/#faq"),
    isPartOf: { "@id": websiteId },
    mainEntity: messages.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: plainText(item.a) },
    })),
  };
}

/** Wraps nodes in the `@graph` envelope a single script tag carries. */
export function graph(...nodes: Node[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
