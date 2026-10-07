import type { Metadata } from "next";

import { Landing } from "@/components/landing";
import { LAUNCH, launchForPreview } from "@/content/launch";
import { getMessages } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { languageAlternates } from "@/i18n/routing";

/**
 * The English landing page, served at `/`.
 *
 * English keeps the bare path and every other locale lives under `[locale]`.
 * See `src/i18n/routing.ts` for why: `/` is the URL this site has already been
 * indexed on, and moving it to `/en` for internal symmetry would throw that
 * away on a pre-launch page whose entire job is being found.
 *
 * Both routes render the same `<Landing>`; only the catalog differs.
 */

const messages = getMessages(DEFAULT_LOCALE);

const homeMetadata: Metadata = {
  // `absolute` because the catalog title already ends in the brand. The root
  // layout's `%s · ConPaws` template would otherwise render
  // "ConPaws — your furry convention companion · ConPaws".
  title: { absolute: messages.meta.title },
  description: messages.meta.description,
  alternates: {
    canonical: "/",
    languages: languageAlternates(),
  },
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}): Promise<Metadata> {
  const preview =
    (await searchParams).mode === "live" && LAUNCH.mode !== "live";
  return preview
    ? { ...homeMetadata, robots: { index: false, follow: false } }
    : homeMetadata;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const launch = launchForPreview((await searchParams).mode);
  return (
    <Landing
      locale={DEFAULT_LOCALE}
      messages={getMessages(DEFAULT_LOCALE, launch.mode)}
      launch={launch}
    />
  );
}
