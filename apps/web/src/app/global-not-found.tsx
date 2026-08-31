import { Document } from "@/components/document";
import { NotFoundPage, notFoundMetadata } from "@/components/not-found-page";
import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * The 404 for anything that matches no route at all.
 *
 * `global-not-found.tsx` renders its own `<html>`, the way `global-error.tsx`
 * does, because there is nothing above it to provide one: the site has two
 * root layouts (see `components/document.tsx`) and therefore no
 * `app/layout.tsx`, and a plain `not-found.tsx` in that arrangement is served
 * inside Next's bare error shell — no stylesheet, no fonts, no `lang`, the
 * page rendering as black text on white. It does not warn; verified by
 * probing `/foo/bar` before and after.
 *
 * Requires `experimental.globalNotFound` in next.config.ts. That is the
 * documented switch for this convention, not a workaround.
 *
 * English regardless of the URL, which is what a global 404 can honestly be:
 * there is no matched route, so there is no locale to read.
 */

export const metadata = notFoundMetadata;

export default function GlobalNotFound() {
  return (
    <Document locale={DEFAULT_LOCALE}>
      <NotFoundPage />
    </Document>
  );
}
