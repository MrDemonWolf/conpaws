# Handoff: Android UI work on ConPaws

**Created:** 2026-08-24
**Branch:** `fix/android-parity` (2 commits, not pushed, no PR yet)
**Next goals, in order:** (1) land the current branch, (2) fix `Stack.Toolbar` on Android, (3) the Android theming overhaul, (4) loading states on both platforms.

---

## Constraints the user set — these override defaults

1. **Mobile design standards only.** Apple HIG and Material Design 3. Not NN/g, not WCAG web checklists, not CSS breakpoints. Touch targets are 44pt (iOS) / 48dp (Android), never web a11y rules.
2. **Prefer real native components** (`@expo/ui/swift-ui`, `@expo/ui/jetpack-compose`) over NativeWind-styled RN `View`s. NativeWind only where a native component won't do.
3. **Android should look like Android.** The user's words: the Android UI "sucks", doesn't match iOS quality, and has "too many diff colors". Fixing that is goal 3 and they chose the Android-native Material 3 direction.

---

## How to run and verify

The user has a **physical Galaxy A15 5G (SM-S156V), Android 16**, paired over **wireless debugging**. This is the verification device — emulators died repeatedly under memory pressure on this Mac, and the host regularly sits at load 100+.

```bash
# Reconnect (the phone advertises over mDNS; the port changes between sessions)
adb mdns services            # look for _adb-tls-connect._tcp, note IP:port
adb connect <ip>:<port>      # if refused, the phone needs re-pairing:
                             # Developer options -> Wireless debugging ->
                             # Pair device with pairing code -> adb pair <ip>:<port>

adb reverse tcp:8081 tcp:8081                 # Metro tunnel, works over wireless
npx expo start --dev-client                   # from apps/native
adb shell am start -a android.intent.action.VIEW \
  -d "conpaws-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Hard-won details, don't rediscover them:

- **Gradle needs `ANDROID_HOME`** explicitly — `ANDROID_HOME=$HOME/Library/Android/sdk npx expo run:android`. Without it the build dies with "SDK location not found" after `expo prebuild` regenerates `local.properties`.
- **`expo run:android` does NOT re-run prebuild** when `android/` already exists, so `app.config.ts` changes silently do not reach the manifest. Run `npx expo prebuild --platform android` explicitly and then check the generated manifest before trusting a config change.
- **Screenshots:** `adb exec-out screencap -p > out.png` beats scrcpy for agent use — native resolution, direct framebuffer, no desktop capture. scrcpy (`brew install scrcpy`, installed) is for the *user* to watch live.
- **The phone's screen timeout is 30s** and black screenshots are almost always just a dozing screen, not a broken app. Check `adb shell dumpsys display | grep mScreenState`. The cheapest fix is `adb shell svc power stayon true` while it is on the cable — no settings write, and `adb shell svc power stayon false` puts it back. Changing `screen_off_timeout` itself needs the user's OK (org-managed phone) and must be restored to `30000`.
- **`mScreenState=ON` with `mCurrentFocus=null` and a black frame means the app is still on the splash screen**, not crashed — a cold start after `am force-stop` takes ~40s to first paint over wireless Metro. Confirm with `adb shell pidof com.mrdemonwolf.conpaws.dev` before chasing a crash.
- **Don't `adb shell input swipe` from the bottom edge** — it's the home gesture and backgrounds the app. Deep links (`conpaws-dev://convention/create`) are far more reliable than blind taps.
- `bun test` runs **Bun's** test runner and fails wrongly. Use **`bun run test`** for Vitest.

---

## Goal 1: land `fix/android-parity`

Two commits, both green (239 native + 45 web tests, typecheck and lint clean).

### `a722195` — the parity fixes

- **Unsaved-changes guards.** New `src/hooks/useUnsavedChangesGuard.ts` covers the back gesture, hardware back and sheet dismissal via `usePreventRemove`, plus explicit Cancel. Applied to create, edit, import, and `ManualEventModal` (which uses the exported `confirmDiscardChanges` since it is a modal, not a route). Before this, **all four surfaces silently destroyed user input** — `BackHandler`/`usePreventRemove`/`beforeRemove` had zero occurrences app-wide, and `edit.tsx` computed a dirty flag it used only to enable Save.
- **Predictive back enabled** via `android.predictiveBackGestureEnabled` in `app.config.ts`. Expo's prebuild default is hard-off. **Verified on device** — logcat shows `CoreBackPreview: Setting back callback OnBackInvokedCallbackInfo{...}`, which only appears when the flag is true.
- **Haptics rewritten.** New `src/services/haptics.ts` exposes semantic helpers (`hapticSuccess`, `hapticToggle`, `hapticLongPress`, `hapticTap`) that route to `performAndroidHapticsAsync` on Android, so they respect OEM tuning and the system touch-feedback setting — raw `impactAsync` amplitude patterns do not. The schedule toggle now distinguishes on from off (the code knew the direction and discarded it). Plain row taps no longer fire haptics on Android, where Material 3 expects the ripple. All 9 previously-raw call sites migrated; 3 were floating promises.
- **Haptics settings toggle**, persisted via `src/lib/haptics-storage.ts` following the existing `appearance-storage.ts` pattern. Pure encode/decode lives in `src/lib/haptics.ts` so it is testable without pulling in native modules — that split matters, the first version failed to transform under Vitest.
- **Touch targets:** shared `Button` primitive and `OnboardingButton.android.tsx` 44 → 48 (Material 3 minimum); the timezone picker's Done button had no padding at all (~24pt tall).
- **Populated lists** in schedule and convention detail had bottom padding only when *empty*, so the last row ran under the system nav bar.
- **Modals** now set `statusBarTranslucent` / `navigationBarTranslucent` for edge-to-edge; `ManualEventModal`'s `onRequestClose` no longer goes `undefined` mid-save (which left back with no handler).

### `413dea9` — the form header, verified on device

The original ask. On Android the form sheet's Cancel and Add were clipped to slivers once a field took focus. Fixed by presenting the three form routes as a **full-screen `modal`** on Android instead of a `formSheet` (a sheet re-lays-out for the keyboard; a full-screen modal cannot clip), with a shared `src/components/FormModalHeader.tsx` replacing the three hand-rolled rows. **Verified on the physical device.**

### What's verified where

| | iOS sim | Android device |
|---|---|---|
| Form header renders correctly | yes | **yes** |
| Unsaved-changes guard, Cancel button | **yes** | **yes** |
| Unsaved-changes guard, hardware back | **yes** | **yes** |
| Predictive back registers | n/a | **yes (logcat)** |
| Haptics toggle renders, flips, persists | **yes** | **yes** |
| A haptic actually reaches the motor | **yes** | **yes (vibrator history)** |

All device checks pass. What was exercised on the Galaxy A15, in order: opened
`convention/create`, typed into Convention Name, tapped Cancel → "Discard
changes? / Your changes will be lost." with KEEP EDITING and DISCARD; KEEP
EDITING returned to the form with the input intact; hardware back then raised
the same dialog and DISCARD exited. Haptic Feedback toggled off, survived an
`am force-stop` and cold relaunch still off, then was restored to on.

One Android detail worth knowing: the **first** hardware back only dismisses the
IME. The guard fires on the second press. That is correct Android behaviour, not
a missed callback — do not "fix" it.

**How to prove a haptic actually fired**, rather than that a toggle flipped —
Android keeps a system-wide vibration log, and it records requests that were
dropped as well as ones that played:

```bash
adb shell dumpsys vibrator_manager | grep conpaws
```

`finished … played: [Step=…]` means the motor ran. `ignored_unsupported …
played: null` means the request was dropped on the floor. That distinction is
what caught the regression below, and it is the only honest way to test haptics
over adb — you cannot feel the phone from here.

---

## Goal 2: `Stack.Toolbar` does not work on Android — bigger than it looks

**Confirmed on the physical device.** `app/(tabs)/(home)/convention/[id].tsx` renders `Stack.Toolbar placement="right"` **ungated**, holding Edit plus two menus (Add event, Import schedule, Filter). On Android the header shows **only the back arrow and title**. None of those actions render.

So on Android today, a user with a populated convention **cannot reach Edit, Add event, Import schedule, or Filter at all.** The empty state has its own buttons, which is why this went unnoticed.

An earlier audit claimed Android renders these into the Material toolbar. That was inferred from reading `expo-router/build/layouts/stack-utils/toolbar/processHeaderItemsForPlatform.android.js` (which does return `headerShown: true` plus `headerLeft`/`headerRight`) and **never observed**. Trust the device.

Affected, all currently invisible on Android: `convention/[id].tsx` (Edit + 2 menus), `(home)/index.tsx` (Sort and Add menus — though the `+` does render, so verify each individually).

The likely fix is `headerLeft`/`headerRight` render props on Android instead of `Stack.Toolbar`, mirroring what `FormModalHeader` does for the form screens. Verify on device before believing any of it. Reuse `FormModalHeader` rather than writing a fourth header — the user has been explicit that they do not want the same thing built several times over.

### A second dead control, same family: the ⋮ row button

Found on device 2026-08-24. On the Conventions list, tapping the ⋮ glyph does
**nothing**. Tapping a few dp beside it, still inside the same button, opens the
Edit / Archive / Delete menu correctly. So the control works and its hit area is
the right size — the icon itself is eating the touch.

The button in `ConventionCard.tsx` wraps its icon in an `@expo/ui` `Host` with
`pointerEvents="none"`. On iOS that hands the touch through to the `Pressable`.
On Android `Host` is a Jetpack Compose view, and the touch stops there instead.
Every icon in the app sits inside a `Host` like this, so **assume the same bug
anywhere an icon is the visual target of a press** and check each one on device.

Note this also revises correction 1 below. The 44pt hit area is real, but on
Android roughly the middle 22pt of it is dead, which is exactly where anyone
aims.

While confirming it: `showConventionActions` in `(home)/index.tsx` passes **four**
buttons to `Alert.alert`, and Android's dialog only has three slots — Cancel is
silently dropped. Harmless, since tapping outside dismisses, but it means the
Android dialog is not what the code says it is.

---

## Goal 3: the Android theming overhaul

**Root cause, confirmed by reading `apps/native/src/global.css`: the theme tokens are Apple's system palette hardcoded as hex.**

- `--color-card: #f2f2f7` is iOS `systemGroupedBackground`
- `--color-secondary` / `muted` / `accent`: `#e5e5ea` is `systemGray5`
- `--color-border` / `input`: `#d1d1d6` is `systemGray4`
- Dark mode `#1c1c1e` / `#2c2c2e` / `#38383a` are the iOS dark grays

On iOS this looks right because it *is* the native palette. On Android those hexes are composited against **Material 3 tonal surfaces** that `@expo/ui` generates from `Host seedColor={colors.primary}` (`#00729c`). Two colour systems in one view produces five near-identical off-whites stacked — the "too many diff colors" the user is reacting to. The Settings screen and the convention form are the clearest examples.

**The user chose: give Android its own Material 3 tonal ramp**, so `@expo/ui` components and NativeWind-styled views finally agree. iOS keeps its Apple ramp untouched.

**Read this before starting:** `global.css` carries a long comment explaining why there is no `@media android` block. PR #34 removed one because it mapped onto M3 attributes (`colorOutline`, `colorSurfaceVariant`, …) that `Theme.AppCompat.DayNight.NoActionBar` does not define — `PlatformColor` resolved nothing and `RCTView` killed the process on the first bordered view, making the app unlaunchable from PR #20 until #34. **The naive fix is the one that already shipped a crash.** Two tests in `theme-contrast.test.ts` guard against re-adding it.

So the options are: hardcode an Android-appropriate hex ramp (safe, no theme change), or switch the Android theme to a real Material 3 parent so those attributes exist and `PlatformColor` works (more correct, riskier, needs a config plugin). Decide deliberately.

Also worth folding in, from the earlier audit (`docs/android-parity-audit.md`, still accurate except where this handoff corrects it):

- `ConventionFormFields.tsx:44` — iOS gets a SwiftUI form, Android gets NativeWind `View`s. Biggest single surface.
- `ConventionList` — iOS has a SwiftUI `List` with swipe actions; Android falls back to a `FlatList` of cards with no swipe.
- Material 3's Large Top App Bar is unused; `headerLargeTitleEnabled` is iOS-gated in 4 layouts.
- Nothing styles the Android navigation bar. `react-native-edge-to-edge` and `expo-navigation-bar` are both **not installed**, and SDK 57 dropped the `androidNavigationBar` config key, so this needs a dependency decision.

---

## Goal 4: loading states, both platforms

Requested by the user 2026-08-24, not yet started. Cold start on the Galaxy A15
spends roughly 40 seconds on a blank screen — first an unbranded white field,
then a bare spinner floating in the middle of an otherwise empty "Conventions"
screen with the tab bar already drawn. There is no skeleton, no branding and no
sense of progress, and the same bare-spinner pattern appears elsewhere in the
app. (Debug builds are slower than release, so measure a production build before
quoting that number to anyone, but the *shape* of the problem is the same.)

Wanted on both platforms: a splash that holds until the first meaningful paint,
and skeleton placeholders in place of centred spinners. Build it as **one shared
component** used by every list and detail surface, the same way `FormModalHeader`
replaced three hand-rolled header rows — the user has been explicit that they do
not want the same thing implemented several times over.

## Corrections to earlier notes — do not re-chase these

1. **The "18pt touch target" does not exist** — but see the ⋮ finding under goal 2. The 18×18 boxes are decorative icons inside a 44pt button, so the *hit area* was never 18pt. What is real is that on Android those icons swallow the touch instead of passing it through, which makes the centre of the button dead.
2. **Haptics was 9 call sites, not 18.** The old count included import lines.
3. **`Stack.Toolbar` does not render on Android.** See goal 2.
4. **The Android form sheet header was never "missing"** before this branch — it was a hand-rolled row that got clipped. And the prediction that it rendered *under the status bar* was wrong for sheets; it only applies to the full-screen modal, which is why `FORM_SAFE_EDGES` exists.

---

## Other open items

- **Nothing in CI runs the app.** Build, tests, types, CodeRabbit and GitGuardian all stayed green for the entire period Android could not launch. A smoke job that boots the app and asserts it survives first render would have caught it. Worth proposing.
- **German and Polish have never been seen on Android.** pt-BR has the widest tab bar, German the longest body copy (~1.40× English).
- **Watch out for stray branch switches — this is the single biggest time sink here.** It has now happened three times. Once it sent a 42-minute Gradle build at the wrong tree; twice more during device verification, when a concurrent session checked out `chore/deploy-without-brevo` and then `main`. Both times Metro happily hot-reloaded the *other* branch's bundle into the running app, so the screen showed real, working UI that simply was not the code under test — the guard "failed" because the code being tested did not contain it. Nothing is ever lost (reflog has it), but:
  - Run `git branch --show-current` **immediately before and after** every device check, and treat any screenshot straddling a switch as void.
  - A missing file (`ls apps/native/src/hooks/useUnsavedChangesGuard.ts`) is the fastest tell that the tree is wrong.
  - Metro caches per tree: after switching back, restart it with `--clear` or the stale bundle keeps serving.
- The Apple Watch target is untouched by all of this and is not installed on the watch sim.
