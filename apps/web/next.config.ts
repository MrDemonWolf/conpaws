import { fileURLToPath } from "node:url";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import "@conpaws/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,

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

export default nextConfig;
