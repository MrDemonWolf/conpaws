/**
 * ConPaws website service worker.
 *
 * Scope: make the marketing site readable with no connection. That is all it
 * does. There is no manifest and no install prompt, deliberately — ConPaws is
 * a native app shipping to the App Store and Play, and an installable web app
 * of the marketing page would put a second thing called ConPaws on someone's
 * home screen that is not the product.
 *
 * What offline actually gets you: the page renders. Signing up does not work,
 * because Turnstile and /api/waitlist both need the network. That is a real
 * limit, not a bug to fix later — a consent record cannot be written from a
 * cache.
 *
 * ---------------------------------------------------------------------------
 * KILL SWITCH — read this before debugging a stale page.
 *
 * A service worker is the one deploy you cannot take back with another deploy,
 * because the broken worker is what serves the fix. If this ever caches
 * something it should not, set ENABLED to false and deploy. On its next update
 * check the worker unregisters itself and wipes every cache it made, and the
 * site goes back to plain network. Browsers re-fetch this file on navigation
 * and at most every 24h, so recovery is bounded without asking anyone to clear
 * site data.
 * ---------------------------------------------------------------------------
 */

const ENABLED = true;

/**
 * Bump on every meaningful change to this file.
 *
 * `activate` deletes every cache whose name is not exactly this, so a bump is
 * also the way to discard a bad cache. The date is the change date, not the
 * deploy date — two changes in one day get a suffix.
 */
const CACHE = "conpaws-v1-2026-08-29";

/**
 * The bare minimum to render something useful with no network.
 *
 * Deliberately only the English landing page. Precaching all 23 would download
 * ~23 documents to a phone on convention wifi to serve a page the visitor
 * probably will not read in a language they did not pick. Locales are cached
 * as they are visited instead.
 */
const PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  if (!ENABLED) return;
  // Take over immediately rather than waiting for every tab to close. A worker
  // that waits is a worker that serves yesterday's bug for the rest of the
  // session.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // Individually, and tolerant: one 404 in this list must not abort the
      // whole install and leave the site with no worker at all.
      Promise.allSettled(PRECACHE.map((url) => cache.add(url))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (!ENABLED) {
        await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
        await self.registration.unregister();
        return;
      }
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith("conpaws-") && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Hashed build output. Content-addressed, so it can be cached indefinitely. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  if (!ENABLED) return;

  const { request } = event;

  // Only GET. A cached POST would mean a form submission that never left the
  // device but looked like it succeeded.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only. Turnstile's script and challenge must always hit the
  // network — a cached challenge is a broken challenge.
  if (url.origin !== self.location.origin) return;

  // Never touch the API. /api/waitlist writes a consent record and
  // /api/waitlist/count is a live number; both are wrong from a cache, and a
  // stale count on the badge is exactly the bug this site already had once.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else — documents included — is network-first. The copy on this
  // page changes often before launch, and a cache-first document would show
  // yesterday's wording to anyone who had visited before.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        // A navigation we have never seen — fall back to the English landing
        // page rather than the browser's offline error.
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
