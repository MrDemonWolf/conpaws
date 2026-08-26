import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import "@conpaws/env/web";
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/csp";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  pageExtensions: ["ts", "tsx", "mdx"],
  env: {
    CONPAWS_RELEASE_SHA: process.env.GITHUB_SHA ?? "local",
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV),
      },
    ];
  },

  // Send www to the apex.
  //
  // Both hostnames are attached to the Worker as custom domains
  // (packages/infra/alchemy.run.ts), so without this the same page answers on
  // two origins with no canonical tag: duplicate content, and two hostnames
  // splitting whatever ranking the site earns. robots.txt already declares
  // `Host: https://conpaws.com`, so apex was always the intent.
  //
  // This was briefly a proxy.ts (Next 16's rename of middleware) and could not
  // stay one: opennextjs-cloudflare refuses to build a Node-runtime proxy —
  // "Node.js middleware is not currently supported" — and Next 16 defaults it
  // to Node. `next build` passes either way, so it is only the Worker build
  // that catches it. A static redirect needs no runtime at all, which makes
  // the whole question moot.
  //
  // permanent: true emits 308 rather than 301, so a POST to /api/waitlist from
  // the www host keeps its method and body instead of silently becoming a GET.
  async redirects() {
    const fromWww = [{ type: "host" as const, value: "www.conpaws.com" }];

    return [
      // The root is a separate rule on purpose. `:path*` matches zero or more
      // segments, but on an empty match Next emits the pattern rather than
      // substituting it, so `www.conpaws.com/` redirected to the literal
      // `https://conpaws.com/:path*` — a broken URL, on the one page that
      // matters most. Every non-empty path was fine, which is exactly what
      // makes it easy to miss.
      {
        source: "/",
        has: fromWww,
        destination: "https://conpaws.com/",
        permanent: true,
      },
      // `:path+` is one or more, so it can never take the empty match that
      // produced the bug above.
      {
        source: "/:path+",
        has: fromWww,
        destination: "https://conpaws.com/:path+",
        permanent: true,
      },
    ];
  },

  // Pin the workspace root. Without this, Turbopack scans upward, finds the
  // bun.lock of whichever checkout sits above (the main clone when running
  // from a git worktree), and roots there — which can resolve modules from
  // the wrong tree entirely.
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url)),
  },

  // Dev is served from a devbox and reached over the VPC, not localhost.
  // Next 16 rejects cross-origin dev asset/HMR requests unless the origin is
  // listed here, which shows up as a broken-looking page with no obvious cause.
  // `*.trycloudflare.com` covers quick tunnels (scripts/tunnel.sh style) for
  // previewing on a phone — the hostname is random every run, so it has to be
  // a wildcard. Dev-only; production never reads this.
  allowedDevOrigins: [
    "chicago-il-vpc-01.mrdemonwolf.com",
    "10.0.0.184",
    "localhost",
    "127.0.0.1",
    "*.trycloudflare.com",
  ],

  // Next streams metadata by default: body first, <meta> tags appended after.
  // Fine for browsers and JS-executing crawlers. For bots that do NOT run JS,
  // Next blocks and puts the tags in the initial <head> — but only for user
  // agents matching this regex.
  //
  // Next's default covers Discord, X, Slack, LinkedIn, Reddit, Bing, Google.
  // Telegram matches only by accident: its UA contains "TwitterBot".
  // Bluesky's `Cardyb` and Mastodon are absent, so they fetch the page, find
  // an empty <head>, and render a bare link with no preview card. It fails
  // silently — nobody notices until someone says the link "looks broken".
  //
  // This is Next's built-in list verbatim with `Cardyb|Mastodon` appended.
  // Do not trim it: dropping an entry silently breaks that platform's cards.
  // Source: next/dist/shared/lib/router/utils/html-bots.js (16.2.12).
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Cardyb|Mastodon/i,
};

// Must be called or Cloudflare bindings (D1, secrets) are absent in `next dev`.
initOpenNextCloudflareForDev();

const withMDX = createMDX({
  options: {
    // notes/legal.md uses GFM tables; plain CommonMark drops them.
    remarkPlugins: [["remark-gfm"]],
  },
});

export default withMDX(nextConfig);
