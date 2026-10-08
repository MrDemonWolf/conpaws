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
 * Cached through the Cloudflare edge cache for five minutes. The badge is
 * decorative, so a stale count costs nothing.
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

  const cache = edgeCache();
  const cached = await cache?.match(request).catch(() => undefined);
  if (cached) return cached;

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

  const response = Response.json(
    { count },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
  await cache?.put(request, response.clone()).catch(() => undefined);
  return response;
}

/**
 * The Workers edge cache, when there is one. Best effort: the count is
 * decorative, so a missing or failing cache (local previews, OpenNext route
 * contexts without `caches.default`) must never turn into a 500.
 */
function edgeCache(): Cache | undefined {
  try {
    return (globalThis as { caches?: CacheStorage & { default?: Cache } })
      .caches?.default;
  } catch {
    return undefined;
  }
}

/** Cached briefly, so an outage does not pin the page to a stale answer. */
function unknown() {
  return Response.json(
    { count: null },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
