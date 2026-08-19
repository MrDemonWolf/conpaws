# ConPaws - Pre-Release Site (conpaws.com)

Decision record for the pre-release marketing site. This captures what was settled and **why**, so the choices don't get re-litigated — and, for the version pins, exactly when it's safe to bump.

---

## TL;DR

- **Domain:** `conpaws.com` is canonical. `conpaws.app` is retired (removed from `app.config.ts`).
- **Architecture:** One Cloudflare Worker, one domain, `apps/web`. No `app.` split. Future `/@handle` profiles are Next.js SSR, not Expo Web.
- **Stack:** Next `16.2.12` (EXACT pin), `@opennextjs/cloudflare@1.20.2` (EXACT pin), `wrangler 4.86.0`. Never `@cloudflare/next-on-pages` (archived).
- **Deploy:** **Alchemy** (`packages/infra/alchemy.run.ts`), adopted 2026-08-18 — reversing the rejection recorded below. `wrangler.jsonc` survives for local dev and CI preview only. See *Deployment* for what the reversal cost.
- **ESP:** Brevo, in a **separate free account owned by `conpaws.com`** (Route A, decided 2026-08-18). Its blocklist is account-wide, not per-list, so a shared account would let a ConPaws unsubscribe silently blocklist that address on `mrdemonwolf.com` too. The account boundary is the blocklist boundary.
- **Waitlist:** D1 is the source of truth with full consent-record columns; Brevo's DOI endpoint owns confirmation tokens; `ctx.waitUntil` + a cron reconciler are both required.
- **Outbound vs inbound:** Cloudflare Email Routing is **inbound only** — it forwards mail to `conpaws.com` addresses and can never send the DOI or the launch email. Separate job from the ESP; `conpaws.com` has no MX today.
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

Shape, mirroring what Better-T-Stack generates: `Cloudflare.Website.StaticSite`
pointed at `.open-next/worker.js` with `bundle: false`. Not the first-class
`Cloudflare.Website.Nextjs` resource — that pulls in
`@alchemy.run/cloudflare-frameworks`, which peer-requires
`@opennextjs/cloudflare` at exactly **1.20.1**, and this repo pins 1.20.2 to
hold `next` at 16.2.12. Revisit when that package accepts 1.20.2 or later.

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

The first verified deployment must run with routes disabled so Cloudflare has a known-good rollback version without exposing the site. At launch, enable the checked-in routes block and the routes switch.

**Superseded by the Alchemy reversal above:** the canary-at-0%, version-override probe, exact-version promotion, and automatic rollback this section used to describe no longer exist. Alchemy applies the whole stack in one step. What survives is the post-deploy health check, which fails the run loudly but cannot undo the deploy — recovery is `cd apps/web && bunx wrangler rollback` against `conpaws-web`, or re-running the workflow on the last good SHA. The routes switch is the real safety mechanism now: it is the only thing between a bad deploy and the apex.

D1 migrations must always use expand/contract sequencing because schema changes outlive a Worker rollback — more so now that the rollback is a human typing a command. A newer `main` commit stops the release before and after migration.

Before the first launch, verify in the Cloudflare dashboard that the remote Worker also has `workers.dev` and preview URLs disabled; local config cannot prove historic remote trigger state while Wrangler is unauthenticated. Never set `"build": "opennextjs-cloudflare build"` in package.json (the adapter calls the build script), and do not use `turbo build --filter=web` as a deploy build because it skips the OpenNext transform. Cloudflare secrets survive version uploads; `--keep-vars` is not valid for `wrangler versions upload`.

## ESP: Brevo

Brevo won on zero ops burden, managed deliverability, a **dedicated DOI endpoint** (`POST /v3/contacts/doubleOptinConfirmation` — removes token/expiry/confirm-route logic from the Worker), 100k-contact free tier, and Divi 5 native support.

The original plan put `mrdemonwolf.com` and `conpaws.com` in **one** account, on the hard requirement of per-list unsubscribe scope. **That requirement is not satisfiable in a single Brevo account** — see below.

**Why the others lost:**

- **Kit** — global unsubscribe with no preference center (two brands would need two accounts); frozen, deprecated V3 API behind the Divi connector; forced Recommendation ad slot on free.
- **Mailchimp** — free tier is one audience; a contact in two audiences counts (and bills) twice.
- **Omnisend** — not in Divi's 21-provider dropdown (which has no webhook escape hatch); its REST API bypasses double opt-in entirely.
- **FluentCRM** — strong runner-up (no caps, free API), but it couples conpaws.com to mrdemonwolf.com's WordPress uptime and hands over cron reliability, WAF, plugin patching, SES sandbox, and deliverability ownership.

### Unsubscribe scope — RESOLVED from Brevo's docs (2026-08-15)

The planned empirical test was **cancelled as unnecessary**: Brevo documents the behaviour outright, so there was nothing left to discover.

**Brevo's blocklist is account-wide per channel, not per-list.** Verbatim from [FAQs - What are the different types of blocklisted contacts?](https://help.brevo.com/hc/en-us/articles/209458705-FAQs-What-are-the-different-types-of-blocklisted-contacts): "When a contact is blocklisted from your email campaigns, they **won't receive any of your email campaigns anymore**. That means that if you send an email campaign to a list that contains a blocklisted contact, **they will not be included as a recipient**." Any list, whole account. Sender domain is irrelevant — the blocklist is a property of the contact, not of the list or the From address.

Brevo's own workaround — a Profile Update form carrying a [multi-list subscriptions block](https://help.brevo.com/hc/en-us/articles/360000545200-Enable-your-contacts-to-subscribe-or-unsubscribe-from-specific-lists-using-a-form-multi-list-subscriptions) as the unsubscribe destination — **only fires when the recipient clicks the link in the email body.** It cannot cover Gmail's and Apple Mail's one-click button (RFC 8058 `List-Unsubscribe-Post`), which POSTs directly to Brevo's endpoint and is processed as a blocklist. Google's implementation deadline for commercial and promotional messages from bulk senders was June 1, 2024; Yahoo began enforcing its one-click policy in June 2024. That path cannot be designed away.

**Consequence:** in a shared account, one person unsubscribing from the ConPaws waitlist is silently blocklisted from `mrdemonwolf.com` mail as well. The failure is invisible — D1 stays correct, Brevo reports a normal unsubscribe, and the other list just quietly stops reaching that address.

### The three routes out

**A. Separate Brevo account for `conpaws.com` — recommended.** The blocklist boundary *is* the account boundary, so isolation is total and one-click behaves correctly (a ConPaws unsubscribe means ConPaws only). Free tier, so $0. The apparent cost — "another account" — is mostly illusory: `conpaws.com` needs its own DKIM records, sender verification, and DMARC alignment regardless of which account it lives in, and it has **none** of them today. The true delta is one extra login.

**B. One account, ConPaws owns unsubscribe in D1.** D1 is already the source of truth; this flips the token decision (ConPaws issues confirm *and* unsubscribe tokens) and demotes Brevo to a transactional pipe via `POST /v3/smtp/email` with our own `List-Unsubscribe` / `List-Unsubscribe-Post` headers pointing at `conpaws.com/unsubscribe`. Brevo maintains blocked and unsubscribed transactional contacts, so D1-only unsubscribe ownership cannot be guaranteed. This also costs ~150 lines (token table, two routes, two templates) and forfeits the DOI endpoint that was a main reason to pick Brevo. **The real objection is not the code: it routes a bulk marketing blast through a transactional channel, against Brevo's AUP.** A suspension there takes `mrdemonwolf.com` sending down with it — strictly worse than a second login.

**C. Mailjet.** Per-list unsubscribe is the default. But it is a new vendor and a new API to write against, still needs `conpaws.com` sender auth, and carries a 200 emails/day and 1,000-contact cap with no Divi integration and hand-built DOI. Only worth it for a single dashboard across both brands.

> **DECIDED 2026-08-18: Route A.** A separate free Brevo account for `conpaws.com`. Isolation is total, one-click unsubscribe behaves correctly, the DOI endpoint is kept, and the true cost is one extra login — `conpaws.com` needs its own DKIM and sender verification either way, and has neither today.

**Setup requirements** (unchanged under A or B): disable (or CIDR-allowlist) Brevo's IP authorization before its 30-day learning phase arms — Workers egress from rotating IPs would silently drop signups a month post-launch. Create the DOI template first (the endpoint requires one); confirm `{{ params.DOIurl }}` renders.

**Revisit at ~500 subscribers:** a 300-emails/day pool forces a manual daily resume past ~500-600 contacts: Marketing > Campaigns > Email, filter for Suspended, choose Resume campaign, and confirm. Send to new contacts is only for a completed campaign and reaches contacts added after that campaign. Paid tiers price by contact count (~$29/mo at 3,000 contacts vs FluentCRM's ~$114/yr), so the zero-ops premium grows with the list. Minor point in A's favour: a separate account gets its own 300/day rather than sharing one pool with `mrdemonwolf.com`.

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

## Inbound mail on conpaws.com (Email Routing)

**Cloudflare Email Routing forwards; it does not send.** It cannot deliver the DOI confirmation or the launch announcement, and it has no bearing on the unsubscribe-scope problem above. Do not let it stand in for an ESP. What it *is* for: giving `conpaws.com` working `hello@` / `privacy@` / `support@` addresses that forward into the existing Google Workspace mailbox. The privacy policy and both app-store listings name a contact address, so this is required before launch, not optional polish.

### DNS as it actually stands (measured 2026-08-15)

| | `conpaws.com` | `mrdemonwolf.com` |
|---|---|---|
| Nameservers | `sima` / `skip.ns.cloudflare.com` | Cloudflare |
| MX | **none** | Google Workspace (`aspmx.l.google.com` et al.) |
| SPF | `v=spf1 include:_spf.mx.cloudflare.net ~all` | `include:spf.sendinblue.com include:_spf.google.com ~all` |
| DMARC | `p=quarantine`, Cloudflare `rua` | `p=quarantine`, Cloudflare `rua` |
| Brevo DKIM | **none** | **unverified** (SPF authorization is not DKIM evidence) |

Two things fall out of this:

1. **`conpaws.com` is already on Cloudflare nameservers.** The `routes` block in `apps/web/wrangler.jsonc` was commented out pending that migration — the precondition is met and the block can be uncommented whenever the site is ready to take the apex.
2. **Email Routing is not operational.** Before describing `hello@`, `privacy@`, or `support@` as working, confirm the Cloudflare Email Routing MX, SPF, and DKIM records; a verified destination address; and an active routing rule for each alias.
3. **`conpaws.com` cannot send through Brevo today** — no DKIM, no sender verification. This work is identical whichever ESP account the domain ends up in, which is why option A above costs so little.

### Terraform

There is **no Terraform in this repo** and no `.tf` files anywhere in the tree. If the Cloudflare DNS/Email-Routing config is to be managed as code, decide first whether it belongs here or in a separate infra repo alongside `mrdemonwolf.com` — a `cloudflare_email_routing_rule` / `cloudflare_record` module split across two repos while one Cloudflare account owns both zones is a drift trap. **Open question, deliberately not answered here.** Note that `apps/web/wrangler.jsonc` is local-dev/CI-preview only now; Terraform would own DNS and Email Routing only; the Worker stack itself belongs to Alchemy (see Deployment).

## Going live: config runbook

Nothing below can run until the accounts exist. As of 2026-08-19 the repo has
**zero secrets**; `PRODUCTION_DEPLOY_ENABLED` and `PRODUCTION_ROUTES_ENABLED`
both exist and are `false`. Merging the site code deploys nothing — the deploy
job's `if:` fails on the enable switch, and `Require deploy configuration`
fails the run rather than shipping a site whose waitlist silently 503s.

Order matters. Steps 1-3 are account work; step 4 is paste-and-go once they're done.

### 1. Brevo — separate account owned by `conpaws.com`

Route A (see ESP section): the blocklist is account-wide, so sharing the
MrDemonWolf account would let a ConPaws unsubscribe silently blocklist that
address on `mrdemonwolf.com` too.

1. Create the account, add `conpaws.com` as a sender domain.
2. **DKIM + sender verification.** The domain has neither today (see DNS table)
   and cannot send at all until it does.
3. **Disable IP authorization, or allowlist Brevo's published CIDRs, before the
   30-day learning phase arms.** Workers egress from rotating IPs. Skip this and
   sends start failing roughly a month after launch, long after anyone connects
   the two events.
4. Create the double-opt-in template; confirm `{{ params.DOIurl }}` renders.
   Note the list id and template id — they are identifiers, not credentials, and
   go in as variables.

### 2. Turnstile

Create the widget for `conpaws.com`. Keep both keys: the **site** key is public
and build-time; the **secret** key is a repo secret.

### 3. Cloudflare API token

Scopes: Workers Scripts:Edit and D1:Edit. Also grab the account id. Alchemy
creates `conpaws-db` on first deploy — do not pre-create it, and never put a
real `database_id` in `apps/web/wrangler.jsonc` (local dev and CI preview only).

`ALCHEMY_PASSWORD` is the state-encryption passphrase. Generate a long random
one and store it somewhere durable — losing it orphans the stack state.

### 4. Set the config

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set ALCHEMY_PASSWORD
gh secret set BREVO_API_KEY
gh secret set TURNSTILE_SECRET_KEY

gh variable set BREVO_LIST_ID --body '<list id>'
gh variable set BREVO_DOI_TEMPLATE_ID --body '<template id>'
gh variable set BREVO_DOI_REDIRECT_URL --body 'https://conpaws.com/confirmed'
gh variable set NEXT_PUBLIC_TURNSTILE_SITE_KEY --body '<site key>'
```

**`BREVO_DOI_REDIRECT_URL` has no page behind it yet.** `apps/web/src/app/`
currently holds only `(marketing)/page.tsx`, `privacy`, `terms`, and the two API
routes — there is no `/confirmed`. Brevo sends every confirming subscriber there
after they click the link, so the page must exist before the waitlist opens or
the last step of the signup flow is a 404. Build it with step 6, not step 4.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is deliberately a **variable, not a secret**.
It is a build-time client var (`packages/env/src/web.ts`) that the deploy step
inlines into the bundle; it ships to every visitor by design. Masking it in logs
buys nothing and invites treating it as sensitive.

Enable the deploy **last**, once everything above is set:

```bash
gh variable set PRODUCTION_DEPLOY_ENABLED --body true
```

### 5. First deploy, routes still disabled

Leave `PRODUCTION_ROUTES_ENABLED=false`. Automatic rollback died with the
wrangler pipeline, so Cloudflare needs a known-good version parked before
`conpaws.com` points at anything. Verify the Worker and D1 came up, then flip
routes on. Manual rollback:

```bash
cd apps/web && bunx wrangler rollback
```

### 6. Open the waitlist

End-to-end test on the deployed site first: submit, confirm the D1 row lands
with `synced_at` stamped, confirm the DOI email actually arrives. Then flip
`WAITLIST_ACCEPTING_SIGNUPS` to `true` in `apps/web/src/components/waitlist.tsx`.

The CI smoke test asserting HTTP 503 does **not** change — it exercises the
unconfigured local preview, not production.

### 7. Migrate the 6 SeedProd subscribers

Needs the CSV export from WordPress. Preserve `created_at` from the CSV; those
timestamps are the only consent evidence those six people have. Use
`source: 'seedprod-import'`, `status: 'confirmed'`. Send a "we moved" note,
never a re-confirmation. Take the WordPress page down only after that.
