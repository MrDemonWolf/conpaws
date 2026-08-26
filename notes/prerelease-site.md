# ConPaws - Pre-Release Site (conpaws.com)

Decision record for the pre-release marketing site. This captures what was settled and **why**, so the choices don't get re-litigated — and, for the version pins, exactly when it's safe to bump.

---

## TL;DR

- **LIVE since 2026-08-26.** `conpaws.com` serves the Worker; `PRODUCTION_DEPLOY_ENABLED` and `PRODUCTION_ROUTES_ENABLED` are both `true`. Runbook steps 1-5 are done; 6 and 7 are blocked on the ESP. Read *Traps* before touching the deploy.
- **Domain:** `conpaws.com` is canonical. `conpaws.app` is retired (removed from `app.config.ts`). `www` 308-redirects to the apex via a **zone-level Cloudflare Redirect Rule that is not in this repo** and is lost if the zone is rebuilt.
- **Architecture:** One Cloudflare Worker, one domain, `apps/web`. No `app.` split. Future `/@handle` profiles are Next.js SSR, not Expo Web.
- **Stack:** Next `16.2.12` (EXACT pin), `@opennextjs/cloudflare@1.20.2` (EXACT pin), `wrangler 4.86.0`. Never `@cloudflare/next-on-pages` (archived).
- **Deploy:** **Alchemy** (`packages/infra/alchemy.run.ts`), adopted 2026-08-18 — reversing the rejection recorded below. `wrangler.jsonc` survives for local dev and CI preview only. See *Deployment* for what the reversal cost.
- **ESP: Brevo is OUT (2026-08-25).** Self-hosted **Listmonk** is the direction. Brevo was removed from the deploy path — `alchemy.run.ts` binds empty strings, the deploy workflow no longer requires Brevo config, and the signup route fails closed with 503. Nothing is bound today. See *ESP* below.
- **Waitlist:** D1 is the source of truth with full consent-record columns; `ctx.waitUntil` + a cron reconciler are both required. Confirmation-token ownership moves to us with Listmonk — Brevo's DOI endpoint used to own it, which is why there is still no `confirm_token` column.
- **Outbound vs inbound:** Cloudflare Email Routing is **inbound only** — it forwards mail to `conpaws.com` addresses and can never send the DOI or the launch email. Separate job from the ESP; `conpaws.com` has no MX today.
- **Cloudflare Email *Sending* does not replace the ESP (re-checked 2026-08-25).** It really does send outbound now, but it is Beta and Cloudflare's FAQ still restricts it to transactional mail. It could carry the DOI confirmation; it cannot carry the launch announcement, which is the one email the waitlist exists for. See *Cloudflare Email Service*.
- **Badge:** headless Rapier2D physics + SVG + DOM. WebGL removed after real context-loss failures.
- **CMS:** none in Phase 1; Sveltia in Phase 2 (remember `skip_ci: false`).

---

## Domain

`conpaws.com` — every planning and legal doc already used it; `conpaws.app` in `app.config.ts` and `DEPLOY_WEB.md` was the outlier and has been corrected. Universal links (`associatedDomains`) now point at `conpaws.com`; serving AASA/assetlinks is deferred until profile pages exist.

## One Worker, no app. split

No browser app exists, and profile pages want the apex domain for OG unfurls and universal links. Route groups (`(marketing)/`, `(public)/`) exist from day one so a later split is a move, not a rewrite.

**Profile pages will be Next.js SSR, not Expo Web** (scored 48/60 vs 25/60):

- Expo Router web would duplicate the established Next/OpenNext SSR stack and offers almost no useful UI sharing; profile pages also need per-request metadata rather than the native app's static web output.
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

**GitHub Actions**, gated: unprivileged CI runs lint, types, tests, an OpenNext build with local Worker smoke tests, and Expo production-bundle checks. Production release is a separate `workflow_run` that accepts only the SHA-stamped Worker artifact from successful `main` CI. `wrangler.jsonc` is **hand-written and version-controlled**; Cloudflare's API is the state.

### REVERSED 2026-08-18 — Alchemy adopted

Deployment now runs through **Alchemy** (`packages/infra/alchemy.run.ts`), on
Nathanial's explicit call, taken after being shown both the rejection below and
the fact that its own revisit condition is **not met**: npm `latest` for
`alchemy` was `2.0.0-beta.72`, published 2026-08-12 — 72 betas, no stable 2.0.
The reason for the reversal is operational, not technical: Alchemy provisions
D1 and every binding from one typed program, so the Cloudflare dashboard never
has to be touched.

**Shape — corrected 2026-08-26.** It is the first-class `Nextjs` resource, not
`StaticSite`. This record previously said the opposite, mirroring what
Better-T-Stack generates: `StaticSite` pointed at `.open-next/worker.js` with
`bundle: false`, avoiding `Nextjs` because of a peer pin on
`@opennextjs/cloudflare@1.20.1`. **That shape does not work.** A prebuilt
`.open-next/worker.js` uploaded as a plain Worker throws `ReferenceError:
require is not defined` out of Next's server bootstrap on *every* request — the
bundle leaves bare `require()` calls for Node builtins that resolve only under
the adapter's own upload path. `Nextjs` runs the OpenNext build and uploads it
the way the adapter expects, including the `ASSETS` and `WORKER_SELF_REFERENCE`
bindings. Do not "restore" `StaticSite`.

**Worker name is `conpaws`** (renamed from `conpaws-web` on 2026-08-26). Alchemy
has no rename: changing `name` destroys the old Worker and creates a new one,
which detaches and re-attaches `conpaws.com`. That is a real outage every time,
and the custom-domain bind is the slow part. See *Traps* below.

**What the reversal cost.** The retired wrangler pipeline did things Alchemy
does not: canary at 0% traffic behind a version-override header, promotion of
one exact previously-probed version id, automatic rollback to a captured stable
version, and deploying the byte-identical artifact CI smoke-tested. Alchemy
applies the whole stack in one step and owns the Worker's versions, so these
cannot be layered on without fighting it. **Rollback is now manual.** The
post-deploy health check still fails the run loudly; it cannot undo the deploy.
Deploy the first time with `PRODUCTION_ROUTES_ENABLED` false so Cloudflare holds
a known-good version before the apex points anywhere.

Exact pins are mandatory on a beta that ships every few days: `alchemy` and the
Effect packages are pinned exactly, matching what Better-T-Stack pins.

The original rejection, kept because the risks it names are real and now
accepted rather than avoided:

**Alchemy (Better-T-Stack's IaC path) was rejected.** The decisive evidence is BTS's own `docs/alchemy-v2-beta-findings.md` — a 13-row confirmed-defect log from published betas (unresolved values serialized into build env, dropped `_headers`, MIME fallthrough, broken local D1 migrations, one that crashed on `--help`; defect A5 — stale deploys from sibling-workspace edits — unfixed). Twenty betas in 68 days, one maintainer at ~66% of commits, and **no wrangler escape hatch** — exiting later means writing the wrangler config by hand anyway, with live data in D1. Revisit only after 2.0 ships stable *and* multi-environment previews become a need.

Release safety rules: PR code never receives Cloudflare credentials. `PRODUCTION_DEPLOY_ENABLED`, the protected `production` environment, and a required human approval gate any release; `PRODUCTION_ROUTES_ENABLED` independently controls whether domain routes may change. Both switches default to `false`, and `workers_dev` plus preview URLs stay disabled.

The first verified deployment must run with routes disabled so Cloudflare has a known-good rollback version without exposing the site. At launch, enable the checked-in routes block and the routes switch. **Done — `PRODUCTION_ROUTES_ENABLED` went `true` on 2026-08-26 and `conpaws.com` is live.**

**Superseded by the Alchemy reversal above:** the canary-at-0%, version-override probe, exact-version promotion, and automatic rollback this section used to describe no longer exist. Alchemy applies the whole stack in one step. What survives is the post-deploy health check, which fails the run loudly but cannot undo the deploy — recovery is `cd apps/web && bunx wrangler rollback` against `conpaws`, or re-running the workflow on the last good SHA. The routes switch is the real safety mechanism now: it is the only thing between a bad deploy and the apex.

D1 migrations must always use expand/contract sequencing because schema changes outlive a Worker rollback — more so now that the rollback is a human typing a command. A newer `main` commit stops the release before and after migration.

`workers.dev` and preview URLs are Alchemy-managed now — `url:` and `previewSubdomains:` in `alchemy.run.ts`, driven by the `WORKERS_DEV_ENABLED` and `PREVIEW_URLS_ENABLED` repo variables. `WORKERS_DEV_ENABLED` is `false`; `PREVIEW_URLS_ENABLED` is unset, which is also off. Toggle them as variables rather than clicking in the dashboard, or the next deploy reverts the click. Never set `"build": "opennextjs-cloudflare build"` in package.json (the adapter calls the build script), and do not use `turbo build --filter=web` as a deploy build because it skips the OpenNext transform. Cloudflare secrets survive version uploads; `--keep-vars` is not valid for `wrangler versions upload`.

## ESP: Brevo — SUPERSEDED 2026-08-25

> **Brevo is not the ESP any more.** It was removed from the deploy path on
> 2026-08-25: `packages/infra/alchemy.run.ts` binds empty strings for every
> Brevo variable, `deploy-web.yml` no longer lists them as required config, and
> `POST /api/waitlist` returns 503 because `readBrevoConfig` resolves to null.
> The public form stays closed (`WAITLIST_ACCEPTING_SIGNUPS = false`).
>
> **The direction is self-hosted Listmonk**, on the Dokploy box, which is the
> "run our own thing" option this record kept circling. It is blocked on AWS
> SES production access for outbound.
>
> The published privacy policy deliberately names **no** provider and commits
> to naming one here and in the policy *before* the form accepts a single
> address. That sentence is what has to change first when Listmonk lands.
>
> The vendor comparison, the three routes out, and the portfolio analysis that
> used to run to ~70 lines here were cut on 2026-08-26. They argued about which
> Brevo account to open. Only the findings that outlive the vendor are kept,
> below; the full text is in git history.

Brevo won on zero ops burden, a **dedicated DOI endpoint** that kept token, expiry, and confirm-route logic out of the Worker, and a 100k-contact free tier. The plan was one account shared with `mrdemonwolf.com`, on a hard requirement of per-list unsubscribe scope. **That requirement is not satisfiable in a single Brevo account**, which is the one finding here worth carrying to any successor.

### Unsubscribe scope is an account property, not a list property

**Brevo's blocklist is account-wide per channel, not per-list.** Verbatim from [FAQs - What are the different types of blocklisted contacts?](https://help.brevo.com/hc/en-us/articles/209458705-FAQs-What-are-the-different-types-of-blocklisted-contacts): "When a contact is blocklisted from your email campaigns, they **won't receive any of your email campaigns anymore**. That means that if you send an email campaign to a list that contains a blocklisted contact, **they will not be included as a recipient**." Any list, whole account. Sender domain is irrelevant — the blocklist is a property of the contact, not of the list or the From address.

Brevo's own workaround — a Profile Update form carrying a [multi-list subscriptions block](https://help.brevo.com/hc/en-us/articles/360000545200-Enable-your-contacts-to-subscribe-or-unsubscribe-from-specific-lists-using-a-form-multi-list-subscriptions) as the unsubscribe destination — **only fires when the recipient clicks the link in the email body.** It cannot cover Gmail's and Apple Mail's one-click button (RFC 8058 `List-Unsubscribe-Post`), which POSTs directly to Brevo's endpoint and is processed as a blocklist. Google's implementation deadline for commercial and promotional messages from bulk senders was June 1, 2024; Yahoo began enforcing its one-click policy in June 2024. That path cannot be designed away.

**Consequence:** in a shared account, one person unsubscribing from the ConPaws waitlist is silently blocklisted from `mrdemonwolf.com` mail as well. The failure is invisible — D1 stays correct, Brevo reports a normal unsubscribe, and the other list just quietly stops reaching that address.

**Generalised:** suppression scope is a property of whatever the vendor treats as the tenancy boundary, and it is almost never the list. Check it per vendor before assuming two products can share one account — Mailgun scopes per *sending domain*, Amazon SES defaults to *account-level* with per-product isolation available only via explicit SES tenants. Every product needs its own sending domain for DKIM and DMARC alignment regardless, so domain-scoped suppression tends to fall out for free and account-scoped suppression does not.

### The migration hazard: confirmation state

**The schema has `status` and `confirmed_at`, and no runtime path writes either.** Nothing marks a D1 row confirmed, because the ESP owned the confirmation click. So the rows alone cannot distinguish pending from confirmed, and a migration reading only D1 either re-confirms people who already opted in or imports unconfirmed addresses as confirmed. This is why there is no `confirm_token` column, and it becomes live work under Listmonk, which hands token generation, expiry, and replay protection back to us.

Before any provider move: export confirmation and suppression state from the outgoing ESP, reconcile it onto the D1 rows, and only then import. Skipping re-confirmation is correct **only** when the new provider ingests those contacts as already-confirmed without sending its own double opt-in. Re-confirming a list you already hold valid consent for throws away every subscriber who does not happen to open and click that one email, for no legal gain.

**Revisit trigger:** the second product that needs a waitlist. Do it then, as a shared package, not under launch pressure.

## Waitlist

- **D1 + Drizzle is the source of truth** (not KV — 1,000 writes/day cap and cached negative lookups create dupes). The row carries the consent record: `created_at`, `ip`, `user_agent`, `consent_copy` (the exact wording shown at signup), UTM/referer/country, `source`. That row — not a checkbox — is what proves consent under GDPR Art. 7(1) and CASL.
- **No `confirm_token` column** — Brevo's DOI endpoint owns token generation, expiry, and the confirmation click. D1 records the outcome, not the mechanism.
- **Write to D1 first, then push to Brevo inside `ctx.waitUntil()`** — an ESP outage must never fail the visitor's submission.
- **The cron reconciler is required, not optional.** `ctx.waitUntil` has no retry; without a backstop every ESP hiccup silently drops a subscriber while D1 stays correct and nothing alerts. `synced_at IS NULL` rows are replayed hourly by `apps/web/workers/reconcile.ts`. It is a **separate Worker**, not a `scheduled` handler on the site: the site's entry point is OpenNext's prebuilt bundle, which exports only `fetch` and must not be re-bundled. Failures are logged at error level and capped at `MAX_SYNC_ATTEMPTS` so a permanently rejected address is not retried forever.
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

Workers Paid includes Cloudflare Email Service (3,000 sends/month). It is **transactional only** — Cloudflare's FAQ explicitly excludes marketing and bulk mail. Its role: magic links and password resets when Better-Auth lands in Phase 2. It is **never the newsletter** — Brevo owns both the DOI confirmation and all list email.

### Re-checked 2026-08-25 — it does NOT replace the ESP

Outbound sending is real and self-serve now, but it does not close the ESP
question, and the reason is not price or maturity.

| | As documented |
|---|---|
| Status | **Beta**, not GA. Workers Paid only; Free cannot send outbound at all |
| Price | 3,000/month included per account, then $0.35 per 1,000 |
| Daily cap | New accounts start "conservative" and auto-scale on reputation. **No published number** — the limit is not a figure you can plan a launch against, and a raise is a support request |
| Prereq | Domain must be on Cloudflare DNS (it is), then onboarded — Cloudflare writes MX/SPF/DKIM/DMARC on a `cf-bounce` subdomain |
| Before onboarding | Verified destination addresses only. After onboarding, any recipient |
| Suppression | Account-level list of bounces, complaints, and unsubscribes, checked on every send |

**The blocker is the AUP, not the beta label.** Cloudflare's FAQ still reads
"Email Service is intended only for transactional emails. We plan to support
marketing emails and bulk sender tooling in the future." A double opt-in
confirmation is transactional and fits. **The launch announcement is not** —
and that one blast is the entire reason the waitlist exists. So Email Service
can carry the confirmation and still leaves the list email homeless. Splitting
them across two providers is worse than either alone: the suppression state
that matters at launch would live with the provider that never sees the
unsubscribe.

What it *would* genuinely remove, if used for the DOI leg only:

- SES's sandbox (200/24h, verified recipients) sitting on the launch path.
- The SES bounce problem in the open questions — Cloudflare suppresses bounces
  and complaints itself, so there is no SNS topic to stand up and nothing
  forwarding bounce notices into Google Workspace to trip its rate limiter.

What it would cost is unchanged from the Listmonk analysis above: sending our
own confirmation means we own the token, so the `confirm_token` column that was
deliberately left out has to exist, along with a confirm route, expiry, and
replay protection — and `/confirmed` stops being the static page it is today.

**Verdict: not the unblock.** Revisit when Cloudflare ships bulk sender
tooling; until then it is still the Phase 2 auth-mail answer the section above
describes, and the ESP decision stands on its own.

## Inbound mail on conpaws.com (Email Routing)

**Cloudflare Email Routing forwards; it does not send.** It cannot deliver the DOI confirmation or the launch announcement, and it has no bearing on the unsubscribe-scope problem above. Do not let it stand in for an ESP. What it *is* for: giving `conpaws.com` working `hello@` / `privacy@` / `support@` addresses that forward into the existing Google Workspace mailbox. The privacy policy and both app-store listings name a contact address, so this is required before launch, not optional polish.

### DNS as it actually stands (re-measured 2026-08-26)

| | `conpaws.com` |
|---|---|
| Nameservers | Cloudflare |
| MX | `route1` / `route2` / `route3.mx.cloudflare.net` — **Email Routing MX published** |
| SPF | `v=spf1 include:_spf.mx.cloudflare.net ~all` |
| DMARC | `p=quarantine`, Cloudflare `rua` |
| Outbound DKIM | **none** — no sender domain is authenticated for sending |

What follows from it:

1. **The apex is live.** `conpaws.com` serves the Worker and `www.conpaws.com` 308-redirects to it, path preserved. Alchemy attaches both as Custom Domains (`domains:` in `alchemy.run.ts`, gated on `ROUTES_ENABLED`). The `routes` block in `apps/web/wrangler.jsonc` is not the mechanism and never became one — that file is local dev and CI preview only.
2. **The www→apex redirect is a zone-level Cloudflare Redirect Rule, and it exists nowhere in this repo.** Not `next.config.ts` (no `redirects()`), not middleware (there is none, and Next 16 middleware is unsupported by OpenNext anyway). Evidence it fires at the edge rather than in the Worker: the 308 response carries no `content-security-policy` and no `x-nextjs-cache`, both of which the Worker's 200 does. Alchemy cannot manage Redirect Rules, so **if the zone is ever rebuilt this rule is lost silently** and `www` starts serving a duplicate copy of the site instead of redirecting. Re-create it by hand.
3. **Email Routing MX is published, but the aliases are unverified from here.** DNS proves the zone is onboarded; it does not prove there is a verified destination address or an active rule for `hello@`, `privacy@`, `support@`. Confirm each in the dashboard before the privacy policy and the store listings name one.
4. **`conpaws.com` still cannot send.** No outbound DKIM, no sender verification, with or without an ESP. That work is unchanged by the Brevo→Listmonk switch.

### Terraform

There is **no Terraform in this repo** and no `.tf` files anywhere in the tree. If the Cloudflare DNS/Email-Routing config is to be managed as code, decide first whether it belongs here or in a separate infra repo alongside `mrdemonwolf.com` — a `cloudflare_email_routing_rule` / `cloudflare_record` module split across two repos while one Cloudflare account owns both zones is a drift trap. **Open question, deliberately not answered here.** Note that `apps/web/wrangler.jsonc` is local-dev/CI-preview only now; Terraform would own DNS and Email Routing only; the Worker stack itself belongs to Alchemy (see Deployment).

## Going live: config runbook

**Steps 1-5 are DONE.** The site is deployed and `conpaws.com` is live. What is
left is the ESP and the waitlist opening — steps 6 and 7 — and both are blocked
on Listmonk, not on anything in this repo.

### Config as actually set (verified 2026-08-26)

| Repo secret | |
|---|---|
| `CLOUDFLARE_API_TOKEN` | set |
| `CLOUDFLARE_ACCOUNT_ID` | set |
| `ALCHEMY_PASSWORD` | set — state-encryption passphrase; losing it orphans the stack state |
| `ALCHEMY_STATE_TOKEN` | set |
| `TURNSTILE_SECRET_KEY` | set |

| Repo variable | Value |
|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `0x4AAAAAAEa8rVb51KucuNh3` — public by design, a variable and not a secret |
| `PRODUCTION_DEPLOY_ENABLED` | `true` |
| `PRODUCTION_ROUTES_ENABLED` | `true` |
| `WORKERS_DEV_ENABLED` | `false` |
| `PREVIEW_URLS_ENABLED` | unset (= off) |

**No `BREVO_*` secret or variable exists**, which is the deploy path agreeing
with the ESP decision rather than a gap to fill. `alchemy.run.ts` binds empty
strings, `deploy-web.yml` does not require them, and `POST /api/waitlist` fails
closed with 503.

Cloudflare API token scopes are Workers Scripts:Edit and D1:Edit. Alchemy created
`conpaws-db` on first deploy — never pre-create it, and never put a real
`database_id` in `apps/web/wrangler.jsonc`.

### What the ESP step will need (Listmonk, not Brevo)

The Brevo runbook that used to sit here is deleted, not superseded-in-place: a
separate Brevo account, its DKIM and sender verification, the IP-authorization
trap, and the DOI template are all work nobody should do now. Two of its
requirements survive the provider change, because they belong to the domain
rather than the vendor:

- **`conpaws.com` needs outbound DKIM and sender verification** before it can
  send a single address anything. Still absent.
- **Whatever sends must tolerate egress from rotating Worker IPs.** Brevo's
  30-day IP-authorization learning phase was the sharp edge; check for the
  equivalent in Listmonk's upstream SMTP provider before launch, not after.

**`/confirmed` is built and deployed, and currently nothing points at it.**
`apps/web/src/app/(marketing)/confirmed/page.tsx` was the destination
`BREVO_DOI_REDIRECT_URL` sent every confirming subscriber to. Listmonk serves
its own confirmation page, so the redirect does not carry across — pointing it
at `/confirmed` is a setting to verify inside the running instance. See
`infra/listmonk/README.md` §5. The page is static and `noindex`; it verifies
nothing and reads no token off the URL, because confirmation happens at the ESP
before the redirect. Keep it: it is the same shape whichever provider lands.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is deliberately a **variable, not a secret**.
It is a build-time client var (`packages/env/src/web.ts`) that the deploy step
inlines into the bundle; it ships to every visitor by design. Masking it in logs
buys nothing and invites treating it as sensitive. Without it the widget never
renders, the client posts an empty token, and every real signup is rejected.

### 6. Open the waitlist — BLOCKED on the ESP

Blocked, not merely pending: `POST /api/waitlist` returns 503 by design while no
provider is bound, so opening the form now would collect nothing.

The published privacy policy deliberately names **no** provider and commits to
naming one here and in the policy *before* the form accepts a single address.
That sentence is what has to change first.

Then, in order: end-to-end test on the deployed site — submit, confirm the D1
row lands with `synced_at` stamped, confirm the confirmation email actually
arrives — and only then flip `WAITLIST_ACCEPTING_SIGNUPS` to `true` in
`apps/web/src/components/waitlist.tsx`.

The CI smoke test asserting HTTP 503 does **not** change — it exercises the
unconfigured local preview, not production.

### 7. Migrate the 6 SeedProd subscribers

Needs the CSV export from WordPress. Preserve `created_at` from the CSV; those
timestamps are the only consent evidence those six people have. Use
`source: 'seedprod-import'`, `status: 'confirmed'`. Send a "we moved" note,
never a re-confirmation. Take the WordPress page down only after that.

## Traps

Found the hard way on 2026-08-26, during the rename and the first live deploy.
Each one is quiet — nothing errors, and the wrong conclusion is the comfortable
one.

**Alchemy's `Skipped Resource (no changes)` is not evidence the resource
exists.** Alchemy diffs the program against its own state store, never against
Cloudflare. Delete something in the dashboard and Alchemy will keep reporting it
as unchanged, indefinitely, because its state still describes it. Never read
that line as a health check — check Cloudflare.

**Detaching a Workers Custom Domain deletes the DNS record.** It is not a
route-level unbind that leaves the hostname resolving; the hostname stops
existing. This is why the Worker rename is an outage and not a no-op, and why
`domains:` should not be toggled to "test something".

**A red `Verify deploy` does not mean the deploy failed, and a green one is not
currently achievable.** That ambiguity cost real time twice, once while hiding
an actual outage. Do not trust the run's conclusion or a previous session's
summary of it — check `https://conpaws.com/api/health` directly.

**The WAF returns 403 on some legitimate requests.** Unresolved. `wrangler`'s
OAuth token carries no WAF scope, so the rules cannot be read or changed from
the CLI — it needs a scoped API token or dashboard access. Do not re-derive
this; ask for credentials.
