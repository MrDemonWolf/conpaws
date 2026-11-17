# AGENTS.md

Expo / React Native app, phone widgets and Swift Watch targets. Root [AGENTS.md](../../AGENTS.md) also applies. Paths in the preserved guidance below are relative to the repository root unless stated otherwise.

Read the installed Expo, React Native and Swift skills relevant to the change. For fixture edits read [test-data guidance](../../test-data/AGENTS.md); for API bindings read [environment guidance](../../packages/env/AGENTS.md).

## Native components and platform files

- Reuse the native primitives in `apps/native/src/components/ui` and shared form,
  action, validation and state logic before adding another component. Keep native
  components in the native app; `packages/ui` contains web components.
- An ordinary `.tsx` implementation must work on both iOS and Android. Put
  specialized renderers in `.ios.tsx` and `.android.tsx` files; share their props
  and behavior through `.types.ts` / `.shared.ts` modules. Do not hide an Android
  implementation in a generic fallback file. A `.d.ts` may supply the shared
  extension-free TypeScript contract while Metro selects the real platform file.
- Preserve native controls: SwiftUI menus in the iOS list, Material menus on
  Android, and native toolbars for iOS forms. Alerts confirm consequences;
  ordinary action lists belong in menus. Keep a visible path alongside gestures.
- Match icon meaning across SF Symbols and Material assets. Icon-only controls
  need translated labels and keyboard activation. Use explicit 44pt / 48dp touch
  targets: rem-based spacing can render smaller than those platform minimums.
- Android React Native surfaces, navigation and Compose controls must use the
  same seeded Material palette and resolved appearance. Use supported Expo color
  APIs; do not reference missing Android theme attributes with `PlatformColor`.
- Phone widgets use `expo-widgets` and platform-specific Expo UI renderers in `src/widgets`. Keep the single `ConPawsWidget` kind, bundle ID/App Group, per-instance iOS convention/mode and Swift Watch targets. `expo-widgets` generates `ExpoWidgetsTarget`; the local migration plugin preserves target identities and incremental source inputs. Run the generated native-target check after prebuild.
- Widget functions run in an isolated runtime: no hooks, async app work or captured helpers. Pass validated offline data, selected language, resolved clock preference and paired colors through props. Keep the canonical Swift widget strings shared with Watch through the local bridge. iOS timelines are bounded and end with an explicit refresh state; opening the app renews them offline. Android needs its native boundary-refresh and guarded Schedule-launch adapter because Expo Widgets does not supply Android timelines or cold app launch.
- Widget props must carry no `null` anywhere: iOS stores the timeline as a property list and Expo's Android bridge refuses the object, and either way the widget silently keeps stale content. Publish through `buildStoredWidgetTimeline` (iOS) and `buildStoredWidgetProps` (Android), and read a missing field as a null one. The generated intent and display enum keep the retired Swift widget's `persistentIdentifier`s, or widgets pinned before the Expo migration freeze after an update.
- The widget and Live Activity brand mark is the ConPaws logo, never a generic paw symbol: `src/widgets/WidgetAssets.xcassets` (`ConPawsMark`, a template image that `withConPawsWidgets` copies into the extension) on iOS and the `widget_mark` vector drawable on Android, both traced from `apps/web/src/app/icon.svg`. Draw it at 16 points or larger, because its compass ring blurs below that.
- Wide windows (iPad, Stage Manager, the iPhone Duo inner display, Android tablets) get a centred readable column from `src/lib/content-width.ts` through `useContentWidth`, `ReadableColumn` and `useReadableFieldGroup`. Choose layout from window width and height, never device type or orientation; `layout-device-agnostic.test.ts` fails on `Platform.isPad`, `Dimensions.get("screen")` and similar. Structural changes need `roomy` (width and height at least 600), so phones in landscape keep the phone layout. On iOS a full-window Form is narrowed with padding over the grouped background; `listSectionMargins` does not narrow it on iPadOS 27.
- Track event keeps one tracked event per device in AsyncStorage, never in backups. Only `src/services/tracked-event.ts` starts, stops or reconciles it; code that unsaves, deletes, archives or removes events also calls `stopTrackingIfAffected`. Never show an invented end: `endAtMs` stays null without a real one, and `cleanupAtMs` is for cleanup only.
- Stop must work with JS dead. On iOS the stop target, activity name, expo-widgets notification name and the `LiveActivityAttributes` copy in `modules/conpaws-widgets/ios/ConPawsTrackedEventStop.swift` mirror `src/lib/tracked-event.types.ts` and expo-widgets; on Android the receiver class and action names live on in posted notifications. CI compiles no iOS Swift, so after a rename or an expo-widgets upgrade run `tracked-event-native-contract.test.ts` and an iOS build. Android stays a standard notification: no custom views, promotion request or foreground service.
- Watch save/remove follows the same split: the Watch sends `conpaws.watch.command.v1` (`sendMessage`, else `transferUserInfo`), the phone module (WatchConnectivity activated at launch by `ConPawsWatchSubscriber`) validates and queues it in the App Group (`conpaws.watch.commands.v1`, deduped by id, capped at 50) and emits `onWatchCommand`, and `src/services/watch-commands.ts` peeks, applies it through `src/services/event-schedule.ts` (the star's own code), publishes, then acknowledges. It ignores malformed, day-old, missing or moved events and any tap older than the row's `updatedAt` (the phone wins; feed refreshes of unchanged rows and passed-reminder clean-up leave `updatedAt` alone). Every iOS Watch payload lists `handledCommandIds`, so a declined tap frees its button; a terminated phone app applies taps when next opened. The Watch shows a change only when a snapshot confirms it; `watch-command-contract.test.ts` pins the three sides.
- Keep the shortcut route allowlist and onboarding, database, translations and
  navigator gates. Consume cold actions after the index redirect commits a tab
  route; `useSegments()` includes route groups, unlike `usePathname()`. Capture
  Android shortcuts before a development-launcher redirect; newer actions
  supersede older parked actions. Rebuild native code when changing these hooks.
- Check Android forms at 200% system text size. Keep the title on its own row
  when space is limited so Cancel and Save remain visible and usable.

## Native end-to-end checks

The local Maestro smoke flow is run through its guarded wrapper:

```bash
bun run --filter @conpaws/native e2e -- preview android <local-emulator-serial>
bun run --filter @conpaws/native e2e -- development ios <booted-simulator-UDID>
```

Use a task-owned local simulator/emulator, an English app language, completed
onboarding and intact preview fixtures. The wrapper rejects physical devices
and production variants. Preview uses the production app ID, so the flow must
verify the preview-only sample control before changing fixture data. Keep the
flow non-destructive: no data reset, uninstall, or deletion of saved conventions.
Coordinate device control when Nathanial is testing. Record source/syntax checks,
device execution and signed store delivery as separate evidence in Notion.
Set `CONPAWS_E2E_ARTIFACTS_DIR` to a temporary directory when retaining Maestro
logs/screenshots. A development client must already be connected to Metro;
preview store builds do not need that connection. Never count a skipped
platform branch as a passed device check.

## Native architecture

- **Native app:** Expo SDK **58** (React Native 0.88, React 19.3). Installed versions in `apps/native/package.json` are authoritative; keep SDK packages aligned. The root `expo-constants` override forces every workspace to the SDK-matched patch and prevents hoisted dependencies drifting to another patch; bump it with each Expo SDK patch set.
- **Apple Targets prebuild patch:** `@bacons/apple-targets@5.0.0` needs the Bun patch for incremental prebuilds. Keep the replacement configuration list attached before removing the old list and iterate a snapshot of its configurations. CI repeats prebuild to catch missing Widget/Watch references. Remove the patch only after an upstream release passes that check; see [upstream issue 201](https://github.com/EvanBacon/expo-apple-targets/issues/201).
- **Routing:** Expo Router (SDK-aligned version in `apps/native/package.json`) — file-based routes in **`apps/native/app/`** (top level, NOT `src/app/`)
  - **Router versioning note:** Expo Router uses SDK-aligned versions from SDK 55 onward. The current `expo-router@~58` major is correct — do not "fix" it to a single-digit major.
- **Styling:** NativeWind v5 release candidate (Tailwind CSS v4; keep its React Native CSS engine aligned) with `clsx` + `tailwind-merge` (`cn()` in `apps/native/src/lib/utils.ts`). iOS text-style tokens live in `global.css`; `cn()` registers their custom sizes with tailwind-merge, or those classes can be dropped as conflicts.
  - The Bun patch for `react-native-css@3.1.0-rc.0` forwards RN 0.88's `AssetRegistry` through NativeWind's React Native export wrapper. Without it, Expo Asset fails while loading Android native-tab Material icons. Keep both published CJS entries and the source entry covered; remove the patch after the upstream export is released and verified. See [react-native-css #506](https://github.com/nativewind/react-native-css/issues/506).
- **Local database:** expo-sqlite + Drizzle ORM in `apps/native/src/db/`, with bootstrap/migration logic and repositories for conventions and events
- **Auth (planned):** Better-Auth on the Worker, `@better-auth/expo` on the client — **open risk:** Expo SDK 58/New Architecture compatibility is unverified; test on a dev build before building on it
- **Payments (planned):** RevenueCat, entitlement `conpaws_plus`
- **Entry point:** `expo-router/entry` (in `apps/native/package.json` `main`)

### Key Configuration (apps/native/)

- **Expo SDK 58 prebuild:** upstream now recreates native folders by default. The repo's `prebuild` and `ship:prep` scripts explicitly use `--no-clean` to preserve machine-local native setup. Use `prebuild:clean` only deliberately after protecting custom files; Expo handles CocoaPods installation.
- **app.config.ts** — Dynamic Expo config with variant-based bundle IDs and icons
  - Local archives use one shared build number. Read the actual existing ConPaws archive/AAB metadata, choose one higher than the maximum across platforms, and bump once. Run Expo prebuild and `build-number:check` before archiving; that check covers the app, Android, Widget and Watch configurations. Do not run `ship:prep` after a manual bump, because it increments again. After release-CI activation, follow its reserved-number policy below.
  - TestFlight beta builds use `APP_VARIANT=preview` with `CONPAWS_ALLOW_PREVIEW=1` by default so demo/sample controls are available. Use production for an explicitly requested App Store release candidate, not merely because Xcode uploads through App Store Connect. Keep previews in the internal tester groups. Preserve the preview environment during both prebuild and archive: Expo Constants regenerates its bundled config during compilation. Before upload, verify the archive's `ConPawsBuildVariant` and `EXConstants.bundle/app.config` `extra.appVariant` both say `preview`. TestFlight's "Internal" label describes distribution, not the app variant; a production build uploaded internally still hides demo controls. Keep production gates intact for public builds.
- **Store automation uses GitHub Actions + Fastlane, not EAS.** `.github/workflows/release-native.yml` waits for successful push CI on the exact current `dev` or `main` commit. `dev` builds preview for internal-only TestFlight and Google Play internal testing; `main` builds production for App Store Connect and a Google Play production draft. Public rollout stays manual. Activation requires signing/upload secrets and `NATIVE_RELEASE_ENABLED=true`; until configured, keep using local builds. Public version changes are intentional edits to `app.config.ts`. CI assigns `1000 + Native release workflow run_number` to both platforms in its temporary checkout, records version/number/branch/SHA in Actions, and never commits the number. Do not rename/reset this workflow, use EAS remote counters, promote preview builds publicly, or independently allocate local store numbers after activation. For retries, start a new workflow run rather than re-run an old upload. Local signing remains scoped to `~/.keystores/conpaws-signing.properties`; the CI lane requires explicit upload signing. Preserve all Widget and Watch targets. Full setup and fallback: [mobile release guide](https://app.notion.com/p/408d61481c7b8197a680fcb3c271e969).
- **Local store builds until release CI is on:** `bun ship:testflight` (preview, uploaded with `testFlightInternalTestingOnly`), `bun ship:testflight:public` (production, eligible for external/public TestFlight groups after Beta App Review and for App Store review), `bun ship:android` / `bun ship:android:public` (a checked, upload-signed AAB in `apps/native/build/store`; upload it by hand in Play Console, and the first Play release must be manual anyway). `scripts/ship-store.mjs` uploads iOS with `xcodebuild -exportArchive` and the Xcode account (team cloud-managed distribution signing), checks the variant in the archive and bundled Expo config, all four Apple targets' build numbers, the Android upload-key fingerprint, and refuses on a dirty tree, an iOS build number at or below one already uploaded from this Mac, or `NATIVE_RELEASE_ENABLED=true` (or when `gh` cannot tell). Never send a preview build anywhere but internal testers. In the Organizer fallback choose **TestFlight Internal Only** for preview, and only distribute archives made from the command line with `APP_VARIANT` set. Run prebuild inside `apps/native`, not through the root turbo task, which drops `APP_VARIANT`.
- **eas.json** — kept but unused by the release path. Committed-tree guard, `appVersionSource: "local"` and no `autoIncrement`, so an EAS build would read the same `BUILD_NUMBER` rather than a stale remote counter. Its `preview-device` profile is the only easy route to an ad-hoc iOS build; running any profile costs money. Do not add auto-submit.
- **metro.config.js** — wraps `getSentryExpoConfig` with `withNativeWind`. No `input` argument is passed; NativeWind resolves `global.css` itself. Neutral color roles are excluded from variable inlining so Android can supply the same runtime Material palette to React Native, navigation, and Compose. Preserve that exclusion when upgrading NativeWind.
- iOS text-style tokens live in `src/global.css`; `cn()` in `src/lib/utils.ts` registers their custom sizes with tailwind-merge, or those classes can be dropped as conflicts.
- Swift tests live in `apps/native/swift-tests` and symlink Foundation-only sources. Never put package/test files in `targets/_shared`: `@bacons/apple-targets` compiles that whole folder into every target. Expo's privacy-manifest step already attaches the app manifest to the watch app, so `targets/watch` must not have its own `PrivacyInfo.xcprivacy`.
- The Watch app hides only event titles, rooms, age ratings and descriptions wrist-down: mark those `Text` views `.privacySensitive()` one by one, keep times and countdowns readable, and never mark a container that also holds a time. Watch navigation is value-based (`WatchRoute` on a `NavigationStack` path), so a pushed event survives the minute tick that moves its card.
- **postcss.config.mjs** — plugin is `@tailwindcss/postcss`
- **tsconfig.json** — Extends `expo/tsconfig.base`; path alias `@/*` maps to `./src/*`. `vitest.config.ts` mirrors it.
- **OTA is required for the MVP but remains fail-closed:** the chosen host is one shared MrDemonWolf, Inc. xprem **3.2.6** control plane on Dokploy at `updates.mrdemonwolf.com`, not EAS Update. Do not create a ConPaws-only duplicate. Every product needs an isolated xprem app UUID, signing material, branches/channels, publisher token, and runtime; ConPaws client configuration must use only its record. The runtime MCP at `/mcp` is unavailable until deployment, authenticates dashboard users through OAuth rather than publisher tokens, and can reach multiple apps: list apps and confirm the exact app UUID before any mutation. The hardened descriptor and runbook are in `infra/xprem/`; the empty `mrdemonwolf-ota-assets` and `mrdemonwolf-ota-backups` buckets were deleted on 2026-10-16 and must be recreated before deployment. PostgreSQL 16 service `xprem-control-db` is deployed with internal port 5432 and no external port. Its `dokploy-network` membership, backup setup, and full dashboard/database smoke remain unverified. A prior PostgreSQL 18.6 smoke was incomplete (`/health` 200, `/dashboard` 503), so XPRem must pass a full smoke against PostgreSQL 16 before it is connected. Dokploy's existing `dokploy-project-backups` R2 credential was exposed in an accessibility view; rotate and test it after checking whether it is shared, then use that existing destination for database backups under `xprem-control-db/`. The control plane is not deployed, and the current app still has no `expo-updates`, update URL, runtime version, or channel configuration. Enable staging only after the database smoke and XPRem deployment pass, then pass physical iOS/Android cold-start, offline-start, and rollback tests before production. See the **OTA Updates** page in Notion.

### App Variants

`APP_VARIANT` controls build configuration:
- `development` — `com.mrdemonwolf.conpaws.dev`, layered `ConPaws-development.icon` with a DEV badge, Expo dev client
- `preview` — `com.mrdemonwolf.conpaws`, the clean `ConPaws.icon` (there is no preview-badged icon; `assets/images/` holds only `ConPaws.icon` and `ConPaws-development.icon`), owner debug tools, TestFlight/Play internal only
- `production` (default) — `com.mrdemonwolf.conpaws`, clean `ConPaws.icon`, no debug tools

Build badges apply only to app/launcher icons. Keep the splash, notification,
favicon, Play Store icon, and production icon unbadged.

Preview and production are two builds of the same store app and cannot be
installed side by side. Never promote a preview build publicly.

### Native MVP Screens

The current routes cover onboarding, the Home, Schedule, and Settings tabs, convention detail, create, edit, and schedule import, plus About, appearance, language, licenses, technology, the UI system gallery, and debug tools. The Schedule tab pools starred events from every saved convention into one day-grouped list; per-convention schedules stay on the convention screen. Put new routes in `apps/native/app/` (top level).

The tab bar uses **`NativeTabs` from `expo-router/native-tabs`** (`app/(tabs)/_layout.tsx`), the stable SDK 58 import. Android `md` tab icons require the direct SDK-aligned `expo-symbols` dependency, which is optional to Expo Router in SDK 58. Keep its behavior aligned with the installed Expo Router version and re-check it on every Expo upgrade; preserve native tabs. The **Technical Blueprint** in Notion remains the source for unfinished MVP and later product scope.

### Schedule Import

ICS files and Sched convention URLs are implemented. The importer handles convention IANA timezones/DST, recurring-event identities, cancellations and re-import reconciliation, simultaneous events, categories, rooms, and content warnings. Keep re-import behavior covered with fixtures in `test-data/` and tests next to the parser, import policy, repositories, and services.
