import { type NextRequest, NextResponse } from "next/server";

/**
 * Send `www.conpaws.com` to the apex.
 *
 * Both hostnames are attached to the Worker as custom domains
 * (`packages/infra/alchemy.run.ts`), so without this the same page answers on
 * two origins with no canonical tag — duplicate content, and two hostnames
 * splitting whatever ranking the site earns. `robots.txt` already declares
 * `Host: https://conpaws.com`, so apex was always the intended canonical; this
 * makes the server agree with it.
 *
 * 308 rather than 302: the move is permanent, and 308 keeps the method and body
 * intact, which a 301 does not guarantee. That matters for `POST /api/waitlist`
 * — a form posted to the www host must not silently become a GET.
 *
 * Kept as a redirect rather than a Cloudflare Redirect Rule on purpose. This
 * repo has already lost an afternoon to dashboard state disagreeing with
 * `alchemy.run.ts`; routing that lives in the repo is routing that gets
 * reviewed.
 *
 * This is `proxy.ts`, not `middleware.ts`: Next 16 renamed the convention and
 * warns on the old filename at build time. The exported function has to be
 * named `proxy` (or be the default export) to be picked up.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  if (host === "www.conpaws.com") {
    const url = new URL(request.url);
    url.host = "conpaws.com";
    url.protocol = "https:";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's own build output and the icons Next serves from
   * the app directory. Those are same-origin asset fetches; bouncing them
   * through a redirect costs a round trip and buys nothing.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)",
  ],
};
