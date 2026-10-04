# Public website launch

The public site remains Next.js on Cloudflare Workers. Mobile/admin prototypes and the isolated EmDash experiment are separate work.

## Launch switch

Edit apps/web/src/content/launch.ts. Keep mode set to waitlist until both store listings are publicly available. To launch, set mode to live and add the real HTTPS App Store and Google Play URLs. Missing URLs fail validation. A config edit requires a build and deployment; this is not an admin toggle.

Live mode replaces the signup form with store links, removes the launch-timing FAQ, changes closing CTA text, and updates app availability in structured data. Signup records and API data remain intact. Text store links are used until official localized badges are added.

## Release notes

Add published app releases to apps/web/src/content/changelog.ts with date, version, and changes. The updates page is English, like existing support/legal documents. Its navigation label is translated into all 23 supported languages. Do not describe unreleased features as published notes.

## Repeatable checks

From apps/web, run these commands in order:

1. bun run check-types
2. bun run test
3. bun run build:cloudflare
4. bunx opennextjs-cloudflare preview -- --port 8787
5. In another terminal from apps/web: bun scripts/e2e.ts http://127.0.0.1:8787

Use a preview without production secrets for the fail-closed test. The script refuses remote hosts to avoid creating live signup records.

Browser checks during this change cover 375px layout and overflow; English, German, Japanese, Latin American Spanish, Traditional Chinese, and Ukrainian metadata; FAQ expansion; updates navigation; language picker; and temporary live mode in English and German with fixture URLs. Live fixtures were restored to waitlist before building.

Browser checks do not submit a real signup or validate email delivery. Existing waitlist unit tests cover the mocked API flow.

## Static cache

OpenNext uses its read-only static-assets cache for prerendered public pages. The build:cloudflare command populates cache files before Alchemy uploads assets. This fixes translated pages returning 404 in the Worker without adding R2 or a revalidation queue. Public copy updates take effect after a build and deployment.
