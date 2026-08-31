import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  fetchConfirmedCount,
  readListmonkConfig,
} from "../../../../lib/listmonk";

/**
 * Confirmed waitlist signups, for the badge number on the landing page.
 *
 * Public and unauthenticated on purpose — it publishes one integer that the
 * page already shows to every visitor. It deliberately exposes nothing else:
 * no addresses, no growth series, no unconfirmed total.
 *
 * Answers `{ count: null }` rather than `{ count: 0 }` whenever the number
 * cannot be established — no bindings, no listmonk configuration, or listmonk
 * unreachable. Zero is a claim ("nobody has signed up"); null is the absence of
 * one, and the badge falls back to its static number on null.
 *
 * Cached at the edge for five minutes. The badge is decorative, a stale count
 * costs nothing, and without this every page view would hit listmonk.
 */
export async function GET(request: Request) {
  // The edge cache keys on the full URL, and this handler ignores the request
  // entirely, so `?1`, `?2`, `?3` all missed and each issued a fresh
  // authenticated request to our own listmonk. A public URL that turns one
  // request into one upstream request is an amplifier, and the five-minute
  // cache above only ever protected well-behaved callers. Nothing legitimate
  // sends a query string here -- `badge-card.tsx` fetches the bare path -- so
  // refusing one costs nothing and collapses the whole class.
  if (new URL(request.url).search !== "") {
    return Response.json(
      { count: null },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let env: CloudflareEnv;
  try {
    env = getCloudflareContext().env;
  } catch {
    // No Worker context: local `next dev` without bindings, or a unit test.
    return unknown();
  }

  const config = readListmonkConfig(env);
  if (!config) return unknown();

  const count = await fetchConfirmedCount(config);
  if (count === null) return unknown();

  return Response.json(
    { count },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}

/** Cached briefly, so an outage does not pin the page to a stale answer. */
function unknown() {
  return Response.json(
    { count: null },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
