# ConPaws full review → remediation plan (2026-10-06 → 10-07)

> Status: review complete, plan ready for approval. After approval the work is handed to **Codex (`gpt-6-luna`, reasoning `medium`)** one phase at a time in a dedicated worktree (see "Codex handoff").

## Context

Nathanial asked for a full, read-only review of the ConPaws monorepo (Expo app + SwiftUI widget/watch targets, the live conpaws.com Next.js site, the private admin console, packages/infra/CI), using the `/uiux-review` and front-end-design skills plus every relevant Codex/Claude skill, plugin and MCP server (Mobbin included), all in plan mode. The outcome is this document: verified findings and a phased, PR-sized remediation plan to execute after approval. Nothing in the repo was modified.

## How the review was run

- **Skills applied (read from disk, mapped per dimension):** uiux-review (NN/g), frontend-design (Codex `frontend-design@personal`), mobile-app-ui-design, react-native-skills, react-doctor, animate-expo, Expo plugin (expo-overview/-native-ui/-ui/-router/-design-system/-animation/-data-fetching/-module/-upgrade/-dev-client, eas-app-stores/eas-update for comparison only), Cloudflare plugin (workers-best-practices, turnstile-spin, wrangler, web-perf, nextjs-on-cloudflare, cloudflare-one), Codex Security (security-scan, threat-model, validation), Codex review-agent, code-review, swiftui-pro, swiftui-expert-skill, swift-concurrency-pro + swift-concurrency, build-ios-apps (swiftui-ui-patterns, swiftui-performance-audit, ios-app-intents, swiftui-liquid-glass), swift-testing-pro/-expert, xcode-project-analyzer, spm-build-analysis, Sentry plugin (fix-stack-traces, setup-releases, instrument), gdpr-compliance, app-store-review-audit, greenlight, cowork legal (compliance-check, legal-risk-assessment), cowork design (accessibility-review, design-critique, design-system, ux-copy), cowork engineering (code-review, tech-debt, testing-strategy, deploy-checklist, documentation, architecture), cowork marketing (seo-audit, brand-review), brand-voice-enforcement, humanizer, remove-ai-marks, mrdw-brand-guidelines, mrdw-readme, audit-duplicates, install-anti-slop (as checklist), iso27001 (brief).
- **Deliberately not used (unrelated to a code review):** hatch-pet, morning, schedule, explain-usage, import/consolidate-memory, handoff, packrunner, orchestration/orca, gh-solo-main-protection (config change), xcode-build-benchmark/-fixer/-orchestrator (require builds), core-data-expert/swiftdata-pro (no Core Data/SwiftData in repo), wordpress skills.
- **MCP:** mobile-mcp (iPhone 17e simulator on iOS 27.0, covering the app and mobile Safari; Pixel 10a emulator on Android 17), bun inline repros. **Mobbin:** you authorized it, but every call (from the main session and from a subagent) returned `needs you to sign in again`. An Oct 2 note records the same block as a paid-plan requirement, so the benchmark is a follow-up (Phase 8). The Notion connector isn't authenticated, so planning context came from repo docs. discord-mcp, iconwolf and open-screenshot-generator failed to connect; none were needed.
- **Orchestration (what actually happened):** the first 20-agent workflow (max effort, 6–9 skills per agent) hit the account's session limit in three consecutive windows and **returned no results**, spending about 8.5M subagent tokens. Its redacted transcripts still held progress notes, so I re-checked those leads in code (Appendix A2). A **lean re-run** (6 agents at high effort with 2–3 skills each, 3 at a time) then covered the areas that never ran. It used about 0.54M tokens, returned 55 findings, and found one premise of mine wrong: migration `0001` is not empty. I verified its two highs myself (NC-1, BD-1) and reproduced BD-2. The native, web and admin NN/g code passes were cut off, so UX coverage comes from the device pass, the salvaged notes and the lean review (Appendix E).
- **Baseline checks run:** `bun lint` → 0 errors, 82 Biome warnings; `bun check-types` → all 6 packages pass; `CI=true bun run test` → web 13/13 files, admin 1/1, native 692/693 tests (one load-sensitive timeout, see DEV-16).

## Executive summary

- **No critical findings and nothing needs an emergency change on the live site today.** About 85 distinct findings after merging duplicates: **7 high**, about 38 medium, about 40 low, cosmetic or info. All four Oct 2 findings are still open.
- **Native app (Expo):** the offline-first core is solid and well tested (692/693 tests pass; the one failure is a load-sensitive timeout). The worst user-facing problems:
  - Reminders get **re-armed for panels the convention cancelled** (NC-1, high).
  - Schedule refresh can **shift every time by an hour** (prior P1).
  - Event rows are **unreadable at the largest text size** (DEV-2, high).
  - All app text is about **18% smaller than iOS defaults** (DEV-17).
  - Several honesty gaps: the reminder banner sends never-asked users to a dead end (DEV-4), "Nothing starred yet" shows after a con ends (DEV-5), and the event sheet hides age ratings (DEV-6).
- **Widgets and Watch:** the widget **crashes on every Debug launch** because of a stale self-check (DEV-1, high). The watch **silently freezes on stale data** after one record whose end is before its start (SAL-1, high). The widget shows "empty" while the last panel is still running (prior P1). Czech plurals are wrong (I18N-1). None of the Swift logic has tests (TEST-1).
- **conpaws.com (live waitlist):** the design is careful. It fails closed, admission is atomic, there's no lookup-by-email, and the service worker skips `/api`. The gaps:
  - The **privacy policy promises retention and deletion behavior the code doesn't implement** and omits required GDPR Art. 13 items (PS-1–PS-4). This is the most time-sensitive legal item because signups are live.
  - The "Company" honeypot can **silently drop real signups** (SAL-3, plausible).
  - The documented kill switch only hides the form (SEC-WEB-2).
  - IPv6 /64 rotation bypasses the per-IP cap (SEC-WEB-3).
  - The count endpoint is never edge-cached (SEC-WEB-1).
  - Sitemap hreflang URLs are invalid (SAL-4).
- **Admin (not deployed):** authorization is strong. All 8 server actions re-check the gate, the Access JWT is pinned to RS256 with aud and iss checks, and drafts don't leak. The issues are UX and accessibility: errors are silently lost, every page has the same title, dates show in UTC without a label, and contrast is low. There are no admin tests (TEST-2).
- **Infra/CI/release:**
  - Your **uncommitted Expo bump is inconsistent**: it installs two expo trees and a mismatched React pair (BD-1 high, BD-2). It gets repaired before the commit you approved.
  - The documented rollback path is blocked (infra-4).
  - Deploy validation misses the site URL and Turnstile key (infra-2).
  - Android crashes in Sentry would be unreadable (infra-6).
  - The license manifest is stale (infra-1).

## Remediation plan

Each phase is one PR-sized Codex run on branch `fix/review-2026-10`, in order. IDs point to the appendices. AGENTS.md decisions are respected throughout: no Next bump or vinext, no EAS, no extra listmonk opt-in call, NativeTabs kept, `count: null` semantics kept, no deploys.

### Phase 0 — Prepare (Claude, right after approval)
1. **Repair, then commit the pending Expo bump** (BD-1, BD-2, BD-3; you approved committing it):
   - Root `package.json`: set `"expo": "~57.0.27"` and add `"react-dom": "19.2.3"` beside `"react": "19.2.3"`, then run `bun install`.
   - Check: `bun pm ls --all | rg 'expo@57'` shows only 57.0.27; `cd apps/admin && bun -e 'require("react-dom/client")'` loads; `cd apps/native && bunx expo install --check` passes; `bun lint && bun check-types && CI=true bun run test` pass.
   - Commit on `codex/mobile-nav-refinement`: `chore(deps): align Expo SDK 57.0.27 patch set and React pair`.
2. Create the worktree `git worktree add .claude/worktrees/review-2026-10 -b fix/review-2026-10` and run `bun install --frozen-lockfile` in it. Codex's sandbox has no network. The existing `reverent-lumiere-ed4969` worktree is left alone.
3. Copy this plan to `docs/reviews/2026-10-07-full-review.md` in the worktree and commit it. AGENTS.md keeps review reports in the repo.

### Phase 1 — Live waitlist and public API hardening (web)
**Findings:** SAL-3, SEC-WEB-2 (decision challenge, see Appendix D), SEC-WEB-3, SEC-WEB-4, SEC-WEB-5, SEC-WEB-9, SEC-WEB-1, SEC-WEB-7, SAL-4.
- **Honeypot (`components/waitlist.tsx`):** rename the field and label to something autofill heuristics won't match (not "company", "website" or "url"); add `data-1p-ignore`, `data-lpignore="true"` and `data-form-type="other"`. In `api/waitlist/route.ts`, keep the silent `ok:true` but log a PII-free counter `waitlist.rejected{reason:honeypot|timing}`.
- **Server kill switch:** bind `WAITLIST_ACCEPTING_SIGNUPS` in `packages/infra/alchemy.run.ts` (validated in `packages/env/src/deploy.ts`). The route returns a distinct `503 {error:"closed"}` when it's off, and the client constant follows the same value.
- **Abuse limits:** add migration `0002` with an `ip_bucket` column (IPv4 as is, IPv6 /64) plus an index, and count on it in `admitWaitlistRow`. Restrict `name` to letters, marks, spaces, apostrophes and hyphens, and reject `\p{Cc}`.
- **Reconciler (`lib/waitlist.ts`):** order by `sync_attempted_at`, stop retrying a row after 7 days, and stop refunding attempts forever.
- **Turnstile (`lib/turnstile.ts`):** require hostname ∈ {conpaws.com, www.conpaws.com} and `action === "waitlist"`; set `data-action` on the widget.
- **Count route:** cache through `caches.default` for 5 minutes and fix the comment that claims edge caching (`api/waitlist/count/route.ts:19-46`). Treat the catalog headers the same way.
- **Catalog slugs:** add a `published_slug` column with a unique index, set during the admin publish and restore batches, and read it in `getPublishedSnapshot` (`lib/public-catalog.ts:101`). This is an admin migration, so you run `deploy:admin` before the web deploy.
- **Sitemap:** absolute hreflang URLs built from `src/lib/site.ts` (`app/sitemap.ts`).
- **Tests:** `route.test.ts` (renamed honeypot, closed flag, IPv6 bucket, name rules), `turnstile.test.ts`, `waitlist.test.ts` (reconcile order and cutoff), count-route cache test, `public-catalog.test.ts` (slug reuse), and a new sitemap test.

### Phase 2 — Privacy, consent and store-privacy accuracy
**Findings:** PS-1 (merged with SEC-WEB-6), PS-2, PS-3, PS-4, PS-6, PS-7, PS-8, PS-5/SAL-2, infra-1.
- **`workers/reconcile.ts`:**
  - Add a read-only status sync using listmonk **list queries** (`subscription_status=unsubscribed|confirmed`; not lookup-by-email) that writes `status`/`confirmed_at`.
  - Anonymise unsubscribed rows (null ip, user agent, referer and UTM; keep email and consent copy as suppression evidence).
  - Purge unconfirmed rows after 30 days.
  - Add an erasure path that cannot be resurrected by the hourly replay.
- **Privacy policy (`(legal)/privacy/page.mdx`):**
  - Add a lawful-basis table and an international-transfers section (Cloudflare, AWS SES us-east-1, Sentry US, the listmonk VPS provider).
  - Add the rights to object, restrict and complain, plus concrete retention periods.
  - Disclose Apple/Google geocoding (PS-7) and Sentry diagnostics with the install ID (PS-6).
  - **You review the final legal text before merge.**
- **Consent:** at minimum a localized one-line summary with a link (PS-4); fully localized consent copy plus a `consent_locale` column is a decision for you (Appendix D).
- **Store privacy:** `docs/store-privacy.md` with the App Store privacy label and Play Data safety answers; turn on Sentry IP scrubbing (a dashboard step for you).
- **Native:**
  - Delete the DocumentPicker cache copy after an import (`services/data-import.ts:498-516`).
  - Add `targets/watch/PrivacyInfo.xcprivacy`.
  - Regenerate the open-source license manifest and add `licenses:check` to `ci.yml` and `ship:prep`.

### Phase 3 — Native correctness and Swift tests
**Findings:** NC-1, SAL-1, the two prior P1s (refresh time zone, widget current-only), the two prior P2s (overnight conflicts, bounded-response), NC-2, NC-3, NC-4, NC-5, NC-6, NC-7, DEV-1, I18N-1, I18N-3, PERF-1 (also fixes the DEV-16 flake), TEST-1, MAINT-1.
- **Reminders (`services/notifications.ts`, `db/repositories/events.ts`):** `reconcileEventReminders` skips rows with `feedStatus !== null` (cancel the OS request, keep `reminderMinutes`) and events of archived conventions. Build the stale-cleanup set from armable rows only.
- **Refresh (`services/schedule-refresh.ts:111`):** use the feed-first helper in `src/lib/import-policy.ts`. Pass `feedStatus` through, and have `lib/schedule-changes.ts` stop counting tombstones as "gone".
- **Schedule tab:** compute `overlappingEventIds` over all live saved entries before grouping by day.
- **Downloads:** `lib/bounded-response.ts` cancels the body before throwing on an oversized declared length.
- **Feed parsing:**
  - Move the guarded `decodeHtmlEntities` into `lib/ical-text.ts` and use it in `ecp-feed.ts`.
  - `ical-parser.ts`: apply the same DST round-trip check as `resolveManualEventInstant`, add an `isAllDay` flag for DATE values, and support DURATION.
  - `foldLine`: compute byte size arithmetically with one shared encoder.
- **Backups:** compact JSON export with a size guard against `MAX_BACKUP_BYTES` (`services/data-export.ts:72`).
- **Watch/widget data:**
  - `services/widget-snapshot.ts` drops or clamps inverted ranges.
  - `WatchScheduleStore.isValid` filters bad entries instead of rejecting the whole snapshot.
  - The widget's `.empty` branch keeps the current-only event and distinguishes current/next/finished.
  - Fix the stale `resolve("ja")` assertion, give Czech its own plural rule, map `es`→es-419 and zh-Hant/HK/TW→zhTW, and remove the 8 dead string fields.
- **Swift tests:** add `apps/native/swift-tests/Package.swift` (Swift Testing; symlinks to the Foundation-only `targets/_shared` sources, kept outside `_shared` because apple-targets compiles that whole folder into every target). Move the widget's runtime self-checks there and add parameterized plural, resolve, countdown and snapshot-decode tests (TEST-1).
- **Tests:**
  - `notifications.test.ts`: tombstoned and archived events are not re-armed.
  - `schedule-changes.test.ts`: accumulated tombstones.
  - `ecp-feed.test.ts`: `&#1114112;` and `&#55357;`.
  - `ical-parser` tests: DST gap, DATE-only, DURATION.
  - `schedule-refresh.test.ts`: feed-first zone.
  - Overnight overlap.
  - Bounded-response cancel spy.
  - `widget-snapshot.test.ts`: inverted ranges.
  - `swift test --package-path apps/native/swift-tests`.

### Phase 4 — Native UX and accessibility
**Findings:** DEV-17, DEV-2, DEV-3, DEV-4, DEV-5, DEV-6, DEV-7, DEV-8, DEV-9, DEV-10, DEV-18, DEV-19, the prior P2 "leave" wording, SAL-11, I18N-2.
- **Type scale (your decision: iOS text-style sizes):**
  - Add iOS text-style tokens to `src/global.css` `@theme`: footnote 13, subheadline 15, body 17, title2 22, title1 28, large title 34.
  - Point the `src/components/ui/Text.tsx` variants at them so each `dynamicTypeRamp` scales from the matching base.
  - Audit direct `text-sm`/`text-base` uses; spacing stays as it is.
- **Large text sizes:**
  - `EventItem`: the time column grows (min-width) or moves above the title at large `fontScale`.
  - Make sure line heights scale with Dynamic Type; confirm the clipping root cause on device first.
  - Settings rows stack at accessibility sizes.
- **Honest states:**
  - The reminder banner offers "Turn on reminders" → `requestNotificationPermission()` when permission is undetermined, and "Open Settings" only when denied.
  - Schedule tab "caught up" state.
  - The event sheet shows the age badge and content warning via a helper shared with `EventItem` (`AGE_BADGES`).
  - Friendly time-zone label.
- **Polish:**
  - Preview fixture dates relative to today (`src/fixtures/conpaws-preview.ts`).
  - One `FeatureRow` on onboarding.
  - Consistent capitalization in `en.json`.
  - Replace "leave reminder" copy with plain reminder wording in all 22 locales.
  - i18next plural keys for the ru/pl strings.
  - Android tab label and icon scaling.
  - Medium-widget time truncation (check on a device first).

### Phase 5 — Website and admin UX/accessibility
**Findings:** SAL-5, SAL-6, DEV-13, DEV-14, BD-4, BD-5 (check), BD-6, BD-7, UX-1, I18N-4, SAL-7, SAL-8, SAL-9, SAL-10.
- **Web:**
  - Underline MDX links by default (`mdx-components.tsx:47`).
  - Add `overflow-wrap:anywhere` and `hyphens:auto` on headings, plus 320/375 px overflow checks per locale in `scripts/e2e.ts`.
  - Hide mockup internals from assistive tech, with one label per figure.
  - Show mockup times per locale.
  - Use `min-h-11` for the nav links (`landing.tsx:417`).
  - Remove the dead `nav.established` key.
  - Show full locale codes in the narrow switcher.
  - `locale-detect` applies the stored choice on `/`.
  - Fix the CJK footer word order.
- **Admin:**
  - Add the missing error keys and field-level errors via `useActionState`.
  - Mirror server limits in input attributes.
  - Give each page its own `metadata.title`.
  - Label or localize dates.
  - Raise border and focus contrast to at least 3:1.

### Phase 6 — CI, deploy, release and observability
**Findings:** infra-2, infra-3, infra-4, infra-5, infra-6, infra-7, infra-8, infra-10, infra-11, SEC-WEB-8, SEC-WEB-10 (merged with infra-9), TEST-3.
- **Deploy validation (`packages/env/src/deploy.ts`):** add `NEXT_PUBLIC_SITE_URL` (reject localhost) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Require all four listmonk vars and delete the unreachable "dormant" branch in `deploy-web.yml`.
- **Deploy workflow:**
  - Add a `workflow_dispatch` rollback that takes a `sha` and skips the stale gate after an ancestor check.
  - Make a superseded deploy skip instead of failing.
  - Reduce `permissions` to `contents: read`.
- **CI:**
  - Run the migration-drift check for `apps/admin` too.
  - Add `docker-compose` to Dependabot for `infra/xprem`.
- **Release:**
  - Sentry Android Gradle plugin with ProGuard and native-symbol upload (`app.config.ts:327`).
  - In `RELEASING.md`, explain how the iOS archive gets `SENTRY_AUTH_TOKEN` (`.env.sentry-build-plugin`).
  - `build-number --check` asserts the signing properties are present for production (it never prints their values).
- **Headers:** add a post-deploy check comparing live headers with `securityHeaders('production')`. The Cloudflare zone HSTS-preload and managed-header settings are your call (Appendix D).
- **Catalog binding:** one read-only catalog query module with a test that bans other uses of `CATALOG_DB`, and fix the "read-only" comment.
- **Tests:** pin `TZ` in the vitest configs and add a `TZ=Pacific/Auckland` CI leg.

### Phase 7 — Tests, docs and maintainability
**Findings:** TEST-2, DOCS-1, DOCS-2, BD-3, AGENTS.md updates.
- **Admin tests:** `apps/admin/vitest.config.ts`, plus `auth.test.ts` and `actions.test.ts` covering every exported action's gate.
- **Docs:**
  - README and AGENTS.md say `bun run build`.
  - Restore the logo-regeneration note in `packages/ui/src/components/compass-paw.tsx`.
  - Document why the `expo-constants` override exists, the catalog migration order, the server-side kill switch, the retention job, and the text-style tokens.

### Phase 8 — Follow-ups outside Codex (you, or me on request)
- **Mobbin benchmark:** needs a working Mobbin MCP session, possibly a paid plan. The queries are ready (Appendix A).
- **Cloudflare dashboard:** the HSTS-preload and managed-header choice, and Sentry IP scrubbing.
- **Production D1:** confirm migration `0001` is applied (`wrangler d1 migrations list --remote`, read-only).
- **Store answers:** enter the App Store and Play privacy answers from `docs/store-privacy.md`.
- **Devices:** check on a physical iPhone, Apple Watch and Android phone.
- **Deploys:** you run `bun run deploy:admin`, then `bun run deploy`.
- **Push and PR:** only when you ask.

## Codex handoff (after approval)

- **Runner:** Codex CLI 0.160.1 with `-m gpt-6-luna -c model_reasoning_effort="medium"` ("Luna on med"), one phase per run, in order, all in the same worktree so each phase builds on the last.
- **Command per phase** (prompt and output files go in the session scratchpad):
  `codex exec -m gpt-6-luna -c model_reasoning_effort="medium" -s workspace-write --approve-for-me -C .claude/worktrees/review-2026-10 -o <scratchpad>/codex-phase-N.md - < <scratchpad>/codex-phase-N-prompt.md`
  I run it in the background and watch it.
- **Phase prompt contents:**
  - The phase section from `docs/reviews/2026-10-07-full-review.md`.
  - The rules: follow AGENTS.md; read the relevant Codex skills first (expo, cloudflare, codex-security, swiftui-pro, swift-testing-pro, uiux-review); implement only that phase; add the listed tests.
  - Run `bun lint`, `bun check-types`, `CI=true bun run test` (and `swift test` once the package exists).
  - One commit per phase, e.g. `fix(web): harden waitlist abuse limits (review 2026-10 phase 1)`.
  - Never push, deploy, touch production listmonk/Cloudflare/Sentry, or bump Next.
- **Gate between phases (me):**
  - Re-run lint, type checks and all tests in the worktree.
  - Review the phase diff against this plan (code-review skill).
  - For the native phases (3 and 4), check on the iPhone 17e simulator with mobile-mcp: default and AX5 text, light and dark. Metro runs from the worktree. Native target changes need a dev-client rebuild (`bun run --cwd apps/native ios`).
  - On a failure, resume Codex once with the failure output (`codex exec resume --last`); if it still fails, stop and report.
- **Finish:** I summarize each phase's commits and checks, then ask before any push or PR.

## Verification

- **Repo-wide after every phase:**
  - `bun lint`: 0 errors, and no more than 82 warnings.
  - `bun check-types`: passes.
  - `CI=true bun run test`: green, including `ecp-feed` under parallel load.
  - `swift test --package-path apps/native/swift-tests` from Phase 3 on.
- **Web:**
  - `bun run --filter @conpaws/web preview` (local Worker on 8789, local D1 migrated).
  - `apps/web/scripts/e2e.ts` across 23 locales at 320/375 px.
  - curl the local sitemap: alternates are absolute.
  - Local POSTs only: honeypot and timing rejections increment the counter; the closed flag returns 503 "closed"; wrong hostname or action fails Turnstile verification (test keys).
  - Never POST to production.
- **Native:**
  - iPhone 17e simulator via mobile-mcp: onboarding, convention rows at default and AX5, event sheet age badge, reminder banner (undetermined → system prompt), Schedule "caught up", Debug preview data now dated live, widget renders in Debug with no crash report.
  - Watch keeps updating with an inverted event in the feed (unit test plus manual).
  - Android emulator at font scale 2.0 on a fresh debug build.
- **Admin:** `bun dev:admin` with a seeded local D1: a duplicate slug shows an error, each page has its own title, dates are labelled, borders reach 3:1.
- **Privacy:** you approve the policy text; the retention and status sync is tested against a mocked listmonk list API.

---

## Appendix A — Live device pass (mobile-mcp, iPhone 17e simulator, iOS 27.0, dev-client build 1.0.0 (207) + Metro `APP_VARIANT=preview`)

Flows exercised: cold launch → onboarding (welcome, features, get-started, swipe-back) → empty Conventions → Settings (all sections) → Debug Tools → load preview data → Archive → convention detail (banners, rows, conflicts, badges) → event action sheet → Schedule tab; repeated in **dark mode at the largest accessibility text size (AX5)**; conpaws.com in mobile Safari (scroll, a11y tree; the waitlist form was **not** submitted). Not exercised: Android, Apple Watch, widgets on the Home/Lock Screen (the extension crashes in Debug, DEV-1), VoiceOver gestures, physical device.

| ID | Sev | Finding (evidence) | Fix |
|---|---|---|---|
| DEV-1 | High (dev/QA) | **Widget extension crashes on every launch in Debug builds.** 3 crash reports (`widget-2026-10-06-2026{28,709,712}.ips`): `EXC_BREAKPOINT` in `_assertionFailure` ← `runConPawsWidgetSelfCheck()` ← `ConPawsWidgetBundle.init()` (`targets/widget/index.swift:9`). `targets/widget/widgets.swift:1582` asserts `ConPawsLanguage.resolve("ja") == .en`, but `ja` became a shipped case in `2f0a152` (Aug 30), so it always fails. Release strips `assert`, so users are unaffected — but no Debug/dev-client build has been able to render the widget since Aug 30, and every self-check after it never runs. | Assert an unshipped language (e.g. `"tr" == .en`) and `resolve("ja") == .ja`; move these checks into a Swift Testing package that CI runs (see tests batch) instead of trapping at runtime. |
| DEV-2 | High (a11y) | **Convention schedule rows are unreadable at AX5.** Titles clip vertically, descriptions overlap titles, the time column wraps mid-token (`7:00P` / `M`) and end times are cut off. Time column is a fixed `w-20` with `maxFontSizeMultiplier={1.6}` (`src/components/EventItem.tsx`); iOS joins time and AM/PM with U+202F so the breaker splits the word. Title clipping suggests NativeWind `text-*` utilities emit a fixed `lineHeight` that does not follow `dynamicTypeRamp` scaling (to confirm). WCAG 1.4.4; HIG Dynamic Type. | Let the time column grow (min-width) or stack time above the title when `useWindowDimensions().fontScale` is large; drop/scale fixed line heights in `ui/Text.tsx` variants; add AX5 states to the UI-system screen and check them on device. |
| DEV-3 | Medium (a11y) | Settings → "Default leave reminder" at AX5: label and picker stay side by side, the value breaks mid-word (`No`/`ne`), the label hyphenates down the screen, the description truncates. | Stack label over value at accessibility sizes (as iOS Settings does). |
| DEV-4 | Medium (UX) | **Reminder banner sends "never asked" users to a dead end.** `src/lib/reminder-notice.ts:31` returns `"permission"` for any status ≠ `granted`, including `undetermined`; the banner says "Notifications are off…" and `Linking.openSettings()` (`ReminderNoticeBanner.tsx:36-40`) — iOS shows no notification toggle for an app that has never requested permission. Observed: Settings said "Not requested yet" while the convention screen said "Notifications are off". | Split `undetermined` (CTA "Turn on reminders" → `requestNotificationPermission()` in `src/services/notifications.ts:38`) from `denied` (CTA "Open Settings"); update copy in all 22 locales. |
| DEV-5 | Medium (UX) | **Schedule tab claims "Nothing starred yet" after a con ends.** `groupPersonalScheduleByDay` drops ended entries (`src/lib/personal-schedule.ts:53`), so a user whose starred events are all past is told to "Tap an event… to add it" (`app/(tabs)/schedule/index.tsx:376-383`). | Distinguish "no starred events" from "all starred events have ended" (caught-up state + link to the convention). |
| DEV-6 | Medium (UX/safety) | **Event sheet hides age ratings and content warnings** that the row shows. List row shows "17+ Mature"; the sheet for the same event shows only provenance/reminder badges (`convention-detail/EventActionSheet.tsx:106-108` vs `EventItem.tsx` `AGE_BADGES` + `AlertTriangle`). | Extract the age/content-warning badge mapping from `EventItem.tsx` into a shared helper and render it in the sheet header. |
| DEV-7 | Low | "Times shown in America/New_York" — raw IANA id shown to users (convention detail header). | Show a localized zone name (Intl `timeZoneName: 'longGeneric'`) + city; keep the IANA id secondary. |
| DEV-8 | Low (tooling) | Debug "Preview Content State" fixture is pinned to Sep 3–6, 2026 (`src/fixtures/conpaws-preview.ts:7,281`), so both preview cons load straight into Archive and Now/Next, widgets and reminders can't be previewed. | Make fixture dates relative to "today" (e.g. start yesterday). |
| DEV-9 | Low (visual) | Onboarding "Plan the whole con" uses three different row layouts (`app/(onboarding)/features.tsx:107-139`); "Free and offline" uses a cloud icon (key `plus`, a ConPaws+ leftover); comment says "eight locales" (now 22). | One `FeatureRow` (icon + title + description, same alignment); offline icon; fix comment. |
| DEV-10 | Low (content) | Mixed capitalization across native UI: "Import Schedule", "Create Convention", "Haptic Feedback", "Export Data" vs "Import a schedule", "Explore first", "Check for schedule updates", "Default leave reminder". | Pick one convention per element type and apply across `en.json` (translations follow their own rules). |
| DEV-11 | Cosmetic (judgment) | Empty states on Conventions and Schedule sit in the lower third under a large blank area. May be intentional (thumb reach). | Confirm intent; otherwise center. |
| DEV-12 | Info | Dev-client simulator launches log `ERR_NOTIFICATIONS_KEYCHAIN_ACCESS` from expo-notifications (unsigned simulator build, no team ID) and a benign "Sentry.wrap before Sentry.init" warning (Sentry intentionally off in dev). | Verify the keychain error does not occur on a signed device build. |
| DEV-13 | Medium (a11y, web) | conpaws.com phone mockups are exposed to VoiceOver as dozens of text nodes, including fake controls ("Remove from My Schedule", "Change leave reminder", "View on Sched", "Close") and a fake tab bar. | `aria-hidden="true"` on mock internals + one descriptive label per figure. |
| DEV-14 | Cosmetic (web) | Mockups show 24-hour times ("20:00") while English UI uses 12-hour; mock tab-bar text is clipped by the phone frame. | Format mock times per locale; adjust mock padding. |
| DEV-15 | Observation (web perf) | Simulator Safari cold load showed ~15–20 s blank before first paint (curl TTFB 0.42 s). Likely simulator cold start. | Re-measure on a real device / Lighthouse mobile profile before acting. |
| DEV-17 | Medium (visual/readability) | **Native type scale is ~18% below iOS defaults.** NativeWind/react-native-css resolves `1rem = 14pt` on native and no override exists (`metro.config.js` passes no rem option; `src/global.css` `@theme` sets no `--text-*`). The Metro bundle shows `text-sm → fontSize 12.25`, `text-base → 14`. `src/components/ui/Text.tsx` maps `body`→`text-base` (14pt) with ramp `body` (iOS 17pt), `label`→`text-sm` (12.25pt) with `subheadline` (15pt) — event titles render at 12.25pt — `caption`→`text-sm` with `footnote` (13pt), `h1`→`text-3xl` (26.25pt) with `largeTitle` (34pt). The ramp names show the intent was iOS text-style sizes. | Decision: override the `--text-*` sizes in `global.css` `@theme` to iOS point sizes (typography only, recommended) **or** set rem to 16 (also rescales all spacing). Re-check every screen at default and AX sizes afterwards. |
| DEV-16 | Low (tests) | `apps/native/src/lib/ecp-feed.test.ts › stops multibyte output at the byte ceiling while rendering` timed out (5124 ms) under load; passes alone in 603 ms → flaky on slow CI runners. | Shrink the fixture or set an explicit timeout; check for quadratic rendering. |

**Android quick pass** (Pixel 10a emulator, Android 17, the only installed build: release APK 1.0.0 (207) from Aug 31 with an embedded JS bundle, so screens predate five weeks of JS changes; re-verify on a current build):

| ID | Sev | Finding | Fix |
|---|---|---|---|
| DEV-18 | Low (a11y) | At font scale 2.0 the bottom-navigation label truncates to "Conventio…". | Shorter tab label (e.g. "Cons"), or let labels wrap or hide at large font scales per Material guidance. |
| DEV-19 | Cosmetic | At font scale 2.0, row icons (~16 dp) and the top-bar title stay small while body text doubles. | Scale leading icons with the font scale; check header title scaling. |

Positive: the empty state and Settings reflow cleanly at 2.0 (buttons stack, nothing clips), unlike the iOS event rows at AX5 (DEV-2).

**Mobbin:** OAuth was completed, but every Mobbin call (from the main session and from a subagent) returned `MCP server "mobbin" needs you to sign in again`. `docs/mobile-ux/RESEARCH.md:305` records that on Oct 2 access was "blocked by a paid-plan requirement", so the account likely needs a paid Mobbin plan for MCP. The benchmark is therefore a follow-up (Phase H). Queries ready to run: event onboarding that finds/joins your event; agenda grouped by day with conflict warnings; session detail sheet with age rating and reminder; saved-schedule empty and caught-up states; notification priming before the system prompt; settings with backup and notification defaults; waitlist hero with phone mockups, FAQ and CTA band; "happening now / up next" views.

Prior-fix confirmations from the live pass: the floating "Get in line →" action appears only after scrolling past signup; the page scrolls normally; the language button and nav render without overlap at 390 px.

## Appendix A2 — Leads salvaged from the first run and confirmed in code

The first 20-agent run hit the account's session limit three times and returned nothing. Its transcripts kept progress notes, and the leads below were re-checked directly in code for this plan. "Measured by reviewer" means the number comes from the interrupted agent's inline measurement and still needs confirming on a device or in a browser.

| ID | Sev | Finding (evidence) | Fix |
|---|---|---|---|
| SAL-1 | High | **Watch freezes on stale data after one bad record.** `targets/watch/WatchScheduleStore.swift:97-124` `isValid` rejects the *entire* snapshot if any event has `endAtMs < startAtMs` or any convention ends before it starts; `save()` then silently returns. The producer passes such records through (`src/services/widget-snapshot.ts:93-100,125-130`). ICS feeds with DTEND < DTSTART, and conventions edited or imported with inverted dates, both trigger it (reviewer reproduced with the real parser + `buildWidgetSnapshot`). | Sanitize at the producer (drop or clamp inverted event ends, clamp convention ranges) **and** validate per item on the watch (filter bad entries, keep the rest); add a TS↔Swift contract test. |
| SAL-2 → PS-5 | Low (store) | **Watch app has no privacy manifest of its own.** `targets/watch/` has no `PrivacyInfo.xcprivacy` (widget and watch-widget do) while it reads App Group `UserDefaults`. The lean review found that today the generated project copies the main app's manifest into the watch Resources phase. That is a side effect of Expo's plugin, not repo config, so it is not a rejection today, but it is fragile (ITMS-91053 if it stops). | Add `targets/watch/PrivacyInfo.xcprivacy` (copy of the widget's) and assert exactly one manifest per bundle after prebuild. |
| SAL-3 | Medium (live waitlist) | **Honeypot can silently eat real signups.** The trap field is labelled "Company" (`name="company"`, `autoComplete="off"`, off-screen) in `apps/web/src/components/waitlist.tsx:249-259`. Browsers and password managers that autofill an organization field ignore `off`, and `api/waitlist/route.ts:146-147` answers `{ ok: true }` to any honeypot hit, so the person sees success but never gets the opt-in email, and nothing counts these rejections. Plausible; verify with Safari and Chrome autofill using a contact card that has a company. | Rename the field and label to something no autofill heuristic matches; add `data-1p-ignore`/`data-lpignore`; log a PII-free counter for honeypot and timing-gate rejections. |
| SAL-4 | Medium (SEO, live) | Sitemap hreflang alternates are relative (`<xhtml:link … href="/es-419" />` in the live `/sitemap.xml`, from `apps/web/src/app/sitemap.ts`). Google requires fully qualified URLs, so the 23-locale alternates are ignored. | Build absolute URLs from the site base in `src/lib/site.ts`; extend `robots.test.ts`-style coverage to the sitemap. |
| SAL-5 | Medium (a11y, web) | Legal-page links are only underlined on hover (`apps/web/src/mdx-components.tsx:47` `hover:underline`); the reviewer measured about 1.01:1 luminance contrast against body text, so color alone marks links. WCAG 1.4.1. | Underline links by default (keep `underline-offset-2`). |
| SAL-6 | Medium (mobile web) | Long localized words overflow the hero at 375 px (reviewer measured `nb` "Konventprogrammet" ≈ 446 px at 42 px bold vs a 327 px content box). There is no `overflow-wrap`/`hyphens` anywhere in `apps/web/src/index.css` or `landing.tsx`. | `overflow-wrap: anywhere` plus `hyphens: auto` on headings (each locale page already sets `lang`); add 320/375 px overflow checks per locale to `apps/web/scripts/e2e.ts`. |
| SAL-7 | Medium (admin UX) | Admin errors are lost. `actions.ts:166` redirects with `?error=slug` but `conventions/[id]/page.tsx:38-46` `errorMessages` has no `slug` key (silent failure). `?error=missing` (`actions.ts:223,309,407`) is not handled (reviewer). Server-side Zod failures collapse to "Check the fields" (reviewer: 9 inputs pass browser constraints but fail the server). | Add the missing keys; return field-level errors (`useActionState`) instead of redirect codes; mirror server limits in input attributes. |
| SAL-8 | Low (admin a11y) | Every admin page has the same title: only `app/layout.tsx` defines metadata (template `%s · ConPaws Admin`, never filled), so route changes aren't announced. WCAG 2.4.2. | Export `metadata.title` from each page. |
| SAL-9 | Low (admin) | Dates are forced to UTC with no label (`team/page.tsx:87-90` `timeZone: "UTC"`; activity `formatMoment`), so US staff see shifted dates and times. | Format in the viewer's zone (client) or label UTC explicitly. |
| SAL-10 | Low (admin a11y) | Reviewer computed form-control borders and focus indicators under 3:1 (WCAG 1.4.11) from the Tailwind 4 OKLCH tokens. | Confirm, then use a darker slate border and focus ring. |
| SAL-11 | Medium (widget) | Reviewer measured that medium-widget time labels truncate for every 12-hour cross-day row (SF Pro metrics). Needs device confirmation. | Abbreviate the day, or move the end time to a second line in the medium family. |
| SAL-12 | Low | Reviewer found 8 unused fields in the `ConPawsStrings.swift` tables (lean review to confirm). | Remove them, or generate the table from the JSON locales. |

**Status of the Oct 2 findings (docs/mobile-ux/RESEARCH.md): all still open.**

| Prior finding | Status | Evidence |
|---|---|---|
| P2 overnight conflicts lost by per-day grouping | Still open | `app/(tabs)/schedule/index.tsx` ~227-260 computes `overlappingEventIds` per `day` section |
| P2 early Content-Length rejection doesn't cancel the body | Still open | `src/lib/bounded-response.ts:18-20` throws before cancel (cancel only in the streaming path, :38) |
| P1 refresh parses with the saved zone (1-hour shift) | Still open | `src/services/schedule-refresh.ts:111-112` `parseIcs(..., { timeZone: convention.timeZone })` instead of the feed-first helper in `src/lib/import-policy.ts` |
| P1 widget discards the current-only event | Still open | `targets/widget/widgets.swift` ~137-151: `guard let upcoming … else { return .empty }` after computing `current` |
| P2 reminder wording overclaims ("leave") | Still open | Device: "Set leave reminder", "Default leave reminder", "Set a leave reminder on the later panel" |

## Appendix B — UI/UX Review: ConPaws (native app, widgets/watch, conpaws.com, admin)

**Reviewed:** 2026-10-07 · **Input:** live iOS 27 simulator and Android 17 emulator (mobile-mcp), live conpaws.com (mobile Safari, HTML/CSS), source code · **Method:** NN/g heuristic evaluation plus guideline review

### Executive summary
- The core flows are short and clear: three onboarding screens with Skip and swipe-back, empty states that always offer the next step, and actions disabled while loading. On the website the signup form sits in the first mobile viewport.
- **The worst problem:** at the largest Dynamic Type size, event rows (the app's core content) become unreadable (R1).
- Several states tell users something untrue: reminders for cancelled panels (R2), a frozen watch (R3), an empty widget during the last panel (R4), a success message for a dropped signup (R5), "Nothing starred yet" after a con (R7), and "Notifications are off" before the app ever asked (R6).
- There are no catastrophic findings. The 5 major ones are justified inline.

**Findings:** 🟥 0 catastrophic · 🟧 5 major · 🟨 17 minor · ⬜ 9 cosmetic (+1 reviewer judgment)

### 🟧 Severity 3 — Major
#### R1. Event rows unreadable at the largest text size (refs: DEV-2)
- **What:** At AX5, titles clip, descriptions overlap the titles, "7:00 PM" wraps to "7:00P"/"M", and end times are cut off. This blocks reading the schedule, the app's main task, for every low-vision user who relies on large text.
- **Where:** Convention schedule rows: `src/components/EventItem.tsx` (time column `w-20`, `maxFontSizeMultiplier={1.6}`), `src/components/ui/Text.tsx`.
- **Guideline:** Text must stay readable when enlarged.
- **Evidence:** [Understanding 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): content and function must survive enlargement. [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/): text that can't be made out can't be read at all.
- **Fix:**
  - [ ] Let the time column grow, or stack time above the title at large `fontScale`.
  - [ ] Confirm the line-height root cause on device and make line heights scale.
  - [ ] Add AX5 rows to the UI-system screen and check them on device. (Phase 4)

#### R2. Reminders fire for panels the convention cancelled (refs: NC-1)
- **What:** After a refresh cancels a starred panel, the next foreground re-arms its "Time to leave" notification. It sends users to an event that no longer exists, and it fires on every app launch.
- **Where:** `src/services/notifications.ts:234-282`, `src/db/repositories/events.ts:554-559`.
- **Guideline:** Visibility of system status (accurate feedback); error prevention.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): systems should keep users informed with accurate, timely feedback.
- **Fix:**
  - [ ] Skip tombstoned and archived events when reconciling.
  - [ ] Add a test. (Phase 3)

#### R3. Watch silently keeps a stale schedule (refs: SAL-1)
- **What:** One event whose end is before its start, or a convention with inverted dates, makes the watch reject every later snapshot. The watch shows outdated times with no warning, in the place people glance at during a con.
- **Where:** `targets/watch/WatchScheduleStore.swift:97-124`, `src/services/widget-snapshot.ts:93-130`.
- **Guideline:** Visibility of system status.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): users should always know what's going on.
- **Fix:**
  - [ ] Sanitize inverted ranges at the producer.
  - [ ] Validate per item on the watch. (Phase 3)

#### R4. Widget shows "empty" while the last panel is still running (refs: prior P1)
- **What:** When the in-progress event is the last one, the widget reports nothing on. That's wrong on every convention's final evening.
- **Where:** `targets/widget/widgets.swift`, around lines 137-151.
- **Guideline:** Visibility of system status.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Separate the current-only, next, finished and no-events states. (Phase 3)

#### R5. A real signup can be swallowed with a success message (refs: SAL-3; needs browser verification)
- **What:** The hidden trap field is named and labelled "Company". If browser or password-manager autofill fills it, the server silently returns success, so the person never gets the opt-in email and never knows why.
- **Where:** `apps/web/src/components/waitlist.tsx:249-259`, `apps/web/src/app/api/waitlist/route.ts:146-147`.
- **Guideline:** Feedback must reflect reality; forms must not fail silently.
- **Evidence:** [Website Forms Usability: Top 10 Recommendations](https://www.nngroup.com/articles/web-form-design/): form feedback should clearly tell users what happened.
- **Fix:**
  - [ ] Use a field name and label that no autofill heuristic matches, plus password-manager ignore attributes.
  - [ ] Count rejections. (Phase 1)

### 🟨 Severity 2 — Minor
#### R6. "Notifications are off… Open Settings" shown before the app ever asked (refs: DEV-4)
- **What/Where:** `src/lib/reminder-notice.ts:31` treats `undetermined` as denied. iOS Settings has no toggle for an app that has never asked.
- **Guideline:** Error messages must state the real problem and a fix that works.
- **Evidence:** [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/): messages should describe the problem precisely and offer a constructive way out.
- **Fix:**
  - [ ] Undetermined → "Turn on reminders" (the system prompt); denied → "Open Settings". (Phase 4)

#### R7. Schedule tab says "Nothing starred yet" after a con ends (refs: DEV-5)
- **What/Where:** Ended events are dropped (`src/lib/personal-schedule.ts:53`), then the empty-state copy tells the user to start starring.
- **Guideline:** Visibility of system status.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Add a "caught up" state with a link to the convention. (Phase 4)

#### R8. The event sheet hides age ratings and content warnings shown in the list (refs: DEV-6)
- **What/Where:** `EventActionSheet.tsx:106-108` vs `EventItem.tsx` `AGE_BADGES`. Observed: "17+ Mature" shows in the row but not in the sheet.
- **Guideline:** Recognition rather than recall; consistency.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): keep needed information visible where decisions are made.
- **Fix:**
  - [ ] Share the badge mapping and render it in the sheet header. (Phase 4)

#### R9. All native text is about 18% smaller than iOS defaults (refs: DEV-17)
- **What/Where:** NativeWind `1rem = 14pt`, so body is 14pt (iOS 17pt) and event titles are 12.25pt (subheadline is 15pt). The cause is `src/components/ui/Text.tsx` combined with `src/global.css`.
- **Guideline:** Use the platform's text-style sizes as the base for Dynamic Type.
- **Evidence:** [Apple HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography) (text styles and default sizes); [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/).
- **Fix:**
  - [ ] Add iOS text-style tokens and point the `Text` variants at them (your decision). (Phase 4)

#### R10. Settings rows break words at accessibility sizes (refs: DEV-3)
- **What/Where:** "Default leave reminder": the value renders "No / ne", the label hyphenates, and the description truncates.
- **Guideline:** Text must stay readable when enlarged.
- **Evidence:** [Understanding 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html); [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- **Fix:**
  - [ ] Stack the label above the value at accessibility sizes. (Phase 4)

#### R11. Overnight conflicts are not flagged (refs: prior P2)
- **What/Where:** Overlaps are computed per day section (`app/(tabs)/schedule/index.tsx`, around lines 227-260), so a 23:30 panel overlapping a 00:15 panel gets no warning.
- **Guideline:** Error prevention.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Compute overlaps before grouping by day. (Phase 3)

#### R12. Links on the legal pages are distinguished only by color (refs: SAL-5)
- **What/Where:** `apps/web/src/mdx-components.tsx:47` (`hover:underline` only). Measured luminance contrast against body text is about 1.01:1.
- **Guideline:** Color can't be the only visual cue.
- **Evidence:** [Understanding 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).
- **Fix:**
  - [ ] Underline links by default. (Phase 5)

#### R13. Long localized hero words overflow at 375 px (refs: SAL-6)
- **What/Where:** Norwegian "Konventprogrammet" measures about 446 px against a 327 px box. No `overflow-wrap` or `hyphens` exists in `index.css` or `landing.tsx`.
- **Guideline:** Reflow without horizontal scrolling.
- **Evidence:** [Understanding 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- **Fix:**
  - [ ] Add `overflow-wrap:anywhere` and `hyphens:auto`.
  - [ ] Add per-locale overflow checks to e2e. (Phase 5)

#### R14. Decorative phone mockups read as fragmented fake UI to VoiceOver (refs: DEV-13)
- **What/Where:** The mockups expose dozens of text nodes to VoiceOver, including "Remove from My Schedule", "View on Sched" and "Close", plus a fake tab bar.
- **Guideline:** Presentation must not convey false structure; minimize noise.
- **Evidence:** [Understanding 1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html).
- **Fix:**
  - [ ] Hide the mockup internals from assistive tech; give each figure one label. (Phase 5)

#### R15. Admin form errors are silently lost (refs: SAL-7)
- **What/Where:**
  - `?error=slug` has no message on the edit page (`conventions/[id]/page.tsx:38-46`).
  - `?error=missing` isn't handled.
  - Server validation detail collapses to a generic message.
- **Guideline:** Errors should be visible, specific and next to the problem.
- **Evidence:** [Error-Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/).
- **Fix:**
  - [ ] Add the missing keys.
  - [ ] Show field-level errors via `useActionState`. (Phase 5)

#### R16. Medium-widget times truncate on cross-day 12-hour rows (refs: SAL-11; needs device)
- **What/Where:** Measured with SF Pro metrics in `targets/widget/widgets.swift` (medium family).
- **Guideline:** Legibility.
- **Evidence:** [Legibility, Readability, and Comprehension](https://www.nngroup.com/articles/legibility-readability-comprehension/).
- **Fix:**
  - [ ] Abbreviate the day, or move the end time to a second line. (Phase 4)

#### R17. Czech plurals are wrong on the widget and watch (refs: I18N-1)
- **What/Where:** `ConPawsStrings.swift:86` gives Czech the Polish rule, so it shows "za 22 hodiny" where "za 22 hodin" is correct.
- **Guideline:** Match between system and real world.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Give Czech its own rule and add tests. (Phase 3)

#### R18. Header nav targets shrank to 40 px (refs: BD-4)
- **What/Where:** `landing.tsx:417` uses `min-h-10`, while the repo's own convention is 44 px; wrapped rows are 2 px apart.
- **Guideline:** Touch targets should be large and well spaced.
- **Evidence:** [Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/); [Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). 40 px passes the 24 px minimum, so this is a recommendation, not a WCAG failure.
- **Fix:**
  - [ ] Use `min-h-11`. (Phase 5)

#### R19. The chosen site language isn't applied on return to "/" (refs: UX-1)
- **What/Where:** `locale-detect.tsx:67` only redirects when nothing is stored.
- **Guideline:** User control; consistency.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Apply the stored choice. (Phase 5)

#### R20. "Leave reminder" wording overclaims (refs: prior P2)
- **What/Where:** "Set leave reminder" and "Default leave reminder" suggest a departure time, but the app subtracts minutes from the start time and knows nothing about walking time.
- **Guideline:** Match between system and real world.
- **Evidence:** [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- **Fix:**
  - [ ] Use plain reminder wording in all locales. (Phase 4)

#### R21. Every admin page has the same title (refs: SAL-8)
- **What/Where:** Only `apps/admin/src/app/layout.tsx` sets metadata, so route changes aren't announced.
- **Guideline:** Pages must have descriptive titles.
- **Evidence:** [Understanding 2.4.2 Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html).
- **Fix:**
  - [ ] Export a `metadata.title` from each page. (Phase 5)

#### R22. Admin form borders and focus rings may be under 3:1 (refs: SAL-10; needs confirmation)
- **What/Where:** Computed from the Tailwind 4 OKLCH tokens in `apps/admin/src/app/globals.css`.
- **Guideline:** UI component boundaries need 3:1 contrast.
- **Evidence:** [Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- **Fix:**
  - [ ] Use a darker border and focus ring. (Phase 5)

### ⬜ Severity 1 — Cosmetic
23. **Raw IANA zone shown ("America/New_York")** (DEV-7). Match between system and real world ([heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)). Show a localized zone name. (Phase 4)
24. **Three onboarding feature rows, three layouts; cloud icon for "offline"** (DEV-9, `features.tsx:107-139`). Consistency ([heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)). One `FeatureRow`. (Phase 4)
25. **Mixed Title Case and sentence case** (DEV-10). Consistency. Pick one rule per element type. (Phase 4)
26. **Android tab label truncates at font scale 2.0** (DEV-18). [Apple HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), applied as the cross-platform Dynamic Type principle. Shorter label. (Phase 4)
27. **Row icons and top-bar titles don't scale with text** (DEV-19). Same source. Scale icons with the font scale. (Phase 4)
28. **Mockups use 24-hour times for English; mock tab bar is clipped** (DEV-14). Consistency. Format mock times per locale. (Phase 5)
29. **Narrow language switcher shows ambiguous "ES"/"PT"/"ZH"** (BD-7). Recognition rather than recall. Show the full code. (Phase 5)
30. **CJK footer keeps the English "by"** (I18N-4). Match between system and real world. Use a word-order-neutral string. (Phase 5)
31. **Admin dates forced to UTC with no label** (SAL-9). Match between system and real world. Use the viewer's zone, or label it UTC. (Phase 5)

### Reviewer judgment (no NN/g citation)
- 32. The Conventions and Schedule empty states sit in the lower third, under a large blank area (DEV-11). This may be deliberate for thumb reach; confirm, otherwise center them.

### Unverified (needs a different input to check)
- VoiceOver and TalkBack gestures and announcement order: no screen-reader session was run.
- Home Screen and Lock Screen widget rendering: the widget crashes in Debug (DEV-1). The watch UI wasn't checked because no watch simulator was paired.
- Physical iPhone, Watch and Android hardware.
- Admin rendering: not deployed, reviewed in code only.
- Honeypot autofill in real Safari and Chrome.
- Lanyard and nav overlap at 768–1180 px (BD-5).
- A full dark-mode contrast table for every native token pair: the accessibility pass was cut off.
- Mobbin pattern comparisons: blocked.

### What's working well
- **Onboarding:** three short screens, Skip on each, native swipe-back, and an up-front "No account required. Your data stays local."
- **Empty and loading states:** empty states always offer the next action, and loading states disable controls with a clear label ("Loading Preview Cons").
- **Conflicts and saved items:** conflicts are spelled out in text ("Overlaps another saved panel"), not only color, and saved rows get an accent bar and a star.
- **Web:** signup is in the first mobile viewport, the floating "Get in line" appears only after the form scrolls away, and Android reflows cleanly at font scale 2.0.

### Quick wins
- [ ] R12: underline MDX links (one class).
- [ ] R18: `min-h-10` → `min-h-11`.
- [ ] R29 and R30: full locale codes; CJK footer string.
- [ ] R21: page titles in admin.
- [ ] R23: friendly time-zone label.
- [ ] R24: shared `FeatureRow`.
- [ ] SAL-4: absolute sitemap hreflang (not UX, about 5 lines).

## Appendix C — Engineering, security, privacy and infra findings (lean review, 55)

| ID | Sev | Finding | Location | Phase |
|---|---|---|---|---|
| NC-1 | High | Reminder reconcile re-arms OS reminders for cancelled/removed events (verified) | `apps/native/src/services/notifications.ts:234-282` | 3 |
| BD-1 | High | Root `package.json` pins expo ~57.0.26, so the lock installs two expo trees (verified) | `package.json:66` | 0 |
| BD-2 | Med | Lock pairs root react-dom 19.2.8 with react 19.2.3; `react-dom/client` throws in admin (reproduced) | `bun.lock` | 0 |
| SEC-WEB-1 | Med | Count and catalog APIs are never edge-cached; each GET calls listmonk or scans D1 (live check) | `apps/web/src/app/api/waitlist/count/route.ts:46` | 1 |
| SEC-WEB-2 | Med | Kill switch exists only in the client; the API ignores it (decision challenge) | `apps/web/src/components/waitlist.tsx:29` | 1 |
| SEC-WEB-3 | Med | Per-IP cap keys on the full IPv6 address; rotating within a /64 bypasses it | `apps/web/src/app/api/waitlist/route.ts:68` | 1 |
| SEC-WEB-4 | Med | Reconciler is head-of-line blocked by forever-refunded 5xx rows | `apps/web/src/lib/waitlist.ts:217` | 1 |
| SEC-WEB-5 | Med | Attacker-chosen name text lands in opt-in mail to arbitrary addresses | `apps/web/src/app/api/waitlist/route.ts:40` | 1 |
| SEC-WEB-6 → PS-1 | Med | Policy promises deletion on unsubscribe; nothing deletes or updates rows | `privacy/page.mdx:157` | 2 |
| SEC-WEB-7 | Med | Published slug lookup can return the wrong convention after a slug is reused | `apps/web/src/lib/public-catalog.ts:101` | 1 |
| SEC-WEB-8 | Low | Live headers come from Cloudflare zone settings (HSTS preload on, despite the repo's stated intent) | `apps/web/src/lib/csp.ts:68` | 6 / D |
| SEC-WEB-9 | Low | Turnstile result not checked for hostname or action | `apps/web/src/lib/turnstile.ts:38` | 1 |
| SEC-WEB-10 = infra-9 | Low | "Read-only" CATALOG_DB binding gives the public Worker write access | `packages/infra/alchemy.run.ts:99-114` | 6 |
| NC-2 | Med | Tombstones counted as "gone" on every refresh; auto-refresh gets stuck as untrusted | `apps/native/src/lib/schedule-changes.ts:115` | 3 |
| NC-3 | Med | ECP entity decoder throws on `&#1114112;`; full import silently falls back to the truncated feed | `apps/native/src/lib/ecp-feed.ts:253` | 3 |
| NC-4 | Med | Pretty-printed, unbounded export vs an 8 MB restore cap; a valid backup can be unrestorable | `apps/native/src/services/data-export.ts:72` | 3 |
| NC-5 | Low | DST-gap local times and DATE-only values mis-parsed | `apps/native/src/lib/ical-parser.ts:193` | 3 |
| NC-6 | Low | VEVENT DURATION ignored, so the event has no end time | `apps/native/src/lib/ical-parser.ts:548` | 3 |
| NC-7 | Low | Archiving an upcoming convention leaves its reminders armed | `apps/native/app/(tabs)/(home)/index.tsx:176` | 3 |
| PS-1 | Med | No status sync or deletion; an erased contact can be resurrected by reconcile | `apps/web/src/db/schema.ts:36` | 2 |
| PS-2 | Med | Unconfirmed (possibly third-party) signups kept indefinitely with IP and user agent | `privacy/page.mdx:157` | 2 |
| PS-3 | Med | Policy lacks lawful basis, international transfers, objection/complaint rights, concrete retention | `privacy/page.mdx:162` | 2 |
| PS-4 | Med | Consent copy is English-only on a form localized into 23 languages | `apps/web/src/components/waitlist.tsx:313` | 2 / D |
| PS-5 = SAL-2 | Low | Watch app's privacy manifest exists only via a generated-project side effect | `apps/native/targets/watch/` | 2 |
| PS-6 | Low | No recorded App Store / Play privacy answers while Sentry collects diagnostics | `apps/native/src/lib/sentry-config.ts:23` | 2 |
| PS-7 | Low | Convention city sent to Apple's geocoder without disclosure; Android geocoding always fails | `apps/native/app/(tabs)/(home)/convention/create.tsx:109` | 2 |
| PS-8 | Low | Imported backup copies left in Caches | `apps/native/src/services/data-import.ts:500` | 2 |
| I18N-1 | Med | Czech uses Polish "few" logic (widget/watch) | `apps/native/targets/_shared/ConPawsStrings.swift:86` | 3 |
| PERF-1 | Med | `foldLine` allocates a TextEncoder per code point (cause of the DEV-16 flake; janky JS thread on large feeds) | `apps/native/src/lib/ecp-feed.ts:200` | 3 |
| TEST-1 | Med | Swift shared logic untested; SwiftPM + Swift Testing package proposed | `apps/native/targets/_shared/` | 3 |
| TEST-2 | Med | Admin authorization gate untested | `apps/admin/src/lib/auth.ts:110` | 7 |
| I18N-2 | Low | ru/pl strings bake one plural form into the text | `apps/native/src/locales/ru.json` | 4 |
| I18N-3 | Low | Swift resolve disagrees with TS for `es` and zh-Hant/HK | `ConPawsStrings.swift:54` | 3 |
| I18N-4 | Low | CJK footer keeps the English "by" | `apps/web/src/i18n/messages/ja.json:176` | 5 |
| UX-1 | Low | Stored site-language choice is never applied on "/" | `apps/web/src/components/locale-detect.tsx:67` | 5 |
| TEST-3 | Low | Vitest doesn't pin TZ | `apps/native/vitest.config.ts:4` | 6 |
| MAINT-1 = SAL-12 | Low | 8 unused `ConPawsStrings` fields (184 dead strings) | `ConPawsStrings.swift:198` | 3 |
| DOCS-1 | Low | `bun build` in README/AGENTS.md runs Bun's bundler, not turbo | `README.md:131` | 7 |
| DOCS-2 | Low | `icon.svg` points to a logo note that no longer exists | `apps/web/src/app/icon.svg:23` | 7 |
| BD-3 | Low | `expo-constants` override is right today but undocumented | `package.json:58` | 7 |
| BD-4 | Low | Nav targets 40 px, below the repo's 44 px rule | `apps/web/src/components/landing.tsx:417` | 5 |
| BD-5 | Low | Lanyard straps may run behind the nav row at md–lg (check) | `apps/web/src/components/badge-card.tsx:143` | 5 |
| BD-6 | Low | Dead `nav.established` key in 23 catalogs | `apps/web/src/i18n/messages/en.json:10` | 5 |
| BD-7 | Low | Narrow switcher shows ambiguous ES/PT/ZH | `apps/web/src/components/language-switcher.tsx:65` | 5 |
| infra-1 | Med | License manifest stale today; no CI or ship:prep check (reproduced) | `apps/native/package.json:19` | 2 |
| infra-2 | Med | Deploy validation skips `NEXT_PUBLIC_SITE_URL` and the Turnstile key | `packages/env/src/deploy.ts:47` | 6 |
| infra-3 | Med | "Dormant listmonk" workflow path is unreachable (the schema needs all four vars) | `.github/workflows/deploy-web.yml:152` | 6 |
| infra-4 | Med | Documented rollback is blocked by the stale-release gate | `.github/workflows/deploy-web.yml:78` | 6 |
| infra-5 | Med | Migration-drift check covers web only, not admin | `.github/workflows/ci.yml:52` | 6 |
| infra-6 | Med | R8 on, but ProGuard mapping never uploaded to Sentry | `apps/native/app.config.ts:327` | 6 |
| infra-7 | Low | iOS archive has no documented way to get `SENTRY_AUTH_TOKEN` | `apps/native/RELEASING.md:350` | 6 |
| infra-8 | Low | Missing signing file silently produces a debug-signed AAB | `apps/native/plugins/withUploadSigning.js:82` | 6 |
| infra-10 | Low | Deploy workflow grants unused permissions | `.github/workflows/deploy-web.yml:30` | 6 |
| infra-11 | Low | Dependabot doesn't watch the xprem/redis images | `.github/dependabot.yml:3` | 6 |

**Strengths the lean review confirmed:**
- **Admin auth:** jose JWKS verification pinned to RS256 with issuer and audience checks, read from the header rather than the cookie. The dev bypass only works when `ADMIN_RUNTIME_ENV==='local'`. Membership is re-read on every request.
- **Admin actions:** all 8 server actions call `requireAdmin()` first. Writes and their audit rows go through one `db.batch` with optimistic checks.
- **Public catalog:** snapshots are built from explicit field picks and re-validated with zod, so drafts don't leak.
- **Waitlist:** streaming body bound, atomic IP admission plus insert, compare-and-set resend claims, a 10-minute per-address cooldown, and fail-closed 503.
- **Service worker:** skips `/api`, non-GET and cross-origin requests, and has a kill switch.
- **Widget data contract:** the TS↔Swift snapshot contract matches field by field. The brand colors pass AA; the in-code "≈4.7:1" claim is actually 5.40:1.

## Appendix D — Decision challenges (need your call)

1. **Kill switch (SEC-WEB-2).** AGENTS.md calls `WAITLIST_ACCEPTING_SIGNUPS` "the kill switch", but it only hides the form; the API keeps accepting scripted signups. **Recommend** a server-bound flag (Phase 1) and updating AGENTS.md to describe it.
2. **Honeypot (SAL-3).** The documented honeypot plus timing gate stays, but de-risk autofill and count rejections (Phase 1). **Recommend** keeping it.
3. **Catalog binding (SEC-WEB-10 / infra-9).** "The public site reads published snapshots only" holds in code, but the D1 binding allows writes. **Recommend** keeping the decision, adding a single read module plus a guard test now, and later publishing snapshots to a separate KV/R2/D1 resource.
4. **Consent language (PS-4).** The code deliberately keeps the consent copy in English. **Recommend** at least a localized summary with a policy link. Fully localized consent needs vetted translations, which is your call.
5. **Zone headers (SEC-WEB-8).** Live HSTS includes `preload` although the repo says preload should be a deliberate act. Decide in the Cloudflare dashboard, then align `csp.ts`.
6. **Purging unconfirmed signups (PS-2).** Deleting unconfirmed listmonk subscribers needs subscriber-manage permission on the edge token. AGENTS.md forbids writing listmonk *settings* via the API, not subscriber deletion. Confirm the token's permissions, or purge only D1 and keep listmonk's own unconfirmed cleanup.

## Appendix E — Coverage, gaps and usage note

- **Covered with evidence:**
  - Device pass: iOS app, mobile Safari, Android emulator.
  - Leads salvaged from the first run and verified in code: watch, website, admin, and the four prior findings.
  - Lean review: web and admin security, native correctness, privacy and store readiness, infra/CI/release and native build config, i18n, tests and maintainability, and the branch diff.
  - Baseline lint, type check and test runs.
- **Partially covered:**
  - Native, web and admin NN/g code passes, cut off by the usage limit. They're represented by the device pass and salvaged notes.
  - Widget and watch UX: salvaged notes only, since the widget can't render in Debug.
  - SwiftUI code quality beyond the confirmed defects.
- **Not covered:**
  - Mobbin benchmark (blocked).
  - Notion spec comparison (connector not authenticated).
  - VoiceOver and TalkBack walkthroughs.
  - Physical devices.
  - Lighthouse or WebPageTest on the live site.
  - Hermes profiling beyond PERF-1.
- **Usage:** the first workflow used about 8.5M subagent tokens and returned nothing (session limit, three times). The lean re-run used about 0.54M. For future large reviews, keep at most 3 concurrent agents at high effort with capped tool budgets. The Codex phases use your OpenAI quota, not Claude's.

## Implementation status (fix/review-2026-10)

- Phase 1: `3bb6c5e` — live waitlist and public API hardening.
- Phase 2: `7bb07d3` — privacy, consent and store-privacy accuracy.
- Phase 3: `9df604e` — native correctness and Swift tests.
- Phase 4: `dd2182f` — native type scale and honest states.
- Phase 5: `31f818a` — web/admin accessibility and UX polish.
- Phase 6: `a31e6e3` — deploy, rollback, signing and observability.
- Phase 7: this commit — admin authorization tests and documentation.
- Deferred: the 320/375px overflow check needs a headless browser; listmonk
  subscriber deletion awaits the permission decision; privacy-policy legal
  review and the VPS provider name remain open; Cloudflare zone header decision;
  Mobbin benchmark; and physical-device checks.
