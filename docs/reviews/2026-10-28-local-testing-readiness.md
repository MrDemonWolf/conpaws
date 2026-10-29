# ConPaws local testing readiness - October 28, 2026

**Verdict:** ready for a focused local testing session on web/admin. Native
compile proof is established, but CoreSimulator launch is blocked; native
hands-on readiness is not yet established. This is
not approval for a public native release or proof of production deployment.

This pass used the canonical checkout on `feat/mobile-ux-redesign`, without
switching or resetting the other Claude worktrees. PR #111 already targets
`main`; reuse it rather than opening a duplicate. An approving review is still
required, and repository auto-merge is disabled.

## Changes

- Documented the existing [design system](../design-system.md), including the
  intentional web/native token differences and accessibility acceptance rules.
- Fixed destructive Button/Badge text contrast with a paired foreground token.
  Five regression checks cover filled primary/destructive pairs in both themes,
  destructive hover over page/card backgrounds, and component token usage.
- Updated `systeminformation` from 5.33.15 to 5.33.18 in the lockfile, resolving
  the newly reported GHSA-3f7j-7jwc-fxfj without another override or exception.
- Removed the native iOS command's hardcoded nonexistent simulator; Expo now
  selects an available simulator or accepts an explicit device argument.
- Corrected the root README's Next/OpenNext versions and local first-owner setup
  instructions. The historical October 15 audit links here for newer evidence.

## Verified locally

| Check | Result and boundary |
| --- | --- |
| Frozen install | Bun 1.4.4 completed successfully after the lockfile patch. |
| Workspace tests | 1,177 tests across 117 files, all four application suites passed with cache bypassed under pinned Node 22.13.1: native 854, web 193, admin 119, API 11. |
| Typechecks | All seven workspace tasks passed. |
| Swift | 18 tests across four suites passed; Foundation logic, not rendered Widget/Watch behavior. |
| Expo | Package compatibility passed; Expo Doctor passed 21/21; native license manifest and build-number 208 checks passed. |
| Dependency gate | Passes with 15 existing high/critical exceptions, expiring November 15. Audit-gate regression suite passes 9/9. A passing gate does not mean zero vulnerabilities. |
| Lint | Explicit application/package/infra/workflow scope passed with two existing warnings in a constructor mock. Whole-repository lint also passes, with 112 warnings including older mobile UX review artifacts. No warnings were auto-fixed. |
| iOS launch | Blocked: Expo reached install/open, but simulator launch/openURL commands hung, Metro received no bundle request, and Device Hub remained on SpringBoard. No native screen, offline restart or physical-device UI proof is claimed. |
| iOS compile | Production-variant Debug build for the iPhone 17e simulator passed with zero errors and five Xcode warnings. Expo clean prebuild/native dependency refresh retained the app, Widget, Watch app and Watch widget. This is not a signed Release/store artifact. |
| Worker builds | Website and admin OpenNext production builds passed after the shared-token change. |
| Website HTTP E2E | All 23 locale pages, legal/public/SEO routes, 404, unavailable badge count and unconfigured fail-closed signup passed against the built local Worker. |
| Admin HTTP smoke | Dashboard, conventions, activity, team, sign-in feedback, private caching, production security headers, robots, manifest and offline shell passed. |
| Admin browser | At 375px, dashboard and convention editor had no horizontal document overflow. Fictional 200-session fixture loaded; adding one disposable session produced 201 sessions. Publish remained disabled while the source-verification date was absent. This run used the local owner shortcut; it did not re-prove emailed sign-in. |
| API Worker | Health passed; migrated catalog returned an empty published list while the fictional draft remained private. Draft detail, invalid slug and legacy `/api/v1` paths returned 404. A separate unmigrated database returned 503 `catalog_unavailable`. |
| Tab cleanup | The seven previous ConPaws test tabs were closed; unrelated tabs were preserved. Four tabs from this pass remained in the ConPaws QA group when browser control disconnected; native close-group actions were also interrupted, so their final cleanup is not claimed. |

The code fix at `e867e87` also passed hosted CI run `40811562538`; later
documentation and launcher-script commits need their own final-SHA CI result.

The Worker previews used temporary configurations and disposable D1 state with
fictional data, no listmonk/Turnstile credentials, and no production writes.
Local email is not delivered. The previous October 26 live waitlist email arrived,
but final Listmonk subscriber-confirmation status was not established in this run.

## Grades

Grades include the limits of the evidence, not just the source code.

| Area | Grade | Remaining proof |
| --- | --- | --- |
| Design system | B+ | Source documented and contrast regression fixed; complete rendered accessibility, large text and platform checks remain. |
| Automated local checks | A- | Broad test/build coverage; browser/device behavior is a separate layer. |
| Website | B+ | HTTP and locale coverage pass; full responsive locale/keyboard check and exact deployed artifact remain. |
| Admin | B+ locally | Mobile draft editing and publication safeguard pass; live first-owner email and production catalog setup remain. |
| Native core | B+ | Unit/Swift/Expo checks and current simulator compile pass; launch/UI, physical devices and store artifacts require separate evidence. |
| Security/privacy | C+ | New advisory patched; 15 high/critical exceptions and production telemetry proof remain open. |
| Public release | NO-GO | Signed builds, physical-device matrix, Sentry and required OTA/recovery gates remain. |

## Next testing session

Use the repo-pinned Bun and Node versions. Reuse existing listeners before
starting a server. These commands use local development state; do not run the
seed command against production or overwrite existing `.dev.vars` files.

```bash
bun install --frozen-lockfile
bun run test
bun check-types
bunx biome check apps packages infra .github package.json bts.jsonc tsconfig.json turbo.json
bun run security:audit:test
bun run security:audit
```

For a website Worker preview:

```bash
bun run --filter @conpaws/web preview
bun apps/web/scripts/e2e.ts http://127.0.0.1:8789
```

The E2E script expects an unconfigured local waitlist to fail closed. Do not run
that assertion against a configured production signup endpoint. `bun dev:web`
is useful for layout work but does not supply Cloudflare bindings.

For the admin fixture, follow [the admin local setup](../../apps/admin/README.md).
The default preview is port 8788; its local owner shortcut must never be enabled
in production. To test first-owner setup, use a fresh disposable database without
`ADMIN_DEV_EMAIL`; verify the log-only code in the same browser. An initialized
database deliberately keeps setup closed after membership removal.

For iOS, `bun ios` now lets Expo choose an available simulator instead of
hardcoding a removed simulator. Use Expo CLI device selection for a specific
target. Keep Node aligned with `.node-version`; a stale ignored
`ios/.xcode.env.local` can point Xcode at a removed Node executable. Generated
native projects can also retain obsolete podspecs after package updates. Resolve
that through Expo prebuild/run commands, preserving local configuration and the
authoritative Widget/Watch target sources, rather than editing Podfiles manually.

- [ ] Check all 23 locales at 320px and 375px, plus desktop; test the language
  picker, FAQ, keyboard focus, reduced motion and form errors. Chrome navigation
  and screenshots intermittently timed out during this pass, so the full rendered
  matrix is not claimed complete.
- [ ] Finish current iOS compile/install/launch proof, then exercise onboarding,
  convention creation/import, event selection, reminders, restart/offline state,
  backup round-trip, light/dark appearance and large text without erasing existing
  device data.
- [ ] Compile Android and test its emulator and physical-device flows separately.
- [ ] Verify live admin email and first-owner enrollment after the authorized
  GitHub Actions production deploy on `main`; do not substitute a laptop deploy.
- [ ] Resolve PR approval, pass CI on the final SHA, and verify deployment rather
  than assuming a successful merge means the service is live.
- [ ] Complete signed TestFlight/Play builds, Sentry ingestion/scrubbing and
  XPRem staging, backup/restore, offline-start and rollback gates before release.

Temporary Worker configurations/databases and local test logs were removed when
the preview processes stopped. The final admin proof image was retained for the
chat. Native setup repair used the pinned Node executable and an Expo-only clean
prebuild/dependency refresh; generated asset bytes were restored to avoid a
re-encode-only tracked diff. The stale ignored Xcode Node path was repaired.

The optional document-cleaning service was unreachable during this pass. No
fallback cleaning was performed and no document was uploaded to that service.
