# ConPaws mobile release guide

Use this page when a build is ready for real devices or the stores.

## The short version

1. Pull clean `main` and confirm `CI / Verify` is green for that exact commit.
2. Keep the public version, such as `1.0.0`, unchanged while testing release candidates.
3. Create signed `production` builds with EAS. Do not use auto-submit.
4. Record both EAS build IDs and download those exact artifacts.
5. Upload the IPA with Apple Transporter and the AAB in Play Console.
6. Test the store-delivered builds on physical devices.
7. Promote those same tested builds. If code changes, make a new build and test again.

Never use `--latest`. Never guess which artifact was tested.

## What each build profile is for

| Profile | Result | Use it for |
| --- | --- | --- |
| `development` | Internal Expo development client using `com.mrdemonwolf.conpaws.dev` and the DEV icon | Local development with Metro |
| `preview` | Store-signed build using `com.mrdemonwolf.conpaws`, the production icon, and owner debug tools | Internal TestFlight or Play testing; never public release |
| `production` | Store-signed iOS IPA or Android AAB using `com.mrdemonwolf.conpaws` | TestFlight, Play Internal Testing, and store release |

Preview and production builds belong to the same App Store Connect and Play
Console records. They cannot be installed side by side. Preview is an
owner-only QA build and must never be promoted publicly because it includes
debug tools. Always test a clean production build before release.

iOS selects `ConPaws-development.icon` for development and `ConPaws.icon` for
preview and production. The development badge never belongs on the splash screen.

## One-time setup

Do these once before the first production build.

### Expo and signing

- Install Node.js `22.13.1` from `.node-version` and Bun `1.3.10`, then run all commands below from `apps/native`.
- Use Xcode 26.4 or newer. Expo SDK 57 targets iOS 16.4 or newer, so older devices cannot install this app baseline.
- Sign in with `npx eas-cli@22.0.0 login` and confirm the account with `npx eas-cli@22.0.0 whoami`.
- Confirm access to the `mrdemonwolf-org/conpaws` EAS project. The project ID is already in `app.config.ts`; do not relink it casually.
- Let the first interactive production build configure EAS-managed iOS and Android signing credentials, or select credentials that already belong to this app.
- Save recovery details in an encrypted vault or password manager. Never commit certificates, provisioning profiles, keystores, service-account JSON, passwords, or tokens.

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

The production EAS profile uses remote version counters and `autoIncrement`. EAS increments iOS and Android independently for every production build. The counters do not need to match, and gaps are normal.

Example release-candidate history:

| Candidate | Public version | iOS build | Android version code |
| --- | --- | --- | --- |
| RC 1 | `1.0.0` | `34` | `58` |
| RC 2 | `1.0.0` | `35` | `59` |
| RC 3, discarded | `1.0.0` | `36` | `60` |
| Released build | `1.0.0` | `37` | `61` |

Do not recycle `36` or `60`. Keep the public version at `1.0.0` through all of these candidates. Change it to `1.0.1` or `1.1.0` only when starting that customer-facing release.

Check the current remote counters:

```bash
npx eas-cli@22.0.0 build:version:get --platform ios --profile production
npx eas-cli@22.0.0 build:version:get --platform android --profile production
```

If neither store has ever received ConPaws, let the first interactive production build initialize the counters, then record the values it produced.

If either store already contains builds, first find the highest number in App Store Connect and Play Console. Set each EAS remote counter to that platform's highest existing value:

```bash
npx eas-cli@22.0.0 build:version:set --platform ios --profile production
npx eas-cli@22.0.0 build:version:set --platform android --profile production
```

The commands prompt for the values. With `autoIncrement` enabled, the next production build should use the next number. Verify the number on the completed EAS build before uploading it. A store will reject a reused or lower number.

## Every release candidate

### 1. Start from the exact code being shipped

From `apps/native`:

```bash
git switch main
git pull --ff-only
git status --short
git rev-parse HEAD
gh run list --workflow ci.yml --branch main --limit 1
npx eas-cli@22.0.0 whoami
```

Stop unless all of these are true:

- `git status --short` prints nothing.
- The latest GitHub Actions run is for the displayed commit and its `CI / Verify` job is green.
- The public version in `app.config.ts` is correct.
- The signed-in Expo account is the intended account.
- `https://conpaws.com/privacy`, `/terms`, and `/support` show their real pages,
  not the marketing fallback.
- A production CNG prebuild contains the iPhone widget, Watch app, and Watch
  widget targets with production bundle identifiers and matching App Groups.

`eas.json` requires a committed tree, but that is only one guard. A clean tree does not replace green CI.

### 2. Build, without submitting

Use a clear message and build each platform separately so the IDs are hard to mix up:

```bash
npx eas-cli@22.0.0 build --platform ios --profile production --message "1.0.0 RC 1"
npx eas-cli@22.0.0 build --platform android --profile production --message "1.0.0 RC 1"
```

Do not add `--auto-submit`. These builds use paid EAS Build capacity, so only run them when you intend to create a candidate.

As soon as each build starts, put its platform, EAS build ID, Git commit, and candidate name in the release record. When it finishes, inspect the exact ID:

```bash
npx eas-cli@22.0.0 build:view IOS_EAS_BUILD_ID --json
npx eas-cli@22.0.0 build:view ANDROID_EAS_BUILD_ID --json
```

Open those exact build pages and download their artifacts. The production iOS artifact is an IPA; the production Android artifact is an AAB. Record each filename and SHA-256 checksum.

Never select an artifact by "newest," and never use a submission command with `--latest`.

### 3. Upload iOS manually

1. Open Apple Transporter and sign in with the authorized App Store Connect account.
2. Add the IPA downloaded from the recorded iOS EAS build ID.
3. Confirm Transporter shows `com.mrdemonwolf.conpaws`, then deliver it.
4. In App Store Connect, wait for processing and confirm the public version and build number match the release record.
5. Add the processed build to the intended internal TestFlight group and fill in "What to Test."
6. Install it from TestFlight on a physical iPhone and complete the smoke checklist below.

When the candidate passes, select that same processed build for the App Store version, finish the listing and review information, and submit it for review. Choose the release timing yourself in App Store Connect.

If the code changes after TestFlight testing, do not release the old result by accident. Build a new candidate, upload it, and repeat the tests.

### 4. Upload Android manually

1. Open Play Console and choose ConPaws.
2. Go to Testing, then Internal testing, and create a release.
3. Upload the AAB downloaded from the recorded Android EAS build ID.
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
- EAS build ID
- IPA or AAB checksum
- iOS build number or Android version code
- TestFlight or Play internal release that passed the physical-device checklist

Stop and make a new candidate if the commit, code, configuration, signing identity, or artifact changes. Do not rebuild a passing candidate merely to call it "final"; promote the exact tested binary.

## Release record template

Copy this into the release issue or private release log. Do not put credentials in it.

```text
ConPaws release candidate:
Public version:
Candidate label:
Git commit SHA:
CI / Verify run URL:

iOS EAS build ID:
iOS build number:
iOS IPA filename:
iOS IPA SHA-256:
TestFlight group/status:
Widget/Watch paired-device result:
Privacy/terms/support URL result:

Android EAS build ID:
Android version code:
Android AAB filename:
Android AAB SHA-256:
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

## Ad-hoc device builds (`preview-device`)

`preview-device` is the same app as `preview` — production bundle identifier,
production icon, debug tools — but built for **internal (ad-hoc) distribution** instead
of the store. It exists so a build can be installed straight onto a registered
device from a link, without waiting on TestFlight processing. Use it when you
need a fast on-device check, especially of the embedded Watch app.

```bash
bunx eas-cli@22 build --profile preview-device --platform ios
```

Rules:

- The device must be registered first (`eas device:create`, then
  `eas device:list --apple-team-id HBB7T99U79` to confirm).
- It shares `com.mrdemonwolf.conpaws` with `preview` and `production`, so
  installing it replaces any store build already on the device, and vice versa.
- It deliberately does **not** set `autoIncrement`, so throwaway device builds
  never advance the remote store build number.
- Never promote a `preview-device` artifact. It is ad-hoc signed and cannot go
  to the store. Release candidates still come from `production`.

## Owner preview builds

Preview is a store build of the real app with the QA icon and owner debug menu.
Build it without auto-submit:

```bash
npx eas-cli@22.0.0 build --platform ios --profile preview --message "preview: short description"
npx eas-cli@22.0.0 build --platform android --profile preview --message "preview: short description"
```

Upload the iOS IPA to the existing ConPaws App Store Connect record and add it
only to the owner's internal TestFlight group. Upload the Android AAB to the
internal Play track. Do not submit either preview build for public review or
promote it to production. Build and test the `production` profile separately
when the release candidate is ready.

## Official references

- [Expo TestFlight distribution](https://docs.expo.dev/submit/testflight/)
- [Expo app variants](https://docs.expo.dev/build-reference/variants/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)
- [Expo manual iOS upload](https://docs.expo.dev/submit/ios-manual/)
- [Expo local production builds](https://docs.expo.dev/guides/local-app-production/)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)
- [Apple build association rules](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Google Play release preparation](https://support.google.com/googleplay/android-developer/answer/9859348)
