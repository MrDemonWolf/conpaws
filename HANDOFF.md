# ConPaws session handoff — 2026-08-28 (late night)

Continuation notes for the next Claude session. Read alongside CLAUDE.md.
Build 205 dev work; store builds are at 204 (both stores, Android hardware
test still pending).

## Committed and pushed this session (all on main)
- `6398cf5` native-feel UX pass (WS1–WS14: formSheet event sheet, swipes,
  unarchive, time-slot banding, notifications G-fixes, onboarding, settings,
  watch HIG pass, migration guards). 428 tests.
- `0bec9ed` widget redesign spec (docs/widget-redesign-2026-08.html) +
  Button press-dim. Spec decisions locked: NO emoji anywhere (SF Symbols /
  template vectors), ConPaws mark as monochrome template vector (HIG-safe
  logo compromise), full scope = 3 Home Screen + 3 Lock Screen accessory
  families + watch Smart Stack, snapshot schema v2 (ageRating pill on
  medium/large), convention selection = automatic default + per-widget
  AppIntent pin with fallback. Artifact:
  https://claude.ai/code/artifact/3e43e5ec-0829-45de-862c-862408916702
- `f32656d` 23-locale expansion + AAA contrast + UI System scroll fix.
  - Locales: es split es-419/es-ES, new pt-PT ja zh-TW zh-CN ko it ms da nb
    fi cs hu uk ru. Explicit device-locale resolution table in
    src/lib/i18n.ts; stored legacy "es" migrates to es-419. 453 tests.
  - AAA (user decision): light --color-primary #00729c -> #005575,
    --color-destructive #dc2626 -> #991b1b; same hex in theme-tokens.ts,
    nav theme (_layout.tsx), OnboardingButton.ios/.android seeds, onboarding
    icon tints. theme-contrast.test.ts bar raised 4.5 -> 7 both themes.
    Dark mode untouched (already AAA). Widget tokens deliberately keep their
    own palette (#00729C/#00618A/#18B7F2) per the spec's contrast flag.
  - UI System scroll: always-mounted @expo/ui BottomSheet sibling inside the
    Host blocked the Form; now mounts only while presented. VERIFIED.
- `92b68fe` Schedule tab frozen-clock fix: react-query structural sharing
  kept rows reference-stable so the `now` inside the grouping memo never
  refreshed — active events stayed hidden, finished ones stayed visible.
  `now` is focus-refreshed state now. VERIFIED live both directions.

## In flight RIGHT NOW — do not clobber
- **Widget Swift implementation agent** (background, launched ~10:15 PM):
  implementing the full spec — targets/widget/, targets/_shared/,
  targets/watch-widget/, modules/conpaws-widgets (schema v2 + ageRating),
  src/services widget-snapshot TS, AppIntent convention picker. Compile-only
  (xcodebuild to /tmp/conpaws-widget-build), no sim installs, no git. Its
  files are UNCOMMITTED until its report lands. SourceKit diagnostics about
  ConPawsStrings/ConPawsSnapshot etc. are its in-progress state, not
  regressions. When its report arrives: review, run bun run test + tsc,
  build + install to sims, verify each family, then commit.
- Parallel human sessions share this worktree: stage NAMED PATHS only,
  never `git add -A`; re-check HEAD before committing.

## Verified live this session (dev build 205, iPhone 17 Pro Max sim + watch sim)
Onboarding fresh-install E2E (priming Alert -> OS dialog -> Allow), real
reminder notification fired with correct copy, highlightEventId deep link
scrolls + tints the row, un-onboarded widget-link gate redirects to
onboarding, settings deep links (appearance/language/about/getting-started/
ui-system all conpaws-dev://settings/...), 23-language screen with flags,
dark + light banding/chips/sheet/forms, UI System scrolls, watch NOW card +
Today accent rail + rail moves as the active event changes.

## Known sim limitations (NOT app bugs — retest on hardware)
- Cover-sheet notification taps never register on this sim; foreground
  banner test collided with an HMR reload. Fire+copy+navigation each proven
  separately; the tap itself is a physical-iPhone checklist item.
- WatchConnectivity between paired sims is unreliable/laggy. Watch
  leave-window HERO state still unverified live because the watch kept a
  pre-"Leave" snapshot; the projection logic (nextLeaveDate window ->
  LEAVE IN hero card, title3 bold monospacedDigit accent) is in
  targets/watch/content.swift:161-186 with a DEBUG assert at :725.
  Data ready on phone: Notify Test Con has "Leave" 11:18 PM + 30-min
  reminder. Also unverified: "saved schedule / Updated N min ago" stale
  footer (needs >30 min with phone app dead; logic unit-tested).

## Open work queue
1. Widget agent report -> review/verify/commit (see In flight).
2. Watch leave hero + stale footer on hardware (or lucky sim sync).
3. Android smoke test of the whole UX pass (RNGH, formSheet, banding) — an
   emulator build has never been run on this work.
4. Native-locale review pass: agent flagged con-terminology judgment calls
   (展会/展會/컨벤션/konvent/con) for native-speaker review.
5. es.json deleted — any stored "es" language choice migrates via
   LEGACY_STORED_ALIASES in i18n.ts. Watch for edge reports.
6. User ops (unchanged): physical Android 204 test + tab-root header tap,
   Play Data safety + IARC + draft listing, BACK UP
   ~/.keystores/conpaws-upload.jks + password to 1Password (irreplaceable),
   widget+watch on real hardware.

## Environment notes for the next session
- Metro for dev build runs as a background task; dev client relaunch URL:
  conpaws-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081
- iPhone sim 5AD583FE-BE61-49E6-A6CE-8C0C3513B8A2, watch sim
  05E248AB-4CD3-40AA-A0C4-6AFD2177DC2B. Sim taps are POINTS (440x956 on the
  phone, 208x248-ish on the watch) — screenshots are 2x pixels.
- Dev-tools floating gear overlaps the Save button top-right; it was dragged
  to bottom-right this session. If taps on Save open the dev menu, move it.
- `bun run test` (never bare `bun test`). apps/native tsc may show errors in
  targets/modules/services while the widget agent is mid-flight.
- Test data on sim: "Notify Test Con" (today) with Tap Target 9:40 PM,
  Banner 10:42 PM (0-min reminder), Leave 11:18 PM (30-min reminder).
