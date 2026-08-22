# ConPaws widgets

Status: **shipped**. The iOS widget extension, the watchOS app, and the watchOS
complication all exist under `apps/native/targets/`, built with
`@bacons/apple-targets`. This file is the design record and the reference for
family behaviour, accessibility, and rendering modes — not a proposal.

Mockups: [widget-mockups.svg](./widget-mockups.svg) ·
Specimens at true point size: [widget-specimens.html](./widget-specimens.html)

## Product slice

- One read-only widget kind, `ConPawsWidget`, configurable per instance with a convention picker and a Display mode.
- iOS ships `systemSmall` and `systemMedium` on the Home Screen, and `accessoryCircular`, `accessoryRectangular`, and `accessoryInline` on the Lock Screen.
- watchOS ships `accessoryRectangular` only, as a separate target with its own kind.
- Before the reminder window, lead with **Next event** and the event's title, time, and location.
- At `leaveAt`, switch the primary status to **Leave in**. The medium family keeps event details and countdown in separate zones.
- The entire widget is one tap target that opens the next event. The blank widget opens the convention list; it has no button or open-app CTA.
- Show **No upcoming events** when there is no selected convention, no future event, or no shared snapshot.

Not in MVP: Android widgets, Live Activities, interactive controls, network access from the widget, or simultaneous-event presentation.

## Per-instance configuration

Use one `AppIntentConfiguration` widget kind named **Next Event**. Do not create separate widget kinds for the display options.

| Display option | Behavior |
| --- | --- |
| **Automatic** (recommended) | Uses all four states for the selected convention: pre-convention countdown, next event, leave-soon handoff, and empty fallback. |
| **Convention Countdown** | Prioritizes the adaptive convention countdown while the selected convention is in the future. At zero, use the existing transition to its next-event state. |
| **Next Event** | Skips the pre-convention countdown and shows next event, leave-soon handoff, or empty fallback for the selected convention. |

Every widget instance also stores a required **Convention** selection. Preselect the app's current convention when available, but save the user's choice per instance. Users can add multiple copies and assign a different convention and display option to each copy; changing one instance does not change the others.

Platform limits do not change with configuration: iOS offers only `systemSmall` and `systemMedium`; watchOS offers only the `accessoryRectangular` Apple Watch Smart Stack presentation through its platform-conditional family registration. The same single widget kind and intent back every supported family.

## Presentation-ready data

The app owns selection, sorting, localization, and time-zone math. The widget receives a small serializable snapshot; it does not query SQLite.

| Field | Type | Purpose |
| --- | --- | --- |
| `state` | `"preConvention" \| "upcoming" \| "leaveSoon" \| "empty"` | Chooses the layout and VoiceOver summary. |
| `generatedAt` | ISO date string | Lets the app reject or replace stale snapshots. |
| `conventionId` | string or null | Identifies this widget instance's selected convention and blank-state destination. |
| `conventionTitle` | string or null | Required in `preConvention`; primary convention content. |
| `conventionStartsAt` | ISO date string or null | Required in `preConvention`; countdown and transition boundary. |
| `conventionDateLabel` | localized string or null | Required in `preConvention`; compact date range in the convention time zone. |
| `conventionCountdownLabel` | localized string or null | Required in `preConvention` at 24 hours or more; compact localized units such as `15 D 6 H`. |
| `conventionCountdownAccessibilityLabel` | localized string or null | Required with the compact label; fully spoken value such as `Starts in 15 days, 6 hours`. |
| `conventionDeepLink` | string or null | Required in `preConvention`; opens the convention rather than an event. |
| `currentEventTitle` | string or null | Optional title of the event active at this timeline entry. |
| `currentEventEndsAt` | ISO date string or null | Optional boundary for removing the current-event handoff. |
| `currentEventEndLabel` | localized string or null | Optional preformatted current-event end time. |
| `nextEventId` | string or null | Required in `upcoming` and `leaveSoon`; the whole-widget tap opens this event. |
| `nextEventTitle` | string or null | Required in `upcoming` and `leaveSoon`. |
| `nextEventStartsAt` | ISO date string or null | Required in `upcoming` and `leaveSoon`; timeline transition boundary. |
| `leaveAt` | ISO date string or null | Start of the leave-soon state. Derived from `reminderMinutes`. |
| `nextEventStartLabel` | localized string or null | Required in `upcoming` and `leaveSoon`; preformatted in the convention time zone. |
| `nextEventLocationLabel` | localized string or null | Optional room first, then location; omitted when empty or space constrained. |
| `statusLabel` | localized string | Examples: `Coming up`, `Next event`, `Leave in 18 min`, `No upcoming events`. |
| `deepLink` | string | Opens `nextEventId`; uses the app variant's configured scheme and never hardcodes production. |

Use the existing event ordering and next-event selection logic. For tied start times, MVP shows the first stable result. Revisit multi-event display only after real usage shows a need.

In `upcoming` and `leaveSoon`, `nextEventId`, `nextEventTitle`, `nextEventStartsAt`, `nextEventStartLabel`, and the next-event deep link are required as one unit. Emit the empty snapshot instead of a partial next event. The three `currentEvent*` fields are optional but must be all present or all null, and are present only while that event is active.

In `preConvention`, require `conventionId`, `conventionTitle`, `conventionStartsAt`, `conventionDateLabel`, and `conventionDeepLink` as one unit. At 24 hours or more, also require both countdown labels. The root tap opens the convention, never an event.

### Adaptive pre-convention countdown

The ladder lives in `ConPawsCountdown` (`targets/_shared/ConPawsCountdown.swift`)
and is shared by every surface. One private classifier backs both renderings, so
a rectangle and a circle can never disagree about which rung they are on.

| Time remaining | Prose (`label`) | Compact (`compactLabel`) |
| --- | --- | --- |
| At or past the start | `Now` | `Now` |
| Under 1 hour | `Starting soon` | `Soon` |
| 1–23 hours | `In 6 hours` | `6h` |
| Tomorrow, or a DST-stretched today | `Tomorrow` / `Today` | `1d` |
| 2–29 calendar days | `In 13 days` | `13d` |
| A whole calendar month or more | `In 2 months` | `2mo` |

**The smallest unit is a whole hour, deliberately.** A widget refreshes on the
system's schedule, not ours, so a label has to stay true for as long as it might
sit on screen — seconds and minutes promise a precision the extension cannot
deliver. The earlier design here called for `Text(…, style: .timer)` inside the
final 24 hours; that was removed in PR #23 for exactly this reason. The watchOS
**app** still uses a live timer inside the final day, because it is on screen and
refreshing and genuinely can honour it.

Days are counted from `startOfDay` in the **convention's** zone, not as 24-hour
blocks, so "Tomorrow" means the next calendar day where the convention happens.
Months use `dateComponents([.month])`, never `days / 30` — 1 January to 31
January is `In 30 days`, not one month.

`accessoryCircular` also draws a ring, scaled to the final seven days
(`ringProgress`). It is empty before then on purpose: a ring that barely moves
for two months reads as broken. The ring redraws only at the moments the wording
changes, so it steps rather than sweeps.

During `leaveSoon`, the small widget shows `LEAVE IN 18 MIN`, then `NOW · ENDS 2:50 PM` with the current title, then `NEXT · 3:00 PM` with the next title. If no event is currently active, use the compact fallback: `LEAVE IN 18 MIN`, `FOR`, then the next title and start time. Both layouts tap through to the next event.

## Timeline

**There is no `expo-widgets` dependency and no `updateTimeline` API here.** The
app does not enqueue entries; it publishes a snapshot and the Swift side builds
its own timeline from it.

The transport, end to end:

1. `src/services/widget-snapshot.ts` builds a presentation-ready
   `WidgetSnapshot` — epoch milliseconds only, dates already localized — and
   `publishWidgetSnapshot()` serializes and coalesces the call.
2. The local Expo module `modules/conpaws-widgets` writes that JSON string into
   the App Group `UserDefaults` under `conpaws.widget.snapshot.v1`, and calls
   `WidgetCenter.shared.reloadAllTimelines()` **only when the string changed**.
   The same string is mirrored to the Watch over `WCSession`.
3. `ConPawsSnapshotStore.load()` reads and decodes it, rejecting anything whose
   `schemaVersion` is not 1. The App Group id is derived from the bundle id, so
   the dev, preview, and production variants stay isolated.
4. Each provider builds its own `Timeline`. Rather than one entry plus a refresh
   request, it **pre-builds an entry for every moment the wording changes** —
   `ConPawsCountdown.changePoints`, capped at 24 — so WidgetKit can render the
   descent itself even when the system declines to wake the extension. The iOS
   provider then re-plans from the last entry with `.after(...)`; the watchOS one
   uses `.atEnd`.

The app republishes on launch, on foreground, after every successful mutation,
and explicitly before navigating away from the create, edit, and import routes.
`widget-publication-routes.test.ts` asserts that last one by reading the route
sources.

Keep it local. Do not add a second cache or a widget-side network client.

## Family behavior

`accessoryRectangular` is the technical WidgetKit name shared by the Apple Watch Smart Stack and the iPhone Lock Screen. Both surfaces exist. The watchOS target declares `.accessoryRectangular` only; the iOS target declares `.systemSmall` and `.systemMedium` for the Home Screen plus `.accessoryCircular`, `.accessoryRectangular`, and `.accessoryInline` for the Lock Screen, all under the single `ConPawsWidget` kind.

The two targets render the accessory families from separate code. They agree because they share `ConPawsCountdown`, not because they share views: the iOS target runs `ConPawsWidgetState` and the watchOS target runs `WidgetScheduleProjection`, and those were not worth unifying for one duplicated layout.

| Family | Before reminder | Reminder window | Blank fallback |
| --- | --- | --- | --- |
| `systemSmall` | **Next event**, two-line event title, start time, then location. | **Leave in** at top, current title/end, then next title/start. Hide brand and locations. Without an active current event, show **For** with the next title/start. | Calendar mark, **No upcoming events**, and short schedule guidance. |
| `systemMedium` | **Next event** with title, full time range, and location. | Split layout: event details on the left, **Leave in** countdown and leave-by time on the right. | Calendar mark, **No upcoming events**, and short schedule guidance. |
| `accessoryRectangular` (watchOS + Lock Screen) | Monochrome **Next** status, start time, title, and location. | Monochrome **Leave in** countdown, title, start time, and location. | **No upcoming events** and a short schedule label. |
| `accessoryCircular` (Lock Screen) | Calendar mark over the compact countdown to the next event, such as `3h`. | Walking figure alone. The reminder window is minutes wide, so a compact label would read `Soon` for all of it and add nothing. | Calendar mark. |
| `accessoryInline` (Lock Screen) | One line above the clock: start time, then title. | `Leave`, the title, and the countdown. | **No upcoming events**. |

In `preConvention`, every family shows **Coming up**, the convention title, the countdown, and the date range where it fits. A 15-day wait renders as `In 15 days` (see the countdown ladder above). `accessoryCircular` has room for neither the title nor the prose countdown, so it shows a ring scaled to the final week with `ConPawsCountdown.compactLabel` at its centre — `15d`, then `6h`, then `Now`. The ring is empty until the last seven days on purpose: one that barely moves for two months reads as broken.

Set one root widget URL for the whole surface. `preConvention` opens the convention, event states open the next event, and a blank state opens the convention list. Do not add nested buttons, open-app labels, app-like controls, or scrolling.

## Accessibility

- VoiceOver order before the reminder: status, next event, start time, location. During the small leave state: leave countdown, current event and end time when present, then next event and start time. Combine the countdown unit with its number, such as `Leave in 18 minutes`.
- VoiceOver order in `preConvention`: coming-up status, convention title, full localized countdown, then date range. Announce that the widget opens the convention. Let the system-driven timer expose its current value inside 24 hours.
- Hide decorative calendar and clock marks from accessibility.
- Never use teal or the countdown panel as the only state cue; the state is always written in text.
- Use system text styles and semibold or bold emphasis. Keep essential copy legible at larger Dynamic Type sizes; remove secondary location text before shrinking primary text.
- Localize every label, format dates in the convention time zone, and test right-to-left layout before release.
- Give the blank state a useful label and whole-widget deep link. Do not announce missing internal data as an error or add a redundant open-app CTA.

## Rendering modes

- Read `widgetFamily`, `widgetRenderingMode`, `colorScheme`, `isLuminanceReduced`, and system content margins from `WidgetEnvironment`.
- `fullColor`: iPhone Home Screen widgets support light and dark appearances; the Apple Watch Smart Stack uses its native black background unless a meaningful custom background is needed.
- `accented`: split content into primary and accent groups. Preserve hierarchy without relying on the original colors.
- `vibrant`: used by the iPhone Lock Screen families. The system desaturates and flattens the content, so nothing may depend on colour to carry meaning. Do not use `.tint` as the only signal and do not use opacity-filled backgrounds — the `.tint.opacity(0.12)` leave strip on `systemMedium` would turn to mush here. `.secondary` still maps to a distinct vibrancy level and remains valid for hierarchy. Use `AccessoryWidgetBackground()` for circular rather than a hand-rolled shape, and give the accessory families a `.clear` container background so they do not sit on the wallpaper as a card.
- Use a removable widget container background. Keep default system content margins for MVP.
- Under reduced luminance, remove bright fills and retain the text hierarchy.

## Release checklist

Verify before a store build, not before starting work — the work is done:

- Final widget copy exists in every supported locale.
- Event and convention deep links are stable across development, preview, and production variants.
- The countdown ladder has boundary checks. These live in `runConPawsWidgetSelfCheck()` in `targets/widget/widgets.swift`, run from the widget bundle's `init()` under `#if DEBUG`, and follow the same pattern as `runWatchScheduleSelfCheck()` on the Watch. They cover the zero, one-hour, 24-hour, 30-day, and calendar-month rungs, that the prose and compact renderings agree on each, and the ring's clamps. There is no Swift test target and CI runs on Linux with no `xcodebuild` step, so these are the only automated Swift checks that exist.
- iOS Xcode previews cover `systemSmall` and `systemMedium` in `fullColor` and `accented`, and the three Lock Screen families in `vibrant`. watchOS previews separately cover `accessoryRectangular` in Smart Stack rendering modes.
- VoiceOver and large-text checks pass on a physical iPhone and Apple Watch for their respective families.

## Official references

- [@bacons/apple-targets](https://github.com/EvanBacon/expo-apple-targets) - the config plugin actually in use. Targets are `PBXFileSystemSynchronizedRootGroup`s, so new Swift files in `targets/<name>/` are picked up with no project-file edit.
- [WidgetKit](https://developer.apple.com/documentation/widgetkit) - families, timelines, rendering modes, and `AccessoryWidgetBackground`.
- [Apple Human Interface Guidelines: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets) - glanceable hierarchy and focused interactions.
- [Apple: Supporting additional widget sizes](https://developer.apple.com/documentation/widgetkit/supporting-additional-widget-sizes) - family-specific layouts.
- [Apple: Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date) - timeline entries and refresh behavior.
- [Apple: Preparing widgets for additional contexts and appearances](https://developer.apple.com/documentation/widgetkit/preparing-widgets-for-additional-contexts-and-appearances) - full-color, accented, vibrant, and reduced-luminance behavior.
- [Apple: Displaying the right widget background](https://developer.apple.com/documentation/widgetkit/displaying-the-right-widget-background) - removable container backgrounds.
