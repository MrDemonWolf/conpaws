# ConPaws - Pre-Release Site (conpaws.com)

Decision record for the pre-release marketing site. This captures what was settled and **why**, so the choices don't get re-litigated — and, for the version pins, exactly when it's safe to bump.

---

## TL;DR

- **Domain:** `conpaws.com` is canonical. `conpaws.app` is retired (removed from `app.config.ts`).
- **Architecture:** One Cloudflare Worker, one domain, `apps/web`. No `app.` split. Future `/@handle` profiles are Next.js SSR, not Expo Web.
- **Stack:** Next `16.2.12` (EXACT pin), `@opennextjs/cloudflare@1.20.2` (EXACT pin), `wrangler 4.86.0`. Never `@cloudflare/next-on-pages` (archived).
- **Deploy:** GitHub Actions gated on lint/type-check/test; hand-written `wrangler.jsonc`. Alchemy rejected.
- **ESP:** Brevo, with a mandatory unsubscribe-scope test before building on it. Mailjet is the fallback.
- **Waitlist:** D1 is the source of truth with full consent-record columns; Brevo's DOI endpoint owns confirmation tokens; `ctx.waitUntil` + a cron reconciler are both required.
- **Badge:** headless Rapier2D physics + SVG + DOM. WebGL removed after real context-loss failures.
- **CMS:** none in Phase 1; Sveltia in Phase 2 (remember `skip_ci: false`).

---

## Domain

`conpaws.com` — every planning and legal doc already used it; `conpaws.app` in `app.config.ts` and `DEPLOY_WEB.md` was the outlier and has been corrected. Universal links (`associatedDomains`) now point at `conpaws.com`; serving AASA/assetlinks is deferred until profile pages exist.

## One Worker, no app. split

No browser app exists, and profile pages want the apex domain for OG unfurls and universal links. Route groups (`(marketing)/`, `(public)/`) exist from day one so a later split is a move, not a rewrite.

**Profile pages will be Next.js SSR, not Expo Web** (scored 48/60 vs 25/60):

- Expo SDK 55's `web.output: "server"` is alpha, and per-request `generateMetadata` is SDK 56+. `output: "static"` can't render per-request tags — a rebuild per signup.
- Almost nothing would be shared anyway: create-t3-turbo (the canonical Expo+Next monorepo, on our exact NativeWind preview) shares zero UI between apps.
- NativeWind v5 exports only `./babel` and `./metro` — unusable from Next; react-native-web is in maintenance mode.
- What to share instead: extract `packages/core` (iCal parser + Sched URL helpers are pure functions) and a shared Tailwind v4 `@theme` token file.

## Stack and the pins

| Package | Version | Pin type |
|---|---|---|
| `next` | 16.2.12 | **EXACT — never caret** |
| `@opennextjs/cloudflare` | 1.20.2 | **EXACT** |
| `wrangler` | 4.86.0 | ^ |

**Why `next` is pinned to exactly 16.2.12:** Next 16.3 + OpenNext produces an **unbounded RSC prefetch loop** ([opennextjs-cloudflare#1334](https://github.com/opennextjs/opennextjs-cloudflare/issues/1334)) — ~64 req/s per open tab, accelerating, ungated (any `<Link>` prefetch triggers it). On Workers that is a request-billing amplification risk. The reporter's control run on 16.2.12 produced zero stray requests. There is no `next-16-2` dist-tag, so a caret would float straight onto 16.3.x.

**Expiry condition — recheck the pin when:** the adapter ships a version >1.20.2 that references #1334, or the repo's `catalogs.e2e.next` entry moves off 16.2.11 (that catalog is the most reliable signal of real support and moves before the docs do).

**Why the adapter is pinned too:** its Next peer floor moved three times in four months; a silent adapter bump would change our Next floor mid-phase.

**Adjacent facts, recorded so nobody "fixes" a non-problem:**

- The wasm bug (#1335) does **not** apply here — it requires a wasm module in the server bundle, and shipping a static OG PNG instead of `next/og` sidesteps it entirely.
- `@cloudflare/next-on-pages` is npm-deprecated and its repo is archived. **Never use it.**
- Cloudflare's own `npm create cloudflare` quickstart currently installs 16.3.0 — do not scaffold from it.
- No `middleware.ts`/`proxy.ts` — Next 16's rename is unsupported by OpenNext ([#1309](https://github.com/opennextjs/opennextjs-cloudflare/pull/1309) still open); the build errors out. Best outcome: no middleware at all.

## Deployment

**GitHub Actions**, gated: deploy only runs after lint/type-check/test pass — the deciding factor over Workers Builds, which structurally cannot gate on checks. (Cost was a wash: public repo = free unlimited Actions minutes.) `wrangler.jsonc` is **hand-written and version-controlled**; Cloudflare's API is the state.

**Alchemy (Better-T-Stack's IaC path) rejected.** The decisive evidence is BTS's own `docs/alchemy-v2-beta-findings.md` — a 13-row confirmed-defect log from published betas (unresolved values serialized into build env, dropped `_headers`, MIME fallthrough, broken local D1 migrations, one that crashed on `--help`; defect A5 — stale deploys from sibling-workspace edits — unfixed). Twenty betas in 68 days, one maintainer at ~66% of commits, and **no wrangler escape hatch** — exiting later means writing the wrangler config by hand anyway, with live data in D1. Revisit only after 2.0 ships stable *and* multi-environment previews become a need.

Deploy gotchas that will bite again if forgotten: `--keep-vars` on every deploy (or Cloudflare-side secrets are deleted), never set `"build": "opennextjs-cloudflare build"` in package.json (infinite recursion — the adapter calls the `build` script), `turbo build --filter=web` is NOT the deploy build (skips the OpenNext transform), and the deploy job must not be a required status check (path filters would block native-only PRs forever).

## ESP: Brevo

One account serves `mrdemonwolf.com` and `conpaws.com`. Hard requirement: separate lists, per-list unsubscribe scope, no double-counting. Brevo won on zero ops burden, managed deliverability, a **dedicated DOI endpoint** (`POST /v3/contacts/doubleOptinConfirmation` — removes token/expiry/confirm-route logic from the Worker), 100k-contact free tier, and Divi 5 native support.

**Why the others lost:**

- **Kit** — global unsubscribe with no preference center (two brands would need two accounts); frozen, deprecated V3 API behind the Divi connector; forced Recommendation ad slot on free.
- **Mailchimp** — free tier is one audience; a contact in two audiences counts (and bills) twice.
- **Omnisend** — not in Divi's 21-provider dropdown (which has no webhook escape hatch); its REST API bypasses double opt-in entirely.
- **FluentCRM** — strong runner-up (no caps, free API), but it couples conpaws.com to mrdemonwolf.com's WordPress uptime and hands over cron reliability, WAF, plugin patching, SES sandbox, and deliverability ownership.

**MANDATORY pre-build test (~20 min):** send a campaign to List A → unsubscribe → confirm the contact is still subscribed on List B and not account-blocklisted. **Then repeat via Gmail's one-click unsubscribe (RFC 8058)** — the real risk, since a one-click header can't render a preference UI and typically forces global suppression. Brevo's default unsubscribe IS global; the fix is a Profile Update form with a multi-list subscriptions block as the unsubscribe destination (community-sourced workaround, not Brevo-official). **If the one-click test fails, fall back to Mailjet** — the only platform where per-list unsubscribe is the default (costs: 200 emails/day, 1,000-contact cap, no Divi, hand-built DOI).

**Setup requirements:** disable (or CIDR-allowlist) Brevo's IP authorization before its 30-day learning phase arms — Workers egress from rotating IPs would silently drop signups a month post-launch. Create the DOI template first (the endpoint requires one); confirm `{{ params.DOIurl }}` renders.

**Revisit at ~500 subscribers:** the shared 300-emails/day pool forces manual daily Requeue clicking past ~500-600 contacts, and paid tiers price by contact count (~$29/mo at 3,000 contacts vs FluentCRM's ~$114/yr). The zero-ops premium grows with the list.

## Waitlist

- **D1 + Drizzle is the source of truth** (not KV — 1,000 writes/day cap and cached negative lookups create dupes). The row carries the consent record: `created_at`, `ip`, `user_agent`, `consent_copy` (the exact wording shown at signup), UTM/referer/country, `source`. That row — not a checkbox — is what proves consent under GDPR Art. 7(1) and CASL.
- **No `confirm_token` column** — Brevo's DOI endpoint owns token generation, expiry, and the confirmation click. D1 records the outcome, not the mechanism.
- **Write to D1 first, then push to Brevo inside `ctx.waitUntil()`** — an ESP outage must never fail the visitor's submission.
- **The cron reconciler is required, not optional.** `ctx.waitUntil` has no retry; without a backstop every ESP hiccup silently drops a subscriber while D1 stays correct and nothing alerts. `synced_at IS NULL` rows are replayed by a Cloudflare Cron Trigger; non-2xx ESP responses must alert.
- Bot gates: honeypot + ~2s minimum time-to-submit, then Turnstile (server-side verify only; tokens expire in 300s, validate once). Rate-limit confirmation sends per address or the form is a mailbombing tool.

## "Seedpod" was SeedProd

There is no "Seedpod" plugin — the old WordPress coming-soon page ran **SeedProd**. The migration is a **one-time 6-row CSV export/import**, not a parser or integration: import with `source: 'seedprod-import'`, `status: 'confirmed'`, and **`created_at` preserved from the CSV** — those timestamps are the only consent evidence for those six people. Send them a "we moved" note, not a re-confirmation; only then take the WordPress page down.

The convention-schedule plugin furry cons actually run is **The Events Calendar** (IndyFurCon: `?ical=1` and `/wp-json/tribe/events/v1/events`, both verified live — the source of `test-data/indyfurcon2025.ics`). That is the real target for a future importer; the existing `ical-parser.ts` already handles its output.

## Physics badge

The draggable lanyard badge is **headless Rapier2D + SVG + DOM** — no three.js, no canvas. WebGL was removed after real context-loss failures in testing (CON-27), not on speculation. The form stays real DOM (`<label>`/`<input>` is the accessible control; the badge is decorative and `aria-hidden`); static CSS fallback under `prefers-reduced-motion` and on low-end devices.

**Turbopack stale-chunk trap:** after dependency or config surgery, `next dev` can serve stale chunks that look like impossible bugs. `rm -rf apps/web/.next` before chasing ghosts.

## CMS

**None in Phase 1.** The landing page is plain TSX; `/privacy` and `/terms` are two MDX files via first-party `@next/mdx`. A CMS on a three-page site is setup tax with no editing benefit.

**Phase 2 (blog/changelog): Sveltia CMS** — two static files under `public/admin/`, a browser-only SPA talking to the GitHub API, nothing in the Worker bundle, zero-rewrite exit. **Set `skip_ci: false`** — its default `[skip ci]` commit prefix would silently prevent every content deploy and look identical to a dead webhook. Decap (zombie maintenance), Keystatic (`@keystatic/next` stale since early 2025), Payload (shares the 10 MiB Worker budget; revisit when a second person edits content daily) all rejected.

## Cloudflare Email Service

Workers Paid includes Cloudflare Email Service (3,000 sends/month). It is **transactional only** — Cloudflare's FAQ explicitly excludes marketing and bulk mail. Its role: magic links and password resets when Supabase auth lands in Phase 2. It is **never the newsletter** — Brevo owns both the DOI confirmation and all list email.
