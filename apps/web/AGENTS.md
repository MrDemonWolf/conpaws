# AGENTS.md

Public Next.js website and waitlist. Root [AGENTS.md](../../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Read [environment guidance](../../packages/env/AGENTS.md) for bindings/local Worker previews and [infrastructure guidance](../../packages/infra/AGENTS.md) before changing deployment configuration. Next/OpenNext pins are in root guidance.

### Web routing: two root layouts, and the traps in it

**There is no `apps/web/src/app/layout.tsx`, deliberately.** The site has
**two root layouts** — `app/(marketing)/layout.tsx` for the English routes and
`app/[locale]/layout.tsx` for the 22 translated ones — because only a root
layout renders `<html>` and only a layout at or below `[locale]` can see the
locale. A single root layout can only hardcode `lang`, and it did: every
language shipped `<html lang="en">`. Both delegate to `Document` in
`src/components/document.tsx`, which owns the fonts, the shared metadata, the
global stylesheet and `<html lang dir>`. Add anything document-level there, not
to one layout.

URLs did not move. `(marketing)` is a route group and contributes no path
segment, so `/` is still English and `/ja` is still `/ja`. Putting every route
under `[locale]` — the other reading of "restructure" — would drag `/privacy`
to `/en/privacy` and is the thing not to do.

Three consequences that fail silently:

- **The 404 is `app/global-not-found.tsx`, not `not-found.tsx`.** With no root
  layout there is nothing for a `not-found.tsx` to be wrapped in, and Next
  serves it inside its own bare error shell: no stylesheet, no fonts, no
  `lang`. `global-not-found.tsx` renders its own `<html>` (via `Document`) the
  way `global-error.tsx` does. It needs **`experimental.globalNotFound: true`**
  in `next.config.ts` — removing that flag does not fail the build, it reverts
  the 404 to unstyled markup. The page body lives in
  `src/components/not-found-page.tsx` and applies the `%s · ConPaws` title
  template itself, because it inherits no layout metadata.
- **Do not add a `[...catchAll]` page to funnel misses.** It was tried; it
  works, but `global-not-found.tsx` covers the same ground without a route.
- **Keep translated routes available in the Worker preview.** OpenNext uses the static-assets incremental cache with cache interception enabled. `build:cloudflare` populates the local cache; removing that step breaks prerendered locale routes. Validate all 23 locales with `apps/web/scripts/e2e.ts`.

**Structured data** is `src/lib/structured-data.ts` rendered through
`src/components/json-ld.tsx`. `Document` emits Organization + WebSite on every
page; `Landing` emits SoftwareApplication + FAQPage, because structured data
must describe the page it sits on and `/terms` has no FAQ. The FAQ entities are
derived from `messages.faq.items` through the same `parseInline` the accordion
renders with — never retype the answers, or the markup Google sees stops
matching the visible text.

## Waitlist and email invariants

- **Waitlist: the path is LIVE and taking real signups.** Flow: renamed honeypot + timing gate → Turnstile siteverify → D1 insert → listmonk double opt-in in `ctx.waitUntil`; PII-free rejection counters are logged. The server-bound `WAITLIST_ACCEPTING_SIGNUPS` kill switch is a repo variable bound by Alchemy; `false` makes POST return `503 {error:"closed"}`, and the client follows the same build value. D1 is the source of truth and the row **is** the consent record; listmonk owns confirmation tokens, so there is deliberately no `confirm_token` column. The hourly reconciler syncs listmonk status through list queries, anonymises unsubscribed rows, purges unconfirmed D1 rows after 30 days, and never replays erased rows. Listmonk subscriber deletion is not performed; the required permission decision is pending. Because signups are live, `/privacy` has to keep describing what is actually collected.
- **The ESP is listmonk** — self-hosted listmonk v5 at `lists.mrdemonwolf.com` (Dokploy on ash-01, sending via Amazon SES us-east-1). Brevo was never provisioned, was never wanted, and is gone from the codebase as of 2026-08-28. The client is `apps/web/src/lib/listmonk.ts`, wired into the signup route and the hourly reconciler. Config is `LISTMONK_BASE_URL`, `LISTMONK_API_USER`, `LISTMONK_API_TOKEN`, `LISTMONK_LIST_ID` (list **3**, the private double opt-in "ConPaws Waitlist"); any missing value makes `readListmonkConfig` return `null`, which is the 503/no-op fail-closed signal. `/api` sits outside Cloudflare Access deliberately, so the API token is the only credential — no Access service token.
- **Signup is one API call, and that is deliberate.** `POST /api/subscribers` with `preconfirm_subscriptions: false` **already sends the opt-in email** — listmonk's `InsertSubscriber` calls `SendOptinConfirmation` itself for double opt-in lists. Do not add a follow-up `POST /api/subscribers/{id}/optin`; it sends a second email. A **409** (address already known — every one of the six imported subscribers, if they use the form again) is treated as success, because the only way to reach it is an earlier create, and that create already sent the opt-in. Do not "improve" this by looking the subscriber up to re-send: listmonk has no lookup-by-email route, so it would need the `query=` SQL parameter and therefore the **`subscribers:sql_query`** permission — arbitrary read SQL that supersedes all list and subscriber permissions — on a token that lives at the edge. Two further dependencies worth knowing: listmonk's "send opt-in confirmation" setting must stay **on** or signups silently stop mailing anyone, and the API user needs **manage** permission on list 3 or listmonk filters the list out and creates the subscriber with no list and no email, returning 200. Also note listmonk v5 supports only hCaptcha and Altcha, **not Turnstile** — Turnstile stays verified by our own route.
- **Never write listmonk settings through the API — use the admin UI.** `GET /api/settings` returns each SMTP password **masked** (44 identical characters), not blank. A read-modify-write against `PUT /api/settings` therefore stores the mask *as* the password, and every send fails with `535 Authentication Credentials Invalid`. SES SMTP passwords cannot be retrieved after creation, so recovery means generating new SMTP credentials in the SES console and updating **both** username and password. This is not the same as the documented "blank passwords are preserved by UUID match" behaviour — that holds for the admin UI's own round-trip, not for a hand-rolled API one. Note also that `PUT /api/settings` performs **no validation**: it will happily store an `app.lang` longer than the 6-character limit enforced by `GET /api/lang/:lang` (`cmd/i18n.go`), after which the admin SPA gets a 400 fetching its language pack and renders a blank page — locking you out of the UI you would use to undo it. Broke sending for ~30 minutes on 2026-08-28 this way.
- **Opt-in email copy lives in a custom language file, not a template.** The opt-in mail is not an editable template — `template_type` is `('campaign','campaign_visual','tx')` on v6.2.0 and on master, so the Templates screen cannot touch it, and every string in `static/email-templates/subscriber-optin.html` is an i18n key. The override is a **partial** language file (`initI18n` loads English first and overlays the selection, so missing keys fall back), mounted as a Dokploy File Mount `en-mdw.json` and loaded via `--i18n-dir /listmonk/i18n` on the **last** command in the compose chain. The language **code must be ≤6 characters and the filename must match it** (`getI18nLang` reads `/i18n/<code>.json`) — `en-mrdw` was rejected, hence `en-mdw`. The "Powered by listmonk" footer is hardcoded markup in `base.html` and cannot be removed this way; the `appearance.public.custom_css` rule only hides attribution on web pages, not in email.
- **Badge count:** the landing-page badge number is the real confirmed signup count, served by `GET /api/waitlist/count` (public, edge-cached 5 min) and read client-side by `badge-card.tsx`. **listmonk is the source, not D1** — `waitlist.status`/`confirmed_at` exist in the schema but nothing ever writes them, because listmonk owns the confirmation click and offers no callback, so counting D1 would report 0 forever. The route answers `{ count: null }`, never `{ count: 0 }`, whenever the number cannot be established; the badge falls back to `0001` on null. Zero is a claim ("nobody signed up") and an outage must not make it. Read `subscriber_statuses.confirmed` from `/api/lists/{id}`, never `subscriber_count` — the latter sums every status, so it counts unconfirmed and deleted rows too (observed at 12 for a list of 6).

  **The badge depends on a listmonk setting, and silently freezes without it.** Both of those fields come from the `mat_list_subscriber_stats` **materialized view** — listmonk's `query-lists` reads it unconditionally, with no live-vs-cached branch. The only thing that ever refreshes it is the cron in `cmd/init.go`, which is registered *only* when **`app.cache_slow_queries` is true**. The setting's name is backwards from what it does: turning "Cache slow database queries" **off** does not make the count live, it stops the refresher and freezes the view forever. It is **on**, with `app.cache_slow_queries_interval` set to `*/5 * * * *` (Settings → Performance). If the badge ever stops moving while the admin UI shows more confirmed subscribers, that toggle is the first thing to check — the admin subscriber list reads live tables, which is why the two disagree. Diagnosed 2026-08-28 after a confirmed signup left the count stuck at 6.
