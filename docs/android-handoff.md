# Handoff: Android UI work on ConPaws

**Created:** 2026-08-24
**Branch:** `fix/android-parity` (2 commits, not pushed, no PR yet)
**Next goals, in order:** (1) land the current branch, (2) fix `Stack.Toolbar` on Android, (3) the Android theming overhaul.

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
- **The phone's screen timeout is 30s** and black screenshots are almost always just a dozing screen, not a broken app. Check `adb shell dumpsys display | grep mScreenState`. Raising the timeout needs the user's OK (it's their org-managed phone); restore it to `30000` afterwards.
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
| Unsaved-changes guard, Cancel button | **yes** | not yet |
| Unsaved-changes guard, back/swipe dismiss | **yes** | not yet |
| Predictive back registers | n/a | **yes (logcat)** |
| Haptics toggle renders | **yes** | not yet |

Remaining before merge: exercise the discard guard and the haptics toggle on the Android device, then push and open the PR. Nothing is pushed yet — deliberately, because this session already watched fully green CI hide a completely dead Android app.

---

## Goal 2: `Stack.Toolbar` does not work on Android — bigger than it looks

**Confirmed on the physical device.** `app/(tabs)/(home)/convention/[id].tsx` renders `Stack.Toolbar placement="right"` **ungated**, holding Edit plus two menus (Add event, Import schedule, Filter). On Android the header shows **only the back arrow and title**. None of those actions render.

So on Android today, a user with a populated convention **cannot reach Edit, Add event, Import schedule, or Filter at all.** The empty state has its own buttons, which is why this went unnoticed.

An earlier audit claimed Android renders these into the Material toolbar. That was inferred from reading `expo-router/build/layouts/stack-utils/toolbar/processHeaderItemsForPlatform.android.js` (which does return `headerShown: true` plus `headerLeft`/`headerRight`) and **never observed**. Trust the device.

Affected, all currently invisible on Android: `convention/[id].tsx` (Edit + 2 menus), `(home)/index.tsx` (Sort and Add menus — though the `+` does render, so verify each individually).

The likely fix is `headerLeft`/`headerRight` render props on Android instead of `Stack.Toolbar`, mirroring what `FormModalHeader` does for the form screens. Verify on device before believing any of it.

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

## Corrections to earlier notes — do not re-chase these

1. **The "18pt touch target" does not exist.** The only 18×18 boxes are decorative icons with `pointerEvents="none"` inside a 44pt button.
2. **Haptics was 9 call sites, not 18.** The old count included import lines.
3. **`Stack.Toolbar` does not render on Android.** See goal 2.
4. **The Android form sheet header was never "missing"** before this branch — it was a hand-rolled row that got clipped. And the prediction that it rendered *under the status bar* was wrong for sheets; it only applies to the full-screen modal, which is why `FORM_SAFE_EDGES` exists.

---

## Other open items

- **Nothing in CI runs the app.** Build, tests, types, CodeRabbit and GitGuardian all stayed green for the entire period Android could not launch. A smoke job that boots the app and asserts it survives first render would have caught it. Worth proposing.
- **German and Polish have never been seen on Android.** pt-BR has the widest tab bar, German the longest body copy (~1.40× English).
- **Watch out for stray branch switches.** Mid-session something checked out `main` while work was in progress on `fix/android-parity`, and a 42-minute Gradle build compiled the wrong tree. Nothing was lost (reflog had it), but confirm `git branch --show-current` before long builds.
- The Apple Watch target is untouched by all of this and is not installed on the watch sim.
