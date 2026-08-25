# Android parity audit

**Date:** 2026-08-24
**Scope:** `apps/native` at `main` `09b6172`, excluding tests and the gitignored generated `ios/` and `android/` trees. Partly verified on a Pixel 10a emulator running Android 16 — see [Verification status](#verification-status) for exactly which findings were seen on screen.
**Reference standards:** Apple Human Interface Guidelines and Material Design 3 only. Web usability standards (NN/g, WCAG focus order, CSS breakpoints) are explicitly out of scope for this audit.

---

## Summary

The app is built iOS-first. Every runtime platform branch reads "if iOS, do the native thing; otherwise fall through" — there is not one branch that asks for Android.

| Measure | iOS | Android |
|---|---|---|
| Runtime platform branches gating UI | 11 navigation/layout + 5 input-idiom | 0 |
| Files importing native UI | 8 (`@expo/ui/swift-ui`) | 1 (`@expo/ui/jetpack-compose`) |
| Haptics calls using platform-semantic API | 9 (iOS vocabulary) | 0 |
| Screens reading safe-area insets directly | 0 | 0 |

The single Compose file is `src/components/OnboardingButton.android.tsx`.

Android is **usable** — this audit found no dead ends and no unreachable actions. The problems are that Android silently destroys user input on back, renders three headers under the status bar, hides list content under the system navigation bar, and substitutes hand-rolled `View`s for Material 3 components.

### Three corrections to earlier evidence

Prior audit notes carried three claims that this pass disproved. They are recorded here so they are not chased again.

1. **The "18pt touch target" is a false positive.** The only 18×18 boxes are `convention/[id].tsx:167` and `:191` — `<Host>` wrappers around decorative icons, both `pointerEvents="none"`, both sitting inside a `Button size="sm"` whose `min-h-[44px]` is the real target (`src/components/ui/Button.tsx:90`). No interactive element in the app measures 18pt.
2. **Haptics is 9 call sites, not 18.** The higher number counted `import` lines and multi-line statements.
3. **The `Stack.Toolbar` else-branches are not empty.** All three render a real hand-rolled header row with working Cancel and Save. The gap is qualitative — a `View` standing in for a Top App Bar — not a missing affordance.

---

## P0 — Android destroys user input or renders chrome off-screen

### P0-1. Four form surfaces discard user input on back, with no confirmation

Grep for `BackHandler`, `usePreventRemove`, `beforeRemove`, `navigation.addListener` across `apps/native` returns **zero hits**. Nothing guards navigation away from a dirty form.

| Surface | Dirty state held | Exit path |
|---|---|---|
| `app/(tabs)/(home)/convention/create.tsx` | name, location, start, end, timezone | `router.back()` at `:170` (iOS) / `:191` (Android), unconditional |
| `app/(tabs)/(home)/convention/[id]/edit.tsx` | same, plus a computed `unchanged` flag | `router.back()`, unconditional |
| `app/(tabs)/(home)/convention/[id]/import.tsx` | parsed preview, per-event and per-category selections, URL, timezone | `closeImport` at `:658`, unconditional |
| `ManualEventModal`, `convention/[id].tsx:651-903` | title, times, room | `onRequestClose` at `:748`, no dirty check |

`edit.tsx` is the sharpest case. It already computes dirty state — `const unchanged = original ? isConventionUnchanged(values, original) : true` at `:119` — and uses it only to enable the Save button (`:179`, `:224`). It is never consulted on the exit path. The app knows the form is dirty and discards it anyway.

Material 3 expects a confirmation dialog, or an undo affordance in a snackbar, when back would discard user input. iOS has the same expectation under HIG, but on iOS the sheet gesture makes accidental dismissal less likely; on Android an edge swipe is the primary navigation gesture, so this fires far more often.

**Affects both platforms; materially worse on Android.**

### P0-2. Predictive back is switched off, on an app targeting SDK 36

`app.config.ts` does not mention `android:enableOnBackInvokedCallback`, so the Expo prebuild default applies, and the default is `false`:

- `apps/native/android/app/src/main/AndroidManifest.xml:16` — `<application … android:enableOnBackInvokedCallback="false">`
- merged manifest — `android:targetSdkVersion="36"`

With targetSdk 36 and the flag `false`, the app opts out of predictive back entirely: no back-gesture preview animation, no cross-activity affordance, legacy `onBackPressed` dispatch only. Android users get none of the system's back-preview behaviour that every other app on the device now has.

There is no `expo-build-properties` plugin in the `plugins` array (`app.config.ts:105-137`), so there is currently no project-controlled way to raise it. `apps/native/android/` is gitignored (`.gitignore:11`), so the `false` is regenerated from Expo defaults on every prebuild.

One genuine back interception does exist, via `Modal.onRequestClose`: `convention/[id].tsx:748` passes `saving ? undefined : onClose`. React Native requires `onRequestClose` on Android, so during the save window back has no handler at all.

### P0-3. The form sheet's Cancel and Add buttons get clipped away

**Verified on a Pixel 10a emulator, Android 16, debug build from `main`. Screenshots in the session scratchpad.**

An earlier draft of this audit predicted that these headers would render under the status bar, reasoning from `SafeView edges={["bottom"]}` at `create.tsx:166`, `edit.tsx:237` and `import.tsx:722` excluding the top inset. **That prediction was wrong and has been withdrawn.** On Android, `presentation: "formSheet"` renders as a partial-height sheet starting around 40% down the screen, so there is no status bar to collide with and the `["bottom"]`-only edge list is correct.

The real defect is worse. On first open the hand-rolled header row renders correctly — `Cancel`, centred `New Convention`, and a filled `Add` pill. **After a text field takes focus the sheet re-lays-out and the header row is clipped by the sheet's own top edge.** Only the title survives; `Cancel` is reduced to a sliver of blue text and `Add` to a corner of its pill. Both remain nominally on screen and so are not "missing", but neither is legible or reliably tappable.

That leaves the Android user of a dirty form with no visible way to commit it and no visible way to abandon it — which is what makes P0-1 and P0-2 below matter so much more on Android than on iOS.

The hand-rolled rows are at `convention/create.tsx:185-211`, `convention/[id]/edit.tsx:256-282`, and `convention/[id]/import.tsx:730-742`; they exist because `app/(tabs)/(home)/_layout.tsx` sets `headerShown: process.env.EXPO_OS === "ios"` on all three `formSheet` routes (`:36`, `:48`, `:60`).

### P0-3b. The modal sheet does not cover the tab bar, and content is clipped behind it

Also verified on the emulator. The Material 3 navigation bar stays drawn on top of the form sheet and remains interactive. The sheet's own content runs underneath it — the `Advanced` disclosure row is visibly sliced in half by the tab bar.

A modal surface covering the tab bar is expected on both platforms; content silently disappearing behind it is a defect. This is the same root cause as the P1 inset findings below, but on a modal rather than a scroll view.

Confirmed at the same time: the Android sheet has **no drag handle**. `sheetGrabberVisible: true` (`_layout.tsx:38`, `:50`, `:62`) is a `UISheetPresentationController` property and does nothing here, so the sheet reads as a Material 3 bottom sheet with its handle missing.

### P0-4. Edge-to-edge is enforced but the navigation bar is never styled

`android/gradle.properties` carries `edgeToEdgeEnabled=true`, and targetSdk 36 makes it mandatory regardless.

`react-native-edge-to-edge` is **not installed** — absent from `apps/native/package.json` and from `node_modules`. `expo-navigation-bar` is likewise absent. `SystemBars` has zero hits.

The only system-bar code in the app is `app/_layout.tsx:150-152`:

```tsx
<StatusBar barStyle={colorScheme === "dark" ? "light-content" : "dark-content"} />
```

That is React Native's `StatusBar`, and it sets `barStyle` only. There is no navigation-bar counterpart anywhere. `ThemeProvider` flips the app between `darkNavigationTheme` and `lightNavigationTheme`, but the system navigation bar icons are never adapted, so in one of the two themes they sit at low contrast against app content.

`useSafeAreaInsets` has **zero hits across the entire app**. No screen reads insets directly.

---

## P1 — Content sits under the system navigation bar

Three inset strategies coexist, and one of them does nothing on Android:

- **`SafeView`** (`src/components/ui/SafeView.tsx`) — 11 instances, the only real abstraction.
- **`contentInsetAdjustmentBehavior="automatic"`** — 9 instances. **This is an iOS-only API with no Android effect.** Several screens rely on it as their sole inset handling.
- **Nothing at all** — every `@expo/ui` `Host`-rooted settings screen.

Ranked by exposure:

| # | Location | Bottom protection | Consequence on Android |
|---|---|---|---|
| 1 | `app/(tabs)/schedule/index.tsx:144-147` | `contentContainerStyle` applied **only when the list is empty** | Populated schedule — the normal case — gets no bottom padding at all. Last event of the last day renders under the M3 tab bar and the gesture bar. |
| 2 | `app/(tabs)/(home)/convention/[id].tsx:1505-1512` | same empty-only pattern | Last event of a populated convention renders under the system bar. |
| 3 | `app/(tabs)/(home)/index.tsx:251-261` and `src/components/ConventionList.tsx:45-51` | hardcoded `paddingBottom: 24` + iOS-only inset behaviour | 24dp is less than a 48dp 3-button navigation bar. Last convention row is clipped. |
| 4 | `app/(tabs)/settings/*.tsx` — `index`, `about`, `appearance`, `language`, `technology`, `ui-system`, `debug` | none | `@expo/ui` `Host` at `flex: 1` with zero inset handling. The Developer section (`settings/index.tsx:180`) is the bottom-most content. |
| 5 | `convention/[id]/import.tsx:892-900` | none on the button itself | The **primary Import call-to-action** is the last section of a long scrolling form, not sticky and not inset-aware. |
| 6 | `convention/[id].tsx:314-349` | fixed `paddingBottom: 32` | Bottom-anchored action sheet with no bottom inset and no `navigationBarTranslucent`. Its action rows draw flush to the screen edge. |
| 7 | `convention/[id].tsx:744-748`, `ConventionFormFields.tsx:115-121` | `SafeView` default edges | `presentationStyle="pageSheet"` is iOS-only, so these are full-screen on Android; both lack `statusBarTranslucent` / `navigationBarTranslucent`, which RN needs for a `Modal` to participate in edge-to-edge. |

`app/(tabs)/_layout.tsx` compounds items 1, 3 and 4: `NativeTabs` renders a Material 3 navigation bar on Android, and no tab screen pads for it. The bottom of every tab screen has two stacked obscuring surfaces against at most 24dp of hardcoded padding.

---

## P2 — Material 3 components substituted with hand-rolled views

### P2-1. `ConventionFormFields.tsx:44` — the largest single surface

```tsx
if (process.env.EXPO_OS === "ios") return (<SwiftUI form>)
```

iOS gets a SwiftUI `Form` with a compact `SwiftDatePicker`. Android gets NativeWind-styled `View`s. Forms are where native feel is most legible, and this is the most-used form in the app.

The date/time branch itself is fine — `ConventionFormFields.tsx:44` and `convention/[id].tsx:587` give Android a `Pressable` row opening `DateTimePicker presentation="dialog"`, which is the correct Material 3 modal date/time picker. **That part is not a gap.**

### P2-2. `ConventionList` — no Material list, no swipe

`src/components/ConventionList.ios.tsx` (7.5 KB) is a SwiftUI `List` with `SwipeActions`. There is no `.android.tsx`; Android resolves to `ConventionList.tsx` (3.5 KB), a `FlatList` of styled cards. Android has no swipe-to-action on conventions at all.

### P2-3. Hand-rolled headers instead of a Top App Bar

The three fallback rows described in P0-3 are `<View className="flex-row items-center px-3 py-2">` with an `@expo/ui` text Button, a `Text variant="h3"`, and a filled Button. Against Material 3 they diverge in four ways:

- **No `accessibilityRole="header"`** on the title (`create.tsx:196`, `edit.tsx:267`, `import.tsx:740`). TalkBack announces it as body text and heading navigation skips it.
- **No elevation-on-scroll and no divider** — Material 3 Top App Bars change surface tint when content scrolls beneath them.
- **iOS Cancel/Done semantics transplanted.** Material 3 uses a leading close icon and a trailing action, not a leading text "Cancel".
- **Duplicated title source.** `_layout.tsx:34`, `:46`, `:58` set a `title` that is dead on Android; each screen re-declares the same string literally.

The app already contains the correct pattern internally: `ManualEventModal`'s header at `convention/[id].tsx:744-776` sets `accessibilityRole="header"` (`:761`), explicit `min-h-11 min-w-11` targets (`:757`, `:770`), `accessibilityLabel` on both buttons, and `border-b border-border`. The three fallback rows diverge from a reference that already exists in the codebase.

Correct Material 3 counterparts: **Top App Bar (small)** in its full-screen-dialog configuration for create and edit; **Top App Bar (center-aligned)** for import, which already centres its title.

### P2-4. `headerLargeTitleEnabled` — Material 3's Large Top App Bar is unused

Four sites set `headerLargeTitleEnabled: process.env.EXPO_OS === "ios"`:

- `app/(tabs)/(home)/_layout.tsx:18`
- `app/(tabs)/schedule/_layout.tsx:13`
- `app/(tabs)/settings/_layout.tsx:19`
- `app/(tabs)/(home)/convention/[id].tsx:1317`

Setting it `false` on Android is *not* a bug — `headerShown` stays true, so Android gets a real header with a real title and a real back affordance. But Material 3 has a direct analogue to the iOS large title: the **Large Top App Bar** (and Medium) with collapse-on-scroll. The three top-level destinations get a small bar where Material 3 would use a large one.

### P2-5. `formSheet` detents and grabber are iOS-only

All three form routes set `sheetGrabberVisible` and `sheetAllowedDetents` (`_layout.tsx:37-40`, `:49-52`, `:61-65`). These are `UISheetPresentationController` properties. On Android `presentation: "formSheet"` degrades to a standard modal screen — no drag handle, no detents.

The Material 3 counterpart is a **Modal Bottom Sheet** with a drag handle, or a **Full-screen Dialog** with a Top App Bar if detents are not wanted.

### Not a gap — leave these alone

- **`Icon.select` and SF-Symbol-vs-Material-icon ternaries.** Roughly 45 sites across 10 files. This is the *correct* pattern and must not be "fixed".
- **`NativeTabs.Trigger.Icon sf=… md=…`** (`app/(tabs)/_layout.tsx:16, 24, 25, 35, 37`) — both platforms supplied declaratively.
- **`OnboardingButton`** — a complete `.ios.tsx` / `.android.tsx` / base trio.
- **`EmptyState.tsx:110, 148`** — the `Platform.OS === "ios"` branch is deliberate and documented; `@expo/ui` `Host matchContents` mis-measures on Android.
- **`notifications.ts:13`** — `Platform.OS !== "android"` guard around an Android-only channel API.
- **Date and time pickers** — already correct on both platforms (see P2-1).

---

## P3 — Haptics use the iOS vocabulary on Android

Nine invocations across six files, every one a raw `Haptics.*` call at the point of use. **There is no shared wrapper, hook, or util** — no `haptics.ts`, no `useHaptics`, no `triggerHaptic`. Consequence: no single place to add an Android branch, a settings gate, or error handling.

| file:line | API | Trigger |
|---|---|---|
| `convention/[id].tsx:981` | `impactAsync(Medium)` | event added to / removed from schedule |
| `convention/[id].tsx:1025` | `notificationAsync(Success)` | manual event created |
| `convention/[id].tsx:1281` | `impactAsync(Light)` | event row tapped |
| `convention/[id].tsx:1285` | `impactAsync(Medium)` | event row long-pressed |
| `convention/[id]/import.tsx:572` | `notificationAsync(Success)` | import applied |
| `convention/[id]/edit.tsx:218` | `notificationAsync(Success)` | convention saved |
| `convention/create.tsx:155` | `notificationAsync(Success)` | convention created |
| `src/hooks/useEventReminder.ts:71` | `notificationAsync(Success)` | reminder scheduled |
| `src/services/data-export.ts:57` | `notificationAsync(Success)` | export shared |

### `performAndroidHapticsAsync` is never used

`expo-haptics` exposes `performAndroidHapticsAsync` with `AndroidHaptics.*` constants mapping 1:1 onto Android's `HapticFeedbackConstants` — the Material 3 haptics vocabulary (`Confirm`, `Reject`, `Toggle_On`, `Toggle_Off`, `Segment_Tick`, `Long_Press`, `Gesture_Start`, `Drag_Start`). Zero uses. Nothing branches on `EXPO_OS === "android"` for haptics, even though the same files branch on it heavily for UI.

On Android, `impactAsync` resolves to raw `Vibrator` / `VibrationEffect` amplitude patterns. It does not route through the OEM's haptic tuning and **does not respect the user's system "Touch feedback" setting**.

Three specific mismatches:

- **`:981`, schedule toggle → `impactAsync(Medium)`.** Android has `Toggle_On` / `Toggle_Off`, which are asymmetric by design. Both directions fire the identical Medium impact, so the haptic carries no directional information — even though the code reads `event.isInSchedule` three lines later (`:984-987`) to pick the right accessibility announcement.
- **`:1281`, plain row tap → `impactAsync(Light)`.** Material 3 does not specify haptic feedback for an ordinary list-item press; Android drives that through the ripple. This is an iOS idiom firing on every event-row tap.
- **`:1285`, long-press → `impactAsync(Medium)`.** Android has an exact constant, `LONG_PRESS`, which is system-tuned. Note also that `:1281` and `:1285` invoke the *same* `setActionSheetEvent(event)`, so two different haptic intensities signal a distinction that does not exist.

### `selectionAsync` is never used

No tick feedback on the appearance picker, language picker, timezone picker, sort menu, or import category switches.

### Other haptics findings

- **No settings toggle.** Grepping `haptic` across `app/(tabs)/settings/` returns zero hits. All nine calls fire unconditionally.
- **Inconsistent error handling.** `import.tsx:572` guards with `.catch()`. `data-export.ts:57` and `useEventReminder.ts:71` are unguarded `await`s whose rejection propagates into the mutation error path. `convention/[id].tsx:981`, `:1281`, `:1285` are **floating promises** — a rejection there is unhandled.
- **`VIBRATE` is not declared in `app.config.ts`.** The `android.permissions` array (`:96`) contains only `SCHEDULE_EXACT_ALARM`. The permission does reach the built manifest via `expo-haptics` autolinking, so it works — but the checked-in config, which is the only source of truth under CNG, does not state it. The same generated manifest also pulls in `SYSTEM_ALERT_WINDOW`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, legacy storage permissions, and a block of OEM badge permissions, none of them declared.

---

## P4 — Touch targets

HIG minimum is 44×44 pt. Material 3 minimum is 48×48 dp.

### Below 44 — fails both

| file:line | Control | Measurement |
|---|---|---|
| `src/components/ConventionFormFields.tsx:124` | "Done" dismiss, timezone picker header | `className="active:opacity-70"` with **no padding**. Child is `Text variant="body"` → 16px font, 24px line box. Effective **~24 × ~38**. Width is locale-dependent and not statically determinable. Primary path: create/edit convention → Advanced → Time zone. |
| `convention/[id].tsx:844` | "Include end time" switch, Add Event modal | Bare RN `Switch` (`src/components/ui/Switch.tsx:13`), no size props. Intrinsic ≈ **52 × 32** on Android. The parent row's `min-h-14` pads the row, not the switch. Fails on height. |
| `convention/[id].tsx:593` | iOS compact `DateTimePicker` | Width set via `pickerWidth` (`:583`); **height never set**, native intrinsic. Cannot be resolved from source. iOS-only branch. |

### Between 44 and 48 — passes HIG, fails Material 3

The highest-leverage item is the shared primitive:

- **`src/components/ui/Button.tsx:90`** — `min-h-[44px]`. Every non-native button in the app inherits this. `size="md"` computes to exactly 44; `size="sm"` computes to 32 and is floored to 44. `size="lg"` reaches 56 and passes both.
- **`src/components/OnboardingButton.android.tsx:34`** — `defaultMinSize({ minHeight: 44 })`. This file *is* what Android resolves to, on the first-run path. A real Android violation.
- `convention/[id].tsx:757`, `:770` — Add Event modal Cancel and Save, `min-h-11 min-w-11`.
- `convention/[id].tsx:1243` — "Go back" on convention-not-found; 44 high, width intrinsic with no `min-w`.
- `app/(tabs)/settings/debug.tsx` — 8 buttons at `height: 44`, behind the `showDeveloperTools` gate.

**The only `hitSlop` in the entire codebase** is `src/components/ConventionCard.tsx:96` (`hitSlop={4}`). Every other target relies on layout alone.

### Not statically determinable

`@expo/ui` `ListItem` rows, `Stack.Toolbar` buttons and menus, `NativeTabs.Trigger`, `Stack.SearchBar`, `SwipeActions` buttons, `SwiftDatePicker`, and OS `Alert.alert` buttons are all sized by the platform. They are almost certainly compliant, and are listed here only so they are not re-investigated.

---

## Suggested sequencing

Grouped so each block is one coherent change, ordered by user-visible harm per unit of work.

1. **Insets and edge-to-edge** (P0-3, P0-4, P1). Add top edges to the three form screens, give the two empty-only `contentContainerStyle` lists real bottom padding, and add navigation-bar styling. Mostly small, entirely mechanical, and fixes the most visible damage.
2. **Unsaved-changes guards** (P0-1). `edit.tsx` already computes the dirty flag; the other three need one. One shared hook covers all four surfaces.
3. **Predictive back** (P0-2). Add `expo-build-properties` and raise `enableOnBackInvokedCallback`. Depends on item 2 — enabling predictive back while back is silently destructive makes the destruction easier to trigger.
4. **Material 3 Top App Bars** (P2-3). Replace the three hand-rolled rows. `ManualEventModal`'s header is the in-repo reference.
5. **Haptics** (P3). Introduce a shared wrapper first, then branch it to `performAndroidHapticsAsync`, then add the settings toggle. The wrapper is the prerequisite for the other two.
6. **Touch targets** (P4). Raise `Button.tsx:90` to 48, fix the timezone "Done" button, raise `OnboardingButton.android.tsx`.
7. **Native Android components** (P2-1, P2-2). Compose form fields and a Material list with swipe. The largest effort by a wide margin, and the least broken today — Android users can already do everything, it just does not feel like Android.

---

## Verification status

Part of this audit was checked on a Pixel 10a emulator running Android 16, with a debug build of `main` `09b6172`. The rest is source-level only. Which is which:

**Confirmed on the emulator**

- Edge-to-edge is active — the status bar and the gesture pill both draw over app content.
- The form sheet's `Cancel` and `Add` are clipped after a field takes focus (P0-3).
- The Material 3 navigation bar stays on top of the modal sheet, and the sheet's `Advanced` row is sliced in half behind it (P0-3b).
- The Android sheet has no drag handle.
- `NativeTabs` renders a correct Material 3 navigation bar with the pill indicator. This part of the app is genuinely native on Android.
- The empty state, the Create Convention flow, and the form fields all render and function.

**Source-level only, not yet seen on a device**

- P0-1, the dirty-form discard. The code evidence is conclusive on its own — `BackHandler`, `usePreventRemove`, `beforeRemove` and `navigation.addListener` have zero hits across `apps/native`, so there is nothing that *could* guard the exit path. A device run would only confirm what the absence already establishes.
- P0-2, predictive back. Read from the generated manifest.
- Every P1 inset finding below the fold, P2, P3, and P4.

**A note on the ANRs seen during testing.** The emulator produced several `Application Not Responding` reports while these screens were driven, including one reading `Waited 15105ms for KeyEvent` on a back press. **These are not being reported as app defects.** The host was under a load average of 24–36 from unrelated work, the system keyboard ANR'd at the same time having waited 96 seconds, and a later ANR reported `failed to complete startup` — the app never reached first render. The environment, not the app, is the likeliest cause. If back genuinely hangs on a dirty form that is a serious bug, but this run cannot tell you either way, and a re-test on a quiet machine is needed before anyone acts on it.

## Gaps in this audit

- **The dirty-form back behaviour was never observed end-to-end.** See above.
- **German and Polish have never been seen on Android.** pt-BR has the widest tab bar; German runs about 1.40× English in body copy.
- **Nothing in CI runs the app.** Build, tests, types, CodeRabbit and GitGuardian all stayed green throughout the period when the Android app could not launch at all (fixed in #34). A smoke job that boots the app and asserts it survives first render would have caught it.
- Onboarding content is covered by a separate handoff — three static screens that tell rather than do, plus notification-permission priming. Not duplicated here.
