# ConPaws production-readiness and defensive-security audit

**Date:** 2026-10-15

**Latest local validation:** [October 28 testing-readiness report](2026-10-28-local-testing-readiness.md). This document retains the historical audit evidence; use the newer report for current local results.

**Worktree:** `/Users/nathanialhenniges/Developer/mrdemonwolf/conpaws`

**Branch:** `feat/mobile-ux-redesign`

**Base commit:** `779923934f431de5b403c379bb9a0b70e3c9d2fb`

**Verdict:** **NO-GO for a public native release today.** The engineering base is good, but dependency-security findings, OTA, signed-device proof, and several security and deployment controls remain incomplete.

### Post-audit R2 update — 2026-10-16

After this audit snapshot, the owner deleted 138 older objects from
`mrdemonwolf-backups` and deleted the empty `mrdemonwolf-ota-assets` and
`mrdemonwolf-ota-backups` buckets. The remaining backup listing showed 42
objects dated 2026-06-21 through 2026-06-27 (about 3.21 GB). Cloudflare's
aggregate usage display was stale immediately after deletion and was not
reverified. Recreate both OTA buckets and their retention settings before
deploying XPRem. The bucket status later in this report reflects the original
2026-10-15 audit snapshot.

This audit covers the current worktree, including the uncommitted SDK alignment, CI guardrails, and this report. It did not switch to either Claude worktree. It used local previews and fictional fixture data. Cloudflare R2 and Dokploy state were observed without changing production services; the deleted PostgreSQL service has not been recreated. The audit did not submit a live waitlist entry, send an admin code, mutate listmonk, deploy xprem, change the Cloudflare Tunnel route, upload a store build, or test production with destructive traffic.

## Grades

Grades separate code quality from proof that the exact production artifact works.

| Area | Grade | Assessment |
|---|---:|---|
| Native local-first core | **B+** | Strong validation, reminders, import, backup, database, and unit coverage |
| Native release readiness | **B-** | Expo alignment, clean production prebuild, Release simulator proof, and a signed physical-device install pass; OTA, physical launch, and store proof remain open |
| Public website | **B+** | Build and 23-locale Worker E2E pass; live waitlist dependencies remain unproved |
| Admin console | **B** | Authorization and production response headers are strong and the built Worker smoke passes; live email/onboarding proof is missing |
| Public API | **B** | Small, parameterized, fail-closed, and hardened against invalid/high-repeat misses; catalog-backed production proof remains open |
| Security and privacy | **C+** | Good trust-boundary design, with material dependency exceptions, native crash telemetry proof, and lifecycle gaps |
| CI/CD | **B (provisional)** | Solid branch/SHA guards and strict deploy flags; Ubuntu jobs are explicitly pinned, but hosted CI and a current registry audit remain open |
| Infrastructure and operations | **C-** | Clear Cloudflare/Alchemy design, hardened OTA descriptor, and locked R2 storage; PostgreSQL must be recreated, then XPRem, tunnel, backups, and restore proof remain open |
| Automated testing | **B+** | The full workspace test run passed 1,158 TypeScript tests and the audit-gate suite passed; hardware and store coverage remain incomplete |
| **Overall production readiness** | **B-** | **Do not ship until the release blockers and production evidence gates below are complete** |

## What was verified

| Evidence level | Result |
|---|---|
| Install | The 2026-10-15 audit recorded a successful Expo alignment on Bun 1.3.10. The 2026-10-20 frozen install was repeated only on Bun 1.4.3; see the follow-up for the remaining exact-toolchain gap. |
| Expo compatibility | `expo install --check` passed and Expo Doctor passed 21 of 21 checks |
| Static analysis | Biome checked 537 files with zero errors and two existing warnings |
| Types | All seven workspace type-check tasks passed |
| TypeScript tests | Full workspace run passed 1,158 tests across API, web, admin, and native; all 11 security-audit gate tests passed |
| Swift tests | 18 tests across four suites passed in the latest run |
| Builds | Next and OpenNext builds passed for web and admin |
| Website Worker E2E | 23 locales, public/legal/SEO routes, 404, and fail-closed signup passed |
| Admin Worker smoke | Locally authorized dashboard, conventions, activity, team, private caching, robots, manifest, offline shell, and production security headers passed with fictional local data; the focused admin suite passed 112 tests |
| Public API | All 11 focused tests and the Worker dry-run passed; invalid slugs and query variants stop before D1, misses cache for 30 seconds, and the bundle exposes only the catalog D1 binding |
| Native supporting checks | License manifest, build-number parity, and clean Expo development and production prebuilds passed |
| iOS build | Expo Release builds compiled the app, widget, Watch app, and Watch widget for simulator with zero errors and for Nathanial's iPhone with zero errors; simulator signing is not store provisioning |
| iOS simulator | The production Release app installed, launched, and visibly reached the Conventions UI; the earlier development navigation smoke also passed |
| Dependency gate | The 11 gate regression tests passed; a previous live Bun audit matched the 27 expiring exceptions, but the latest registry refresh could not resolve `registry.npmjs.org` |
| Sentry development startup | The root wrapper now follows successful initialization; focused tests and the latest Metro bundle passed without the prior development warning |
| Workflow syntax | `actionlint` 1.7.12 passed with an exact ignore for the GitHub-confirmed `ubuntu-26.04` public-preview label; the linter's built-in runner list has not caught up |
| Ubuntu runner migration | Linux CI, deploy, and Android release jobs now pin `ubuntu-26.04`; GitHub lists this image as public preview, so hosted CI must pass before merge |
| Local D1 | Admin migrations applied; all eight migrated tables matched the current schema in a read-only comparison |
| OTA storage | Private `mrdemonwolf-ota-assets` and `mrdemonwolf-ota-backups` buckets exist in `ENAM`, are empty, and have the intended 90-day all-prefix and `xprem-assets/` locks respectively |
| OTA database bootstrap | Dokploy deployment logs confirm PostgreSQL 16 service `xprem-control-db` deployed successfully. Dokploy shows internal port 5432 and no external port; `dokploy-network` membership is unverified and no database backup is configured. A previous 18.6 smoke returned `/health` 200 but `/dashboard` 503 after 19 public tables |
| Secrets | Current tracked tree scan found no credential candidates or tracked environment/key files |

## What failed or remains unproved

- **Remote CI has not rerun after the SDK alignment:** local dependency checks, Expo Doctor, native tests, Swift tests, clean prebuild, and iOS compile pass. The branch still needs the hosted workflow result for the exact final diff.
- **Dependency findings remain:** a compatible lock refresh reduced the pinned Bun 1.3.10 baseline from 53 to 27 unique high/critical findings: 3 critical and 24 high across seven packages. CI now requires an exact package/advisory/range match and every exception expires on 2026-11-15. These are controlled exceptions, not resolved vulnerabilities; Next remains a direct Worker dependency. The latest live refresh failed before reaching the registry with `DNSResolveFailed`, so the current registry state is unknown.
- **The Next upgrade path is blocked by a real adapter regression:** the patched advisory version is 16.3.8, while OpenNext issue [#1334](https://github.com/opennextjs/opennextjs-cloudflare/issues/1334) still documents an unbounded RSC prefetch loop on Next 16.3 with the fix PR [#1348](https://github.com/opennextjs/opennextjs-cloudflare/pull/1348) open. Until that upgrade is safe, image optimization is explicitly disabled and the CI-run security gate rejects `next/image`, `next/og`, `remotePatterns`, and AVIF use in production source/config: [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4).
- **Production Sentry configuration is not ready:** both ignored local store-build files contain a DSN that the app and installed Sentry SDK reject, and the GitHub `EXPO_PUBLIC_SENTRY_DSN` variable is absent. The release workflow already fails when configuration is missing and now also rejects a nonnumeric Sentry project ID, but a valid DSN, upload token, and received preview event remain open. Native iOS/Android crash envelopes also bypass JavaScript `beforeSend`; configure project-side scrubbing and prove it with a physical-device crash event before store release.
- **App/site browser visual review remains partial:** automated Worker E2E passed, but a full interactive browser review was not completed. Chrome was used only for the authenticated Cloudflare infrastructure setup.
- **No store-delivered proof exists:** local production Release builds compiled and a signed bundle installed on a physical iPhone, but IPA/AAB distribution signing, entitlement/profile parity, archive privacy report, symbol upload, store processing, and install from TestFlight/Play remain unknown.
- **Physical iPhone proof is partial:** the production `com.mrdemonwolf.conpaws` Release bundle installed on Nathanial's iPhone, but launch was blocked while the phone was locked. Runtime behavior, notifications, offline reboot, widgets, Watch, accessibility, Android Doze, and production network behavior remain unknown.
- **Live dependencies remain unverified:** the XPRem control plane and tunnel route, Cloudflare application routes/bindings/migrations, Email Sending, first-owner state, Turnstile pairing, listmonk permissions/settings, real opt-in delivery, and reconciler alerts were not changed or exercised. PostgreSQL 16 is deployed, but network membership, backup configuration, and the complete dashboard/database smoke remain open. The two locked OTA buckets contain no assets or backups yet. A read-only inspection of Dokploy's existing `dokploy-project-backups` Cloudflare R2 destination surfaced its saved credential in the browser accessibility tree; treat that credential as exposed, check for shared use, and rotate/test it before scheduling XPRem backups. The chosen plan is to reuse this destination under the `xprem-control-db/` prefix. No backup was configured or started. The local Docker socket also denied access, so the incomplete PostgreSQL 18 smoke could not be repeated in this pass.

Apple treats the submitted binary, SDK data practices, and complete user experience as review responsibilities. The final archive privacy report and store disclosures must match the artifact: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [privacy manifests](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests).

## Prioritized findings

### P0 — Release blockers

#### PR-01: Verify the completed SDK 57 patch alignment and production artifacts

Expo, Router, Constants, dev client, linking, location, notifications, sharing, splash screen, `@expo/ui`, and the root Constants override are aligned to the SDK 57 patch set.

- [x] Run the SDK-matched Expo install fix with Bun 1.3.10.
- [x] Keep the root Expo/Constants override aligned.
- [x] Pass Expo Doctor, install check, native tests, Swift tests, clean development and production prebuilds, and production Release simulator and physical iOS compiles through Expo CLI with Node.
- [ ] Run the remaining exports and an actual Android compile.
- [ ] Inspect the generated production manifests and permissions.

#### PR-02: Complete the required OTA gate or explicitly move it out of MVP

The repository says OTA is required, but XPRem is not deployed and the app lacks `expo-updates`, URL, runtime version, channels, and signing configuration. The two private R2 buckets and retention locks are live, but both buckets are empty and no XPRem backup or restore has run. Current OTA readiness remains **D+**: architecture/runbook **A-**, descriptor **A-** after the repo hardening in this audit, storage foundation **B**, live control plane **F**, recovery proof **F**, and native integration **F**. PostgreSQL 16 is now deployed, but its network membership, backup setup, and complete dashboard/database smoke remain pending.

- [x] Pin the descriptor and CI assertion to XPRem 3.2.6, disable server and device telemetry, and pin the activation command to `eoas` 3.2.6.
- [x] Create private `mrdemonwolf-ota-assets` and `mrdemonwolf-ota-backups` R2 buckets in `ENAM` with 90-day locks on all asset objects and the backup `xprem-assets/` prefix respectively.
- [x] Create the shared Dokploy `updates` project and `production` environment.
- [x] Deploy PostgreSQL 16 as `xprem-control-db` with no public port.
- [ ] Verify `dokploy-network` membership; rotate/test the exposed `dokploy-project-backups` credential after checking shared use; schedule PostgreSQL backups in that destination under `xprem-control-db/` and pass a restore drill plus the complete isolated dashboard/database smoke before connecting XPRem.
- [ ] Deploy the one shared xprem service and serve `updates.mrdemonwolf.com` through the existing Cloudflare Tunnel to private `http://xprem:3000`; no public port, Dokploy domain, or separate origin certificate is required.
- [ ] Create separate account-owned bucket-item credentials: runtime write access to `mrdemonwolf-ota-assets`; read-only access to that asset source for the copy job; and write access to `mrdemonwolf-ota-backups` for the copy destination. Schedule the immutable asset copy and PostgreSQL dumps in Dokploy's existing `dokploy-project-backups/xprem-control-db/` destination. Pass a disposable database-and-object restore drill.
- [ ] Create and verify the isolated ConPaws app UUID, keys, channels, and publisher scope.
- [ ] Add SDK-matched `expo-updates`, signed update URL, runtime `1.0.0-r1`, app UUID, and validated staging/production headers only after the service is healthy.
- [ ] Pass valid, invalid-signature, wrong-runtime/channel, interrupted-download, offline-start, and rollback cases on physical iOS and Android devices.

#### PR-03: Resolve high/critical dependency findings without breaking OpenNext

An automatic audit fix is unsafe because it currently selects the affected Next/OpenNext combination. The compatible lock refresh removed 26 high/critical findings; the remaining 27 are exact, time-bounded exceptions rather than ignored output.

- [x] Add an expiring security-audit baseline that records advisory, reachability, owner/upstream issue, and expiry.
- [x] Fail CI for new or changed advisories, malformed audit output, network failure, stale entries, or expired exceptions.
- [x] Explicitly disable Next image optimization while the pin remains and reject new `next/image`, `next/og`, remote patterns, or AVIF use without review.
- [ ] Upgrade Next only after the adapter fix ships and a 30-second browser request test proves `_rsc` traffic stays bounded.

#### PR-04: Make deployment reachability configuration strict

Resolved in this audit: missing, misspelled, or non-lowercase routing flags now
fail before Alchemy creates resources, and at least one public origin must stay
enabled.

- [x] Require literal `true` or `false` for all three values.
- [x] Require at least one reachable origin where appropriate.
- [x] Add missing, typo, bad-case, and both-origins-disabled tests.
- [x] Make the control-plane readiness decision fail deployment before public probes.

#### OPS-01: Produce signed, store-delivered device evidence

- [ ] Build signed IPA and AAB from an exact green SHA.
- [ ] Verify all four Apple targets, entitlements, profiles, privacy report, debug exclusion, symbols, and mapping files.
- [ ] Replace the invalid local Sentry DSNs, set the repository DSN variable and upload token, then prove one controlled preview event arrives with a readable stack and no sentinel user data.
- [ ] Install the exact upload from internal TestFlight and Play testing.
- [ ] Complete the device matrix below before public rollout.

### P1 — Security, privacy, and data integrity

#### SEC-01: Prevent restored URLs and user content from reaching Sentry

Backup restore now canonicalizes schedule URLs as HTTPS, omits rejected input
from errors, and strips user-controlled content in the central Sentry hooks.
Automated sentinel tests cover the redaction path; live delivery still needs a
configured preview DSN. Native crash envelopes bypass these JavaScript hooks,
so platform-side scrubbing and physical iOS/Android ingestion still need proof.

- [x] Validate restored URLs as canonical HTTPS URLs.
- [x] Remove raw input from error messages.
- [x] Redact URL query strings, filenames, schedule content, and breadcrumbs in Sentry hooks.
- [ ] Capture a test event and prove a sentinel secret is absent.
- [ ] Configure native crash data scrubbing in Sentry and prove a physical-device crash event arrives without sentinel data.

#### SEC-02: Add an admin-specific response-header policy

Resolved in this audit: every admin route now receives a production CSP, frame
protection, nosniff, referrer, permissions, and HSTS headers, and Next.js no
longer exposes `x-powered-by`. Local development keeps only the WebSocket and
evaluation allowances required by hot reload; the built Worker excludes them.

- [x] Add a restrictive admin CSP and the standard response headers.
- [x] Disable the powered-by header.
- [x] Add config tests and a built-Worker response assertion.

#### SEC-03: Make the waitlist switch fail closed

Resolved in this audit: only the literal server binding `true` opens POST.
Missing, empty, false, or invalid values return the existing closed 503 before
Turnstile, D1, or listmonk, and invalid configuration logs only a fixed event
name plus a boolean presence flag.

- [x] Accept signups only for literal `true`.
- [x] Return closed/503 for missing, empty, or invalid values.
- [x] Add bounded, PII-free configuration logging and tests.

#### SEC-04: Verify listmonk success before marking a row synced

Resolved in code during this audit: a 2xx create only stamps `synced_at` when
the response includes the configured list. The intentional 409-as-success path
is unchanged; live permissions and exhausted-row operations remain open.

- [x] Require the create response to include the configured list before setting `synced_at`.
- [x] Add tests for 200 responses with the correct, empty, wrong, or malformed list payload.
- [ ] Add dead-letter metrics, an operator retry path, and alerts for exhausted rows.
- [ ] Verify live list 3 manage permission, double opt-in, opt-in sending, and slow-query cache refresh.

#### SEC-05: Fix waitlist deletion and resubmission lifecycle

D1 unconfirmed rows are deleted after 30 days while listmonk rows remain. A later resubmission receives 409 and is treated as success without a fresh message.

- [ ] Decide the least-privilege cleanup or resend policy.
- [ ] Add a composed purge-to-resubmit integration test.
- [ ] Keep the privacy policy synchronized with the actual retention behavior.

#### SEC-06: Constrain listmonk egress

Resolved in this audit: deploy validation and the runtime fail-closed guard both
restrict production egress to the root of `https://lists.mrdemonwolf.com`, with
no URL credentials, query, fragment, or extra path. HTTP(S) loopback is allowed
only when the local-only binding is the literal `true`.

- [x] Require HTTPS and the approved production host.
- [x] Permit loopback only in explicit local development.
- [x] Test HTTP, embedded credentials, wrong host, malformed path, and valid local/production values.

#### DATA-01: Harden restored IDs and shared snapshots

Crafted backup IDs could contain route separators or controls, and repeated valid imports could grow the local database beyond one restorable backup. The current follow-up rejects unsafe IDs, bounds existing-ID reads, enforces a combined 50,000-row database/import/export ceiling, and pages export reads with an 8 MiB encoded-size check. These checks apply to newly restored data; existing unsafe IDs are not rewritten. Widget/Watch snapshot reads and payload size still lack a deterministic bound; do not silently truncate starred events to address it.

- [x] Enforce the app's route-safe `A-Z`, `a-z`, `0-9`, `_`, `-` ID alphabet and a 128-character maximum at backup restore.
- [ ] Bound widget/Watch snapshot reads and encoded bytes without silently hiding schedule items.
- [x] Cap combined restored local database/export data at 50,000 rows; bound existing-ID reads to that ceiling plus one; export in 25-row pages and reject above the 8 MiB restore byte ceiling before building the complete payload.
- [x] Test `/`, `%2F`, control characters, 129-character IDs, cumulative row overflow, paged export, and the existing 50,000-row backup-envelope boundary.

#### PRIV-01: Decide platform backup behavior

Generated Android configuration allows OS backup while product copy says schedule data stays on the device.

- [ ] Either exclude SQLite/preferences on both platforms or disclose OS-managed encrypted backup.
- [ ] Add explicit Android extraction rules and verify the production artifact.

#### ADMIN-01: Make production owner invites explicit

Resolved in this follow-up. The invite CLI now defaults to local, requires `--remote` and an explicit role for production, and requires the normalized address for a production owner invite.

- [x] Default to local and require `--remote` for production.
- [x] Require an explicit production role and exact-address confirmation for owners.
- [x] Add parser tests and update every documented production command.

### P2 — Reliability, CI, and operations

#### OPS-02: Add real readiness checks

Current health endpoints prove process liveness only, public probes are report-only because of Cloudflare bot challenges, and admin has no live probe.

- [ ] Add control-plane checks for required D1 tables and bindings.
- [ ] Probe a catalog-backed `/v1/conventions` path.
- [ ] Add admin readiness without sending a code.
- [ ] Keep bot-affected public curl checks informational.

#### CI-01: Finish the new guardrail coverage

This audit added a local admin Worker E2E, Swift package CI, and build-number verification. Remaining gaps:

- [ ] Add full admin migration table/column/index/trigger parity.
- [ ] Add one production-prebuild assertion for build variant, blocked permissions, privacy manifests, four Apple targets, and absent dev network strings.
- [ ] Compile the generated Xcode and Gradle projects in CI when runtime is acceptable.
- [ ] Add one small Maestro smoke only after a stable deterministic fixture flow exists.

#### OPS-03: Tighten repository and deployment controls

- [x] Add Nathanial as the required reviewer for the GitHub `production` environment and verify the rule through the API.
- [x] Protect `dev` and `main` with one approving review, strict `CI / Verify`, stale-review dismissal, admin enforcement, linear history, resolved discussions, and no force-push or deletion.
- [x] Enable Dependabot security updates, secret scanning, and push protection.
- [ ] Enable non-provider secret patterns and validity checks; GitHub accepted the update request but kept both unavailable/disabled on the current repository plan.
- [x] Scope `SENTRY_AUTH_TOKEN` to credential validation and the two signed build/upload steps.
- [x] Set deploy checkout `persist-credentials: false`.

#### API-01: Reduce unnecessary public Worker authority and cost

- [x] Remove the unused full-capability `CDN_BUCKET` binding until a separate authenticated write path needs it.
- [x] Reject slugs outside the admin publisher's 2–96 character lowercase-hyphen grammar before D1.
- [x] Cache exact catalog misses at the edge for 30 seconds and reject unsupported query variants before D1; upstream failures remain `no-store`.

#### API-02: Decide whether published catalog reads require attendee authentication

The current Worker exposes only `/health` and three read-only catalog routes. Native requests carry no user credentials; `catalog.ts` selects only published editions and validates a strict public response shape. No user-owned or unpublished data endpoint exists. Requiring sign-in for this catalog would block guest downloads and needs real account/session support; an app-bundled shared key would not provide meaningful authentication.

- [x] Trace every current API route and native catalog caller.
- [ ] Confirm whether already-published catalog reads should stay guest-accessible or require attendee sign-in.
- [ ] If sign-in is required, design and implement real account/session authentication before gating the native client.

#### REL-01: Resolve smaller native reliability gaps

- [x] Skip `Sentry.wrap` when reporting did not initialize, removing the development startup warning without changing release profiling.
- [ ] Make cached backup deletion best-effort so cleanup cannot override a valid preview.
- [ ] Localize widget configuration and quick actions for all advertised locales.
- [ ] Inspect and document production Sentry payloads and archive privacy output.

## Device and store release matrix

Each row needs platform, artifact build number, Git SHA, pass/fail notes, and screenshots or logs.

Partial evidence: the iPhone 17e simulator passed launch, saved-data display, convention-detail navigation, tab navigation, and Settings-to-About navigation. Maestro's iOS driver later became unstable before the kill/relaunch persistence flow completed. Expo installed development build 208 on Nathanial's physical iPhone, but runtime verification is still open because the device locked before launch.

- [ ] Latest supported iPhone and iPad: clean install, onboarding, every route, rotation/split view where supported.
- [ ] Android API 36 device: clean install, navigation, permission prompts, Doze/battery saver.
- [ ] Airplane-mode cold boot and reboot with saved schedules; create/edit/archive/delete without data loss.
- [ ] Catalog, local ICS, HTTPS/Sched, cancellation at every import stage, malformed/oversized/recurrent/cancelled feeds, and repeated import.
- [ ] Export/share/fresh-install restore, duplicate restore, low storage, and sharing unavailable.
- [ ] Notification never-asked/deny/allow/revoke/re-enable, DST/timezone/language changes, more than 60 reminders, and cold/warm taps.
- [ ] Every iOS widget family, Lock Screen, quick action, paired/unpaired Watch, reconnect, stale snapshot, and complication deep link.
- [ ] VoiceOver and TalkBack, focus order, names/roles/states, modal escape, maximum text scale, contrast, reduced motion, and 320-point width.
- [ ] Production traffic capture proving saved schedules do not upload and Sentry contains no URL queries, filenames, or user-entered schedule text.
- [ ] OTA valid/invalid/wrong runtime/offline/interrupted/rollback cases.
- [ ] Exact internal TestFlight and Play artifacts repeat smoke, offline, notification, widget, and accessibility checks.

## Guardrails added by this audit

- `AGENTS.md` now requires disposable local pentest data, negative authorization tests, secret/PII-safe logs, expiring security exceptions, and precise evidence labels.
- CI now validates a pinned Bun audit against exact, expiring high/critical exceptions and rejects changed, new, stale, malformed, or network-incomplete results.
- The admin build now has production CSP, HSTS, frame, nosniff, referrer, and permissions headers, with config tests and built-Worker assertions.
- Deployment now rejects missing, mistyped, or unreachable routing flag combinations before Alchemy creates resources.
- CI now runs the existing Swift widget/Watch package and includes it in `CI / Verify`.
- Native CI now checks build-number parity after clean prebuild.
- CI now boots the built admin Worker against migrated, fictional local D1 data and tests locally authorized route rendering, cache privacy, robots, the manifest, and the offline shell.

These guardrails do not make the release green by themselves. Expo compatibility passes locally, but remote CI has not rerun; OTA, physical-device runtime, store-artifact, residual dependency, and deployment gates remain open.

## Follow-up verification — 2026-10-20

This follow-up used the same dirty `feat/mobile-ux-redesign` worktree. It did not commit, push, deploy, or run hosted CI. The grades above remain unchanged because the release evidence gates below are still open.

| Check | 2026-10-20 result |
|---|---|
| Expo alignment | SDK package check passed; Expo Doctor passed 21/21 checks. The generated license manifest was refreshed and its check passed. |
| Toolchain | Frozen lockfile install passed on local Bun 1.4.3. The repository pins Bun 1.3.10, which was unavailable locally; the exact pinned install remains unverified. |
| Android | Expo's Android debug build reached `BUILD SUCCESSFUL`. Installation then failed because the emulator disconnected; no Android device was attached afterward. This is compile evidence, not a device smoke test. |
| Workspace checks | All workspace Vitest suites passed; seven type-check tasks passed; Biome checked 537 files with zero errors and two warnings. The focused Sentry tests passed 15/15. |
| Web and admin builds | Cloudflare builds passed for both apps with Next.js 16.2.12 and OpenNext 1.20.2. The admin Worker smoke passed against migrated fictional D1 data in a temporary state directory, which was removed afterward. |
| Dependency gate | A root PostCSS 8.5.30 override removed the two PostCSS advisories from the exception list. The audit gate now passes with 25 remaining high/critical exceptions. A fresh read-only review found no PostCSS blocker; pinned-Bun compatibility is still unverified. |
| Hosted CI and release credentials | The newest hosted CI failure is from 2026-10-19 on old Dependabot branch `dependabot/github_actions/github-actions-3cef3f0655` at SHA `554a64e`; it is not this worktree. There is no hosted result for the current uncommitted changes. Name-only checks found no Sentry or store-signing/upload credentials in repository or `production` environment scopes; `NATIVE_RELEASE_ENABLED` and `EXPO_PUBLIC_SENTRY_DSN` are absent from repository variables. |
| OTA storage | The two empty OTA buckets were deleted on 2026-10-16. Recreate them and their retention rules before deploying XPRem; the earlier “locked buckets are live” statements describe only the 2026-10-15 snapshot. |

Production readiness remains **NO-GO**. No hosted run has validated this uncommitted worktree; signed TestFlight/Play artifacts, physical iPhone and Android launch checks, live Sentry delivery/native-crash scrubbing, XPRem deployment, and OTA backup/restore proof remain open. The Android build also emitted a Sentry Gradle plugin placement warning, and the web/admin builds emitted existing Turbopack tracing-root and compatibility-date warnings; those warnings did not fail the builds and have not been resolved here.

## Follow-up verification — 2026-10-25 (local fallback)

This pass stayed on the dirty `feat/mobile-ux-redesign` worktree. It did not commit, push, deploy, run hosted CI, mutate Jira, or exercise production services. Codex Security Deep Scan was attempted twice but did not start because its read-only worker requires a managed filesystem permission profile. The source review below is a local fallback, not a completed Deep Scan and not a no-findings result.

| Check | 2026-10-25 result |
|---|---|
| API authentication boundary | Source review found `/health` and three unauthenticated GET routes for staff-published catalog data; the native client sends no credentials. `catalog.ts` selects only published revisions and returns a strict public shape. No user-owned or unpublished data route was found in this review. Whether published catalog reads should require attendee sign-in remains a product decision because it would block guest downloads and requires real session support. |
| Admin production invite | `admin:invite` now defaults to local; remote requires `--remote` plus an explicit role; production owner invites also require the exact normalized email. The focused parser/SQL suite passed 7/7, Biome passed on all three changed script/test files, and `git diff --check` passed. No remote invite was run. |
| Native backup boundaries | Restored convention/event IDs are now limited to route-safe characters and 128 characters; existing-ID reads stop at the row ceiling plus one, and restore refuses to grow the combined local store past 50,000 rows. Export reads in 25-row pages and checks cumulative row/encoded-byte ceilings before assembling the final payload. The focused import/export/message suite passed 51/51 and all native Vitest suites passed 854/854; workspace type checks passed 7/7; Biome and `git diff --check` passed on touched paths. Old unsafe IDs already stored on a device are not rewritten. Widget/Watch snapshot loading and payload bounds are still open. |
| Worktree checkpoint | The current checkout is `feat/mobile-ux-redesign` at `577fb93`, a documentation-only commit directly after `7799239`. Existing dirty changes were preserved; this follow-up made no commit, push, deploy, hosted CI run, or live-service mutation. |
| Claude Code handoff | The 2026-10-19 Claude session said 2/7 store-paperwork items were done and its Jira handoff was not sent. Recheck below updates the local evidence. |

### Store paperwork checklist from the Claude Code handoff

| Item | Current repository evidence | Status / next step |
|---|---|---|
| Privacy policy | `apps/web/src/app/(marketing)/(legal)/privacy/page.mdx` exists and describes waitlist retention. | **In repo**; verify the live page and disclosures against production behavior before submission. |
| Encryption export answer | `apps/native/app.config.ts` sets `usesNonExemptEncryption: false`. | **Configured locally**; confirm the uploaded archive metadata and store answer. |
| App Privacy / Play Data safety | `docs/store-privacy.md` contains source answers for both stores. | **Documented locally**; actual App Store Connect and Play Console entries are **unknown**. |
| Store screenshots | No screenshot set is present under `docs/` or `apps/native/`; Fastlane explicitly skips screenshot uploads. | **Missing**; capture the current store-required device sizes and include upload handling. |
| Review notes | No version-specific reviewer notes file was found. | **Missing**; write notes for the actual submitted build and its review path. |
| What's New | No version-specific What's New file was found; Fastlane skips changelog uploads. | **Missing**; prepare text for the release version/locales. |
| Subscriptions | ConPaws+ / RevenueCat is planned; the 1.0 release is free. | **Not applicable to the free launch**; revisit before enabling purchases. |
| Appeal letter | No rejection is recorded in this audit. | **Deferred until an actual rejection**; no template needed for current submission. |

The Claude session said nine Jira tickets were still pending; the temporary handoff file it referenced is no longer present, and this pass did not create tickets. The grades remain unchanged: security/privacy **C+**, public API **B (auth-scope decision pending)**, overall **B− / NO-GO**. Local checks do not close hosted CI, store, live Sentry, or physical-device gates.
