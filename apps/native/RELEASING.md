# ConPaws mobile release guide

Use this page when a build is ready for real devices or the stores.

## The short version

1. Pull clean `main` and confirm `CI / Verify` is green for that exact commit.
2. Keep the public version, such as `1.0.0`, unchanged while testing release candidates.
3. Bump the build number and regenerate the native projects: `bun run ship:prep`.
4. Build signed artifacts on this Mac. Verify the Android signature before uploading.
5. Record the build number, artifact filename, and SHA-256 for each platform.
6. Upload the IPA with Apple Transporter and the AAB in Play Console.
7. Test the store-delivered builds on physical devices.
8. Promote those same tested builds. If code changes, make a new build and test again.

Never guess which artifact was tested.

## Builds are local, not EAS

ConPaws ships from this Mac: an Xcode Organizer archive for iOS, a Gradle
release bundle for Android. That is how `203` and `204` shipped, and as of
2026-08-27 it is the decision rather than an accident — EAS Build capacity is
paid per build, and nothing about this app needs a hosted builder.

What follows from that:

- `BUILD_NUMBER` in `app.config.ts` is the only counter. `eas.json` now sets
  `appVersionSource: "local"` with no `autoIncrement`, so even an EAS build
  would read that constant instead of handing out a number from a remote
  counter the stores have never seen.
- `eas.json` is kept, not deleted. It costs nothing, it documents the build
  profiles and the committed-tree guard, and it means an ad-hoc device build is
  one command away if that is ever worth paying for. Nothing in the release path
  runs it.
- Signing material lives on this machine and nowhere else. See "One-time setup".

The trade accepted here is that releases depend on one Mac and its keystore. A
lost keystore cannot be regenerated; see the backup note below.

## What each variant is for

`APP_VARIANT` selects these, in `app.config.ts`. The identically named `eas.json`
profiles just set the same variable.

| Variant | Result | Use it for |
| --- | --- | --- |
| `development` | Expo development client using `com.mrdemonwolf.conpaws.dev` and the DEV icon | Local development with Metro |
| `preview` | Store build using `com.mrdemonwolf.conpaws`, the production icon, and owner debug tools | Internal TestFlight or Play testing; never public release |
| `production` | Clean store IPA or AAB using `com.mrdemonwolf.conpaws` | TestFlight, Play Internal Testing, and store release |

Preview and production builds belong to the same App Store Connect and Play
Console records. They cannot be installed side by side. Preview is an
owner-only QA build and must never be promoted publicly because it includes
debug tools. Always test a clean production build before release.

iOS selects `ConPaws-development.icon` for development and `ConPaws.icon` for
preview and production. There is no preview-badged icon — `assets/images/`
contains only those two, so a preview build is visually identical to a release
build on the Home Screen. The debug menu is the only way to tell them apart. The
development badge never belongs on the splash screen.

## One-time setup

Do these once before the first production build.

### Toolchain

- Install Node.js `22.13.1` from `.node-version` and Bun `1.3.10`, then run all commands below from `apps/native`.
- Use Xcode 26.4 or newer. Expo SDK 57 targets iOS 16.4 or newer, so older devices cannot install this app baseline.
- Install Android Studio with a current SDK and JDK 17. Gradle runs from the generated `android/` project.

### Signing, and where it actually comes from

iOS signs through Xcode with the Apple Distribution certificate and provisioning
profile in the developer account. Nothing about it lives in this repo.

Android is less obvious, and worth reading once. The generated
`android/app/build.gradle` sets the release build type to
`signingConfig signingConfigs.debug` — that is Expo's CNG template default, and
`expo prebuild` rewrites the file every time, so editing it is pointless. The
real key arrives as AGP's `android.injected.signing.*` project properties, which
override whatever the build file says. That is why signing survives every
prebuild, and why Android Studio's signed-bundle dialog and `./gradlew` produce
the same result.

Those four properties live in **`~/.keystores/conpaws-signing.properties`**,
mode `0600`, outside the repo:

```properties
android.injected.signing.store.file=/Users/<you>/.keystores/conpaws-upload.jks
android.injected.signing.store.password=...
android.injected.signing.key.alias=...
android.injected.signing.key.password=...
```

`plugins/withUploadSigning.js` reads that file at prebuild and writes the values
into the generated `android/gradle.properties`, which is covered by the
`android/` entry in `.gitignore`, so they never reach version control.

They used to sit in `~/.gradle/gradle.properties`, which Gradle applies to
**every** project on the machine — any other Android app released from this Mac
would have been signed with the ConPaws upload key without a word about it. They
were moved on 2026-08-28; `~/.gradle/gradle.properties.pre-conpaws-scoping.bak`
holds the original if anything needs checking.

On a machine without that file — CI, a fresh clone — the plugin does nothing and
Gradle falls back to the debug key. That is deliberate, because prebuild runs
constantly during development and must not require release credentials. It also
means a release build there is silently debug-signed, which is why the signature
check below is not optional.

**The keystore is `~/.keystores/conpaws-upload.jks`, created 2026-08-26, and it
is irreplaceable.** It is the upload key Play has on file. Losing it means
requesting an upload-key reset from Google and waiting days. Back up the file
and its passwords to an encrypted vault now, not at the next release. Never
commit certificates, provisioning profiles, keystores, service-account JSON,
passwords, or tokens.

### Apple

- Have an active Apple Developer Program membership.
- In App Store Connect, create the ConPaws app record for bundle ID `com.mrdemonwolf.conpaws`.
- Install Apple's Transporter app on the Mac that will upload the IPA.
- Make sure the Apple account can upload builds and manage TestFlight and App Store releases.

### Google

- In Play Console, create the ConPaws app for package `com.mrdemonwolf.conpaws`.
- Complete Play App Signing setup, store access, policy declarations, and the Internal Testing track.
- Make sure the Google account can create releases and promote them to Production.

## Version and build-number rules

There are two kinds of version:

- Public version: the version customers see, such as `1.0.0`. It lives in `app.config.ts`.
- Build number: an internal, always-increasing store number. Apple calls it `buildNumber`; Google calls it `versionCode`.

One number covers both platforms. `BUILD_NUMBER` in `app.config.ts` becomes
`CFBundleVersion` on iOS and `versionCode` on Android, so unlike the EAS remote
counters they never diverge. Gaps are normal and cost nothing.

Example release-candidate history:

| Candidate | Public version | Build number |
| --- | --- | --- |
| RC 1 | `1.0.0` | `205` |
| RC 2 | `1.0.0` | `206` |
| RC 3, discarded | `1.0.0` | `207` |
| Released build | `1.0.0` | `208` |

Do not recycle `207`. Keep the public version at `1.0.0` through all of these candidates. Change it to `1.0.1` or `1.1.0` only when starting that customer-facing release.

A store rejects a reused or lower number, and the rejection arrives after the
build and the upload, not before.

### Where the last builds went

`BUILD_NUMBER` says what was last **built**. It cannot say whether that number
was ever **uploaded**, and only an uploaded number is actually spent. This table
is that missing half — check it before a release to see what a store already
holds.

Keep the **last two rows only**. Every earlier row is still in this file's git
history, so trimming loses nothing and stops the table growing into noise.

| Build | Version | iOS | Android | Date |
| --- | --- | --- | --- | --- |
| 205 | `1.0.0` | TestFlight | Play internal testing | 2026-08-29 |

Add a row when a build reaches a store, not when it is built — a candidate that
never leaves the machine has spent nothing and belongs nowhere near this table.
Promoting an existing build to production changes no number: the store releases
the binary it already has, so update that row's status rather than adding one.

### Bumping it: `bun run ship:prep`

The constant has to move before every candidate that reaches TestFlight, Play,
or a registered device. From `apps/native`, use this instead of `expo prebuild`:

```bash
bun run ship:prep
```

It bumps the constant, regenerates the native projects, and then verifies that
the regenerated `ios/ConPaws/Info.plist` and `android/app/build.gradle` carry
the new number. That last step is the one that earns its keep: `ios/` and
`android/` are gitignored CNG output, so a bump that is not followed by a
prebuild leaves the archive on the previous number, and the store rejects the
upload as a duplicate after the build has already been paid for in time.

Inspect the current state without changing anything:

```bash
bun run build-number:check
```

Commit `app.config.ts` with the release so the constant records what shipped.
Burned numbers are fine. A discarded candidate that skips a number costs
nothing, because both stores only require the number to increase.

`ship:prep` always bumps, because the normal case is that the current number is
already on a store. When the constant has been moved ahead separately and that
number has not shipped yet, bumping again would skip it — use the two halves
instead, and the build comes out on the number already in the file:

```bash
bun prebuild
bun run build-number:check
```

An EAS build, if one is ever run, reads the same constant — `eas.json` sets
`appVersionSource: "local"` for exactly that reason.

### The preview guard

`build-number:check` also refuses a build that came from `APP_VARIANT=preview`.
It reads two signals: the environment variable, which catches a preview
`ship:prep` before prebuild has even run, and `ConPawsBuildVariant` in the
generated `ios/ConPaws/Info.plist`, which catches an archive of native output
that was prebuilt as preview earlier. `app.config.ts` writes that key for no
other reason.

This exists because preview and production share a bundle identifier and an
icon, so nothing on the Home Screen tells them apart, while `preview` turns on
the debug menu, the fixture data and the UI gallery. ConPaws ships to a
**public** TestFlight, where the wrong artifact reaches everyone with the link.

For a deliberate owner QA build, set the escape hatch:

```bash
APP_VARIANT=preview CONPAWS_ALLOW_PREVIEW=1 bun run ship:prep
```

Verify an archive after the fact with:

```bash
plutil -extract ConPawsBuildVariant raw -o - ios/ConPaws/Info.plist
```

Note the `-o -`. Without it `plutil -extract` overwrites the file with the
extracted value instead of printing it.

## Every release candidate

### 1. Start from the exact code being shipped

From `apps/native`:

```bash
git switch main
git pull --ff-only
git status --short
git rev-parse HEAD
gh run list --workflow ci.yml --branch main --limit 1
```

Stop unless all of these are true:

- `git status --short` prints nothing.
- The latest GitHub Actions run is for the displayed commit and its `CI / Verify` job is green.
- The public version in `app.config.ts` is correct.
- `https://conpaws.com/privacy`, `/terms`, and `/support` show their real pages,
  not the marketing fallback.
- A production CNG prebuild contains the iPhone widget, Watch app, and Watch
  widget targets with production bundle identifiers and matching App Groups.

A clean tree does not replace green CI. Building locally means nothing verifies
the commit for you.

### 2. Bump the number and regenerate the native projects

```bash
bun run ship:prep
```

This is the step that is easy to skip and expensive to skip. It bumps
`BUILD_NUMBER`, runs `expo prebuild`, and then confirms the regenerated
`ios/ConPaws/Info.plist` and `android/app/build.gradle` carry the new number.
Commit `app.config.ts` afterwards so the constant records what shipped.

### 3. Build both artifacts

**Android**, from `apps/native`:

```bash
cd android
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew bundleRelease
```

`ANDROID_HOME` is needed because `expo prebuild` deletes `android/`, and
`local.properties` — which is where the SDK path normally lives — goes with it.
Android Studio recreates that file on open, which is why the GUI path never hits
this and the command line does. The failure is immediate and says `SDK location
not found`.

Sentry's Gradle step uploads source maps and needs `SENTRY_AUTH_TOKEN` from
`apps/native/.env.production`. Source that file in the shell rather than passing
the token on the command line. Without it the build fails at the very end, after
about five minutes, on `createBundleReleaseJsAndAssets_SentryUpload`. Passing
`SENTRY_DISABLE_AUTO_UPLOAD=true` skips the upload, which is fine for a
throwaway verification build and wrong for a release — a release with no source
maps produces unreadable stack traces in Sentry.

The bundle lands in `android/app/build/outputs/bundle/release/`. Copy it to
`apps/native/build/` named for its version and build number, matching
`ConPaws-1.0.0-204.aab`, so the release record points at a file that still
exists next month. `apps/native/build/` is gitignored.

Android Studio's **Build > Generate Signed App Bundle** produces the same
artifact; the signing key comes from the injected properties either way.

**Verify the signature before uploading.** A bundle signed with the debug key
looks normal until Play rejects it:

```bash
keytool -printcert -jarfile build/ConPaws-1.0.0-205.aab
```

The owner must read `CN=ConPaws, O=MrDemonWolf Inc., L=Beloit, ST=Wisconsin, C=US`
with SHA-256 fingerprint:

```
16:B1:61:7A:50:8B:9A:BA:36:DB:67:A1:CC:4A:83:E8:57:94:19:13:B2:D7:05:84:18:93:18:EC:12:63:77:17
```

Anything else — in particular `CN=Android Debug` — means the injected signing
properties were not picked up. Do not upload it.

**iOS**: open `ios/ConPaws.xcworkspace` in Xcode, select **Any iOS Device**, then
**Product > Archive**. Keep the archive; export the IPA from Organizer with
**Distribute App > App Store Connect**. Save both under `apps/native/build/`
alongside the AAB.

Record each artifact's filename and SHA-256:

```bash
shasum -a 256 build/ConPaws-1.0.0-205.aab build/ConPaws-1.0.0-205.ipa
```

Never select an artifact by "newest". Two candidates of the same version differ
only by build number, and the filenames are the only thing keeping them apart.

### 4. Upload iOS manually

1. Open Apple Transporter and sign in with the authorized App Store Connect account.
2. Add the IPA recorded in step 3, by filename.
3. Confirm Transporter shows `com.mrdemonwolf.conpaws`, then deliver it.
4. In App Store Connect, wait for processing and confirm the public version and build number match the release record.
5. Add the processed build to the intended internal TestFlight group and fill in "What to Test."
6. Install it from TestFlight on a physical iPhone and complete the smoke checklist below.

When the candidate passes, select that same processed build for the App Store version, finish the listing and review information, and submit it for review. Choose the release timing yourself in App Store Connect.

If the code changes after TestFlight testing, do not release the old result by accident. Build a new candidate, upload it, and repeat the tests.

### 5. Upload Android manually

1. Open Play Console and choose ConPaws.
2. Go to Testing, then Internal testing, and create a release.
3. Upload the AAB recorded in step 3, after the signature check passed.
4. Confirm Play Console shows package `com.mrdemonwolf.conpaws`, the expected public version, and the recorded version code.
5. Add release notes, review the warnings, and roll the release out to the internal track.
6. Install it from Google Play on a physical Android phone and complete the smoke checklist below.

When the candidate passes, promote that same tested release from Internal testing to Production in Play Console. Review the production rollout and policy status, then start the rollout yourself. A staged rollout is safer than an immediate 100% rollout.

If the code changes, upload a newly built AAB with a higher version code and repeat the tests.

## Physical-device smoke checklist

Complete this on the TestFlight build and the Play Internal Testing build, not just in Expo Go or a preview build.

- [ ] Fresh install launches without a crash and shows clear empty/loading/error states.
- [ ] Upgrade over the previous store build launches and preserves the local schedule.
- [ ] Import a real convention ICS file; simultaneous events remain separate and show their rooms.
- [ ] Star events, close the app, reopen it, and confirm the schedule is still present.
- [ ] Check Now/Next and event times in the convention timezone, including an overlap.
- [ ] Schedule a reminder, background or terminate the app, and confirm the notification arrives with the correct event and room.
- [ ] Add the small and medium Home Screen widgets; check Coming Up, Next, Leave In, and blank states in light, dark, and tinted appearances.
- [ ] Add all three Lock Screen widgets (circular, rectangular, inline); check the same four states on each.
- [ ] Check the Lock Screen widgets against a light photo wallpaper as well as a dark one. They render in `vibrant`, which strips colour, so anything that has become unreadable there is a real defect rather than a wallpaper choice.
- [ ] Pair an Apple Watch, open the Watch app, and confirm Now, Next, Later, event detail, offline cache, and the Smart Stack widget use the same schedule.
- [ ] Confirm Leave In appears on iPhone and Watch only for an event with a configured leave reminder; verify the mirrored Watch notification/haptic once.
- [ ] Change a saved schedule on iPhone, reopen the app, and confirm the widgets and Watch receive the new snapshot.
- [ ] Turn on airplane mode and confirm the imported schedule and core planning flow still work.
- [ ] Check large text, VoiceOver or TalkBack labels, light/dark appearance, and one small-screen device.
- [ ] Confirm the standard ConPaws icon appears and no debug menu or test-only data is available.

Record device models, OS versions, pass/fail results, and any accepted limitation. A simulator pass is useful evidence, but it is not store-release approval.

### Installing the Watch app on a physical Apple Watch

The Watch app ships inside the iPhone app; it is not a separate TestFlight
download. If Available Apps shows ConPaws but Install fails with "This app could
not be installed at this time":

> **Export a backup before step 3.** ConPaws is local-first and there is no
> cloud sync yet, so the schedule lives only in the on-device SQLite database.
> Deleting the iPhone app deletes it. Use **Settings → Export Data** first, and
> keep the file somewhere off the phone. Step 4 erases the Watch as well.

1. Keep the Watch on Wi-Fi and on the charger. Low Power Mode and a low battery
   both block installs without reporting why.
2. Open Watch on iPhone, scroll to Available Apps, and install from there.
   Automatic install can silently skip a build whose watch bundle changed.
3. If that fails, export a backup, delete the ConPaws iPhone app, reinstall it
   from TestFlight, and import the backup. The Watch app is embedded in the
   iPhone bundle, so a stale iPhone install carries a stale Watch app with it.
4. Only if it still fails, unpair and re-pair the Watch. This erases the Watch
   and requires setting it up again; it is the only reliable way to clear a bad
   companion-app record, so treat it as the last resort.

Also confirm the Watch runs watchOS 10 or newer —
`targets/watch/expo-target.config.js` sets `deploymentTarget: "10.0"`, so Series 3
and older cannot install at all, and no amount of reinstalling will change that.

Preview and production share the bundle identifier `com.mrdemonwolf.conpaws`, so
they also share the Watch bundle identifier. Installing one replaces the other.

## Promote or stop

Promote only when all of these point to the same binary:

- Git commit and green `CI / Verify` run
- Build number, the same on both platforms
- IPA or AAB checksum
- Android signature fingerprint check
- TestFlight or Play internal release that passed the physical-device checklist

Stop and make a new candidate if the commit, code, configuration, signing identity, or artifact changes. Do not rebuild a passing candidate merely to call it "final"; promote the exact tested binary.

## Release record template

Copy this into the release issue or private release log. Do not put credentials in it.

```text
ConPaws release candidate:
Public version:
Build number (both platforms):
Candidate label:
Git commit SHA:
CI / Verify run URL:

iOS IPA filename:
iOS IPA SHA-256:
TestFlight group/status:
Widget/Watch paired-device result:
Privacy/terms/support URL result:

Android AAB filename:
Android AAB SHA-256:
Android signer fingerprint verified (y/n):
Play internal release/status:

Physical devices and OS versions:
Smoke-test result:
Known accepted limitations:

App Store review/release status:
Play production rollout status:
Operator and date:
```

### The expo-notifications keychain error in local builds

An unsigned local build logs this on every launch:

```
[expo-notifications] Error reading persisted server registration info:
ERR_NOTIFICATIONS_KEYCHAIN_ACCESS
```

It is not an app bug and nothing in ConPaws should try to silence it.
Building with `CODE_SIGNING_ALLOWED=NO` strips entitlements -- confirm with
`codesign -d --entitlements - <path>.app`, which prints nothing for such a
build. With no entitlements there is no keychain access group, so
expo-notifications' internal push-registration read fails with
`errSecMissingEntitlement`.

Nothing in this app calls that API; push is not wired up yet (CON-45). Local
notifications, which are what the app actually uses, work regardless -- the
debug screen's test notification schedules and fires normally. The error goes
away on any signed build.

### A stale `android/` breaks the app at launch

Symptom: the app builds, installs, and bundles, then every screen falls to the
"Something went wrong" boundary with `TypeError: undefined is not a function`.
The stack points at `react-native-gesture-handler/src/init.ts` calling
`RNGestureHandlerModule.install()` from `GestureHandlerRootView.android.tsx`.

It is not a dependency bug. There is one copy of gesture-handler at the pinned
version, the generated `NativeRNGestureHandlerModuleSpec.java` does declare
`install()`, and the same code runs on iOS. What has gone wrong is that
`android/` was generated by an older prebuild and Gradle reused the codegen
from it, so the TurboModule JS asks the native side for a method that build
does not expose. Fix:

```bash
cd apps/native
export ANDROID_HOME=$HOME/Library/Android/sdk
bunx expo prebuild --clean --platform android
bun android
```

Two traps in that sequence:

- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`.** A clean prebuild re-applies
  `withUploadSigning`, so the new APK is signed differently from whatever is
  already on the device. `bun android` fails at the install step *after* a
  successful compile, and its exit code is easy to miss because Metro has
  already printed its banner. `adb uninstall com.mrdemonwolf.conpaws.dev`
  first, then install again.
- **`bun android` takes Metro down with it.** When the install step fails the
  whole script exits, killing the bundler it just started. The dev client then
  shows `java.io.IOException: unexpected end of stream on http://localhost:8081`
  which reads like a network fault and is really just a dead Metro. Start one
  yourself with `bunx expo start --dev-client` and reconnect with
  `adb reverse tcp:8081 tcp:8081`.

Verified 2026-08-30: after a clean prebuild the app launches, onboarding and
the Conventions, Schedule and Settings tabs all render.

## Owner preview builds

Preview is the same store app with the QA icon and the owner debug menu. Build
it exactly like a release candidate, with `APP_VARIANT=preview`, and upload the
IPA to the ConPaws App Store Connect record for the owner's internal TestFlight
group only, or the AAB to the internal Play track.

A preview build still consumes a build number, because the stores do not care
why the artifact exists. Never submit one for public review or promote it to
production — `CONPAWS_ALLOW_PREVIEW=1` is required to build one at all, which is
the point: it cannot happen by forgetting to unset a variable.

## The EAS profiles, and when they would cost money

`eas.json` still defines `development`, `preview`, `preview-device`, and
`production`. Nothing in this guide runs them, and running one is a paid EAS
Build. They are kept for two reasons: the profiles document what each variant is
meant to produce, and `preview-device` is the only easy route to an **ad-hoc**
iOS build that installs on a registered device from a link, without TestFlight
processing.

If that is ever worth paying for:

```bash
bunx eas-cli@22 build --profile preview-device --platform ios
```

- Register the device first (`eas device:create`, then
  `eas device:list --apple-team-id HBB7T99U79` to confirm).
- It shares `com.mrdemonwolf.conpaws` with the store builds, so installing it
  replaces whatever is on the device, and vice versa.
- It reads `BUILD_NUMBER` like everything else now — `appVersionSource` is
  `local` and no profile sets `autoIncrement`.
- Never promote an ad-hoc artifact. It cannot go to the store.

## Official references

- [Expo TestFlight distribution](https://docs.expo.dev/submit/testflight/)
- [Expo app variants](https://docs.expo.dev/build-reference/variants/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)
- [Expo manual iOS upload](https://docs.expo.dev/submit/ios-manual/)
- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)
- [Apple build association rules](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Google Play release preparation](https://support.google.com/googleplay/android-developer/answer/9859348)
