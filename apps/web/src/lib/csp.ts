// Turnstile's widget script and its challenge iframe. Both must come from
// challenges.cloudflare.com un-proxied, per Cloudflare's docs.
const TURNSTILE = "https://challenges.cloudflare.com";

/**
 * Build the Content-Security-Policy.
 *
 * `script-src` includes `'unsafe-inline'` because Next inlines its hydration
 * payload in <script> tags. Removing it needs a per-request nonce, which needs
 * middleware — and this repo deliberately has none, because Next 16 made proxy
 * node-only and OpenNext support for it is an unmerged PR (see CON-24 notes).
 * So the realistic win here is origin restriction, not inline-script defence:
 * a third-party script injected from anywhere but Turnstile still fails.
 *
 * React's development build calls eval() to rebuild callstacks for its error
 * overlay, so `next dev` under this policy logs a CSP violation and loses its
 * stack traces. `'unsafe-eval'` is therefore allowed in development only.
 *
 * This lives in its own module so that branch is testable. A header that
 * quietly gains `'unsafe-eval'` in production is not the kind of thing that
 * should depend on someone reading the diff.
 */
export function buildContentSecurityPolicy(
  nodeEnv: string | undefined,
): string {
  const devOnlyEval = nodeEnv === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${devOnlyEval} ${TURNSTILE}`,
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
}

export function securityHeaders(
  nodeEnv: string | undefined,
): { key: string; value: string }[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(nodeEnv),
    },
    // Redundant with frame-ancestors for modern browsers, kept for old ones.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
    {
      // Two years, subdomains included. No `preload` directive: submitting to
      // the preload list is close to irreversible and should be a deliberate
      // act, not a side effect of adding headers.
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
  ];
}
