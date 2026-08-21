import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import "@conpaws/env/web";
import type { NextConfig } from "next";

// Turnstile's widget script and its challenge iframe. Both must come from
// challenges.cloudflare.com un-proxied, per Cloudflare's docs.
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Content-Security-Policy.
 *
 * `script-src` includes `'unsafe-inline'` because Next inlines its hydration
 * payload in <script> tags. Removing it needs a per-request nonce, which needs
 * middleware — and this repo deliberately has none, because Next 16 made proxy
 * node-only and OpenNext support for it is an unmerged PR (see CON-24 notes).
 * So the realistic win here is origin restriction, not inline-script defence:
 * a third-party script injected from anywhere but Turnstile still fails.
 *
 * `'wasm-unsafe-eval'` is required by the Rapier physics badge on the landing
 * page. Without it the badge silently fails to start.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  `frame-src ${TURNSTILE}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Redundant with frame-ancestors for modern browsers, kept for old ones.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Two years, subdomains included. No `preload` directive: submitting to the
    // preload list is close to irreversible and should be a deliberate act,
    // not a side effect of adding headers.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  pageExtensions: ["ts", "tsx", "mdx"],
  env: {
    CONPAWS_RELEASE_SHA: process.env.GITHUB_SHA ?? "local",
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
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
