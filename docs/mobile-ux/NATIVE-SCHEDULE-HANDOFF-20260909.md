# ConPaws native schedule completion handoff

**Created:** September 9, 2026, UTC
**Status:** Source implementation is complete on the server feature branch and ready for native device testing. It has not been merged, pushed, deployed, published, or released.

## Where the work lives

- Repository: `/home/nathanialhenniges/Developer/mrdemonwolf/conpaws`
- Worktree: `/tmp/conpaws-native-schedule-ux`
- Branch: `codex/native-schedule-ux`
- Current `origin/main` used by the branch: `49dc7cd fix(native): My Schedule never marked a clash`
- Main implementation commit: `23a4107 feat(native): add personal schedule planning`
- Completion commit: `91276ec feat(native): finish schedule companion surfaces`

The branch is two commits ahead of current `origin/main`. A fresh `git fetch origin` on September 9 reported no commits to bring in from `origin/main`.

## What is implemented

### Shared persistent plan

- SQLite schema version 9 adds independent `is_interested`, `personal_start_time`, and `personal_end_time` fields through the existing numbered migration ladder.
- Existing `isInSchedule` behavior remains planned attendance. Interested is independent and does not create reminders.
- Personal join and leave values are nullable independently. Published event start/end values are never rewritten.
- Import, refresh, backup/restore, saved removal notices, and organizer-change review preserve the personal plan.
- Invalid personal attendance after an organizer time change falls back to published timing for active selection and is marked for review instead of being silently rewritten.
- Conflict checks use half-open personal intervals, so exact back-to-back choices do not overlap. Cross-midnight comparisons use full timestamps.

### Phone schedule flow

- Existing Expo Router tabs, convention navigation, native search, menus, sheets, virtualized lists, rows, and semantic theme tokens remain in use.
- Schedule browsing supports day, time, scoped search, category filters, and dense concurrent choices without hiding alternatives.
- Search covers the source fields the app actually has: title, description, category, type, room, and location. Presenter names embedded in imported descriptions are searchable; no unsupported host column was invented.
- Event actions distinguish Interested from Going/My Plan.
- The attendance editor supports start-only, end-only, full, and cleared personal timing, with known-end bounds and honest unknown-end behavior.
- Unknown event ends no longer fabricate a one-hour leave choice. A leave time exists only when the person explicitly chooses one.
- All affected planned choices are checked for conflicts. Intentional overlaps can be saved with a visible warning on the phone.
- Now & Next uses personal join/leave intervals, keeps late joins visible, keeps a final current panel visible when no later panel exists, and separates current, next, break, and finished states.
- Cancelled and removed saved entries remain visible for review but do not participate in active/next/conflict projections.

### Reminders and schedule changes

- Existing start reminders now say starts or join as appropriate; they no longer imply an invented departure time.
- An explicit personal leave time creates one deterministic leave reminder. Interests remain quiet.
- Changing/removing a plan, importing, refreshing, or editing attendance reconciles start and leave requests without duplicates.
- Event removal cancels both the start and leave notification IDs. Turning off only a start reminder leaves an independently chosen leave alert intact.
- Trusted automatic refreshes can deliver room-change and organizer-cancellation notices for planned events when notification permission is already granted. Refresh does not prompt for permission.
- Notification taps for event-start, personal-leave, room-change, and cancellation notices route to the correct convention/event.
- Overlap notifications are not sent automatically because the app has no user opt-in for them. Overlaps remain visible in the plan UI.

### Shared snapshot and selection rules

- Snapshot schema version 3 carries published times, personal attendance times, and review state.
- Older native consumers receive the compatible schema they support; unsupported future schemas clear stale shared data rather than freezing an old plan.
- WidgetKit, Watch, complications, Android Glance, notifications, and Activity payloads all consume the same persisted plan snapshot and personal timestamps.
- Platform-native shared timeline helpers prioritize current over next/blank, use strict end boundaries, retain late joins, and retain the final active panel.
- Missing or unreadable snapshot data uses an Open ConPaws recovery path rather than claiming that the user deleted a convention or plan.

### iOS widgets, Watch, and Live Activity

- iOS widgets have small, medium, and large layouts with upcoming, current/leave, next, empty/unavailable, and finished presentations.
- The large widget shows useful upcoming stops and numeric same-day gaps rather than stretching one countdown.
- Apple Watch uses a shallow native vertical flow for Now & Next, Today, details, stale age, and empty/upcoming/finished states.
- Watch complications now support circular, inline, and rectangular families. The circular leave countdown uses a system-managed timer instead of a frozen entry-time number.
- The Watch `+5 min` action is a real reachable-phone edit, not a fake local success. The phone validates the request, checks the stored expected value, rejects any new overlap with every other active planned event, writes SQLite, reconciles reminders, publishes the shared snapshot, then acknowledges success.
- Unreachable, timed-out, stale, conflicting, invalid, failed-readback, or failed-snapshot edits remain visibly unsaved on Watch. There is no offline queue claim.
- ActivityKit includes upcoming, current, chosen-leave, and finished presentations for Lock Screen and Dynamic Island, with system timers and one native stale boundary.

### Android widgets and plan notification

- The native Jetpack Glance widget uses responsive compact, wide, and tall sizes with current/next, upcoming convention, empty/unavailable, and finished states.
- Android uses an ordinary low-priority ongoing notification for an explicitly tracked plan. It is not marked as a promoted Live Update.
- The notification uses the same schema-v3 snapshot, distinguishes starts/join/leave, shows current and next context, has a private lock-screen version, deep links to the plan/event, and provides Open plan and Stop updates actions.
- Notification permission is requested through the existing service only after the person taps Show Plan Updates. An undecided/disabled permission state leaves that button actionable; unsupported builds remain read-only.
- No foreground service and no continuous background JavaScript countdown were added.

### Debug/test menu

The existing development/preview-only Settings > Debug screen now includes:

- `Preview Widget & Watch`: publishes a now-relative current stop, a leave cue seven minutes away, and a late-join next stop without changing the phone's saved plan.
- `Preview Live Activity` on iOS or `Preview Ongoing Notification` on Android.
- `Stop Plan Surface`.
- Existing preview convention actions for My Plan, Interested, Now & Next, empty, loading, and error states remain available.

## Server verification completed

These checks were run from `/tmp/conpaws-native-schedule-ux` after the final source edits:

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Passed; 1,549 installs checked with no lockfile changes |
| `bun run --filter @conpaws/native check-types` | Passed |
| Focused native integration suite | 140/140 tests passed across personal timing, schedule view, imports, reminders, refresh, snapshots, Live Activity payloads, Watch edits, and locale parity |
| Complete locale suite | 95/95 tests passed, including key parity, placeholders, scripts, Swift parity, Intl data, and supported locales |
| `bun run lint` | Passed with 54 existing warnings and no errors |
| `bun docs/mobile-ux/app.test.ts` | Passed |
| `bun docs/mobile-ux/watch.ts` | Passed |
| Expo module autolinking, Android | Passed; resolved `conpaws-widgets` and `ConPawsWidgetsModule` |
| Expo module autolinking, iOS | Passed; resolved `ConPawsWidgets` pod/module |
| `git diff --check` | Passed |

### Known full-suite baseline failure

`bun run --filter @conpaws/native test` finished with **733 passed and 1 failed**. The sole failure is the pre-existing Linux/Intl expectation in `src/lib/time-zone-search.test.ts`: this runtime returns `UTC · GMT+0`, while the test expects `UTC`.

The implementation does not modify `time-zone-search.ts` or its test. The same environment-specific failure was present before this completion pass, so it was left out of scope rather than disguised as a feature fix.

## What the Linux server cannot prove

This server has no macOS/Xcode/Swift compiler and no JDK, Android SDK, Gradle CLI, or ADB. The following are pending, not passed:

- iOS app compilation/linking and strict Swift concurrency diagnostics.
- WidgetKit installation, timeline refresh timing, system margins, tinted rendering, and deep links.
- ActivityKit permission, Lock Screen, Dynamic Island, background/suspended behavior, and dismissal.
- Paired iPhone/Apple Watch WCSession reachability, reply timeout, snapshot delivery ordering, complications, Always On, haptics, and Watch edit UI timing.
- Android Gradle compilation, manifest merge, runtime notification channel/permission behavior, Glance launcher sizing, and PendingIntent deep links.
- Real notification delivery, schedule-change refresh timing, and OS pending-notification limits.
- VoiceOver, TalkBack, Dynamic Type/font scaling, reduced motion/transparency, safe areas, keyboard behavior, and 44-point target verification on devices.

## Important native lifecycle limits

### ActivityKit

ActivityKit can attach one `staleDate` to a content update. This implementation uses it for the next truthful boundary:

- upcoming -> current at the personal join time, or
- current/leave -> finished at the personal end time.

With `pushType: nil` and no new server push workflow, an Activity started while upcoming cannot autonomously perform both later transitions while the app remains suspended. A later foreground refresh can provide the next boundary. A stale visual finished state also does not itself call `Activity.end`; explicit stop or foreground lifecycle reconciliation ends it.

Do not report a fully autonomous multi-boundary lifecycle until a real ActivityKit push or supported native background update path is designed, implemented, and tested.

### Watch edits

The `+5 min` edit intentionally requires an activated, reachable phone and a live native/JavaScript handler. It does not queue an offline promise. The Watch shows failure and leaves the displayed plan unsaved if the phone cannot acknowledge within eight seconds.

### Android ongoing notification

The notification refreshes when the shared snapshot is published and times out after its next known boundary so stale action text does not linger. Without an app wake, it does not invent later state transitions. This is deliberate: no foreground service or continuous background countdown was introduced for a convention agenda.

## Nathanial's native test steps

### 1. Open the completed worktree

```sh
cd /tmp/conpaws-native-schedule-ux
git status --short --branch
git log --oneline -3
bun install --frozen-lockfile
```

Expected branch: `codex/native-schedule-ux`. Do not use Expo Go for this test; the branch contains custom iOS, watchOS, WidgetKit, ActivityKit, Android Glance, and notification module code that requires a fresh native development build.

### 2. Build a development or preview native app

On a Mac with Xcode, generate/use the normal project workflow already used by ConPaws and build the iPhone, widget, Watch app, Watch complication, and Live Activity targets. Avoid `prebuild:clean` unless Nathanial explicitly decides to regenerate native projects.

On an Android development machine, use the existing native Android workflow and verify that the local Expo module is included before installing the app and widget.

### 3. Load deterministic phone states

In a development/preview build:

1. Open Settings > Debug.
2. Tap `Load Preview Cons`.
3. Exercise `Preview My Plan`, `Preview Interested`, and `Preview Now & Next`.
4. Open the schedule and test 6, 8, and 10 simultaneous choices at a busy time.
5. Search by title, description/presenter text, category, room, and location; apply and clear category/time filters.
6. Bookmark several alternatives. Confirm Interested never removes Going and never creates a reminder.
7. Set photography to 2:00-2:25 and character design to 2:35-3:20. Confirm both published ranges stay unchanged and the 10-minute gap is not labeled as a walking estimate.
8. Test partial overlap, exact back-to-back, cross-midnight, unknown-end, cancelled, removed, and organizer-changed events.
9. Confirm the final currently running pick remains visible with no later pick, and a late personal join remains visible after the published start.

### 4. Test reminders

1. Set an ordinary start reminder and confirm its copy says starts or join.
2. Set an explicit personal leave time and confirm one leave reminder is scheduled for that exact instant.
3. Remove the plan and confirm both start and leave requests are cancelled.
4. Turn off only the start reminder and confirm the personal leave request remains.
5. Refresh/import a changed source and verify planned room changes and organizer cancellations notify only with existing permission.
6. Tap each notification type and confirm ConPaws opens the correct convention/event.
7. Confirm an Interested-only event stays silent and an unresolved overlap does not send an unsolicited OS notification.

### 5. Test iOS widgets and Watch

1. In Settings > Debug, tap `Preview Widget & Watch`.
2. Add small, medium, and large widgets. Check current/leave, next, upcoming-convention, no-picks/unavailable, and finished states.
3. Verify large-widget rows and gaps are useful, the final active panel does not disappear, and tinted/larger text does not remove leave, join, room, or next action.
4. Pair/install the Watch app. Test Now & Next, Today, details, stale last-updated wording, and no-picks/upcoming/finished cases.
5. Add circular, inline, and rectangular complications and check each supported face/tint/Always On state.
6. With the phone reachable, use `+5 min` on a plan with a 10-minute gap. Confirm 2:25 becomes 2:30, the 2:35 join stays fixed, reminders reconcile, and the phone plan changes.
7. Repeat with a next join before 2:30. Confirm the Watch edit is rejected and no overlap is silently introduced.
8. Repeat with the phone unreachable or the app handler unavailable. Confirm Watch reports failure rather than saved/pending sync.

### 6. Test Live Activity and Android plan updates

iOS:

1. Tap `Preview Live Activity` in Settings > Debug.
2. Check Lock Screen plus minimal, compact, and expanded Dynamic Island states.
3. Test upcoming, current, leave-now, finished, next-event, and no-plan behavior around real clock boundaries.
4. Confirm personal times are distinguished from published times and explicit stop dismisses the Activity.

Android:

1. Add compact, wide, and tall Glance widgets on at least two launcher sizes.
2. Tap `Preview Ongoing Notification` or `Show Plan Updates` in a convention.
3. Grant notification permission from that action. Confirm undecided/disabled permission does not hide the action.
4. Verify current/next/leave copy, private Lock Screen content, Open plan/event deep links, Stop updates, and boundary timeout.
5. Confirm the notification is ordinary low priority and not promoted as a Live Update.

### 7. Accessibility and resilience

- Test largest practical Dynamic Type/font scale without clipping required titles, rooms, times, or actions.
- Verify VoiceOver/TalkBack order, labels, selected states, overlap warnings, and touch targets.
- Test reduced motion and reduced transparency.
- Test offline/stale snapshots: wording should show last-updated age or Open ConPaws, never an invented offline/sync-pending claim.
- Test a missing/unreadable snapshot and an upcoming convention with and without picks.
- Confirm past conventions remain reachable through Archive and load failures win over empty-state copy.

## Finish policy

This work is intentionally left on `codex/native-schedule-ux` for Nathanial to test. Do not merge, push, deploy, publish, release, or notify other people without a separate explicit instruction.
