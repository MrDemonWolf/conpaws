import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/[locale]/page";
import { prefixedLocales } from "@/i18n/routing";
import { OG_IMAGE_PATH, rootMetadata } from "@/lib/root-metadata";

/**
 * A page's `openGraph` replaces the layout's rather than merging into it, so a
 * route that sets its own title and forgets to spread the shared card ships
 * with no `og:image` at all. That is how every translated landing page lost
 * its preview image while the English one kept it.
 */
describe("social card", () => {
  it("points at an image that exists in public/", () => {
    const file = fileURLToPath(
      new URL(`../../public${OG_IMAGE_PATH}`, import.meta.url),
    );
    expect(existsSync(file)).toBe(true);
  });

  it("is declared on the root metadata for both OG and Twitter", () => {
    expect(rootMetadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: OG_IMAGE_PATH, width: 1200, height: 630 }),
    ]);
    expect(rootMetadata.twitter?.images).toEqual([OG_IMAGE_PATH]);
  });

  it.each(prefixedLocales())(
    "is kept on the %s landing page",
    async (locale) => {
      const meta = await generateMetadata({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({}),
      });
      expect(meta.openGraph?.images).toEqual(rootMetadata.openGraph?.images);
      expect(meta.openGraph?.locale).toBe(locale);
    },
  );
});
