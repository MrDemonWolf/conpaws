# ConPaws next-event widget MVP

Status: design only. This plan does not add a widget target, native files, or a dependency.

Mockups: [widget-mockups.svg](./widget-mockups.svg)

## Product slice

- Ship one read-only widget named **Next Event**.
- iOS supports only the Home Screen families `systemSmall` and `systemMedium`.
- watchOS supports `accessoryRectangular` only for the Apple Watch Smart Stack. Keep it, and any future watch accessory family, behind platform-conditional family registration.
- Start with `systemSmall`; `systemMedium` and the watchOS Smart Stack presentation are follow-ups after the small widget proves useful.
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

| Time remaining | Visual example | Calculation and refresh |
| --- | --- | --- |
| At least 30 days | `2 MO 12 D` | Use calendar month and day components in the convention time zone. Never approximate a month as 30 days. Refresh at the next calendar-day boundary. |
| 2–29 days | `15 D 6 H` | Show remaining days and hours. Add timeline entries when the displayed hour changes. |
| 24–47 hours | `1 D 8 H` | Keep one day plus remaining hours instead of switching early to a clock. Add timeline entries when the displayed hour changes. |
| Under 24 hours | `23:42:18`, then `42:18`, then `0:59` | Render `Text(conventionStartsAt, style: .timer)` so SwiftUI supplies the live H:M:S, M:S, and final-minute seconds. Do not enqueue per-second timeline entries. |

Derive the tier from `conventionStartsAt` and the timeline entry date; do not persist a tier. Localize compact unit tokens and their order. VoiceOver uses full units, such as `ConPaws Preview Con starts in 15 days, 6 hours`. Do not replace the live timer with a stale static accessibility value. At zero, the `conventionStartsAt` entry transitions to the next-event state.

During `leaveSoon`, the small widget shows `LEAVE IN 18 MIN`, then `NOW · ENDS 2:50 PM` with the current title, then `NEXT · 3:00 PM` with the next title. If no event is currently active, use the compact fallback: `LEAVE IN 18 MIN`, `FOR`, then the next title and start time. Both layouts tap through to the next event.

## Timeline

Use Expo Widgets `updateTimeline` with future entries prepared by the app:

1. Write an immediate entry for the current state.
2. In `preConvention`, add entries at the tier and displayed-component boundaries above, plus an entry at `conventionStartsAt` that advances to the first next-event state or the blank state. Inside 24 hours, the SwiftUI timer updates between entries.
3. Add an entry at `leaveAt` to switch from **Next event** to **Leave in**.
4. During the leave window, add five-minute countdown entries, then one-minute entries for the final ten minutes. Notifications remain the exact-time alert path because WidgetKit does not guarantee precise refresh timing.
5. If the active event ends during the leave window, add an entry at `currentEventEndsAt` that switches the small family to its `FOR` fallback.
6. Add an entry at `nextEventStartsAt` that advances to the following event or the blank state.
7. Rebuild the timeline after import, add, edit, delete, reminder, selected-convention, locale, or time-zone changes, and when the app returns to the foreground.

Keep the timeline local. The Expo config plugin's App Group is the future transport between the main app and generated widget extension. Do not add a second cache or a widget-side network client.

## Family behavior

`accessoryRectangular` is the technical WidgetKit name for the watchOS-only Apple Watch Smart Stack presentation shown in the mockups. The iOS branch declares only `.systemSmall` and `.systemMedium`; the watchOS branch conditionally declares `.accessoryRectangular`. Any future accessory family remains watchOS-only.

| Family | Before reminder | Reminder window | Blank fallback |
| --- | --- | --- | --- |
| `systemSmall` | **Next event**, two-line event title, start time, then location. | **Leave in** at top, current title/end, then next title/start. Hide brand and locations. Without an active current event, show **For** with the next title/start. | Calendar mark, **No upcoming events**, and short schedule guidance. |
| `systemMedium` | **Next event** with title, full time range, and location. | Split layout: event details on the left, **Leave in** countdown and leave-by time on the right. | Calendar mark, **No upcoming events**, and short schedule guidance. |
| `accessoryRectangular` (watchOS only) | Monochrome **Next** status, start time, title, and location. | Monochrome **Leave in** countdown, title, start time, and location. | **No upcoming events** and a short schedule label. |

In `preConvention`, every family shows **Coming up**, the convention title, adaptive countdown, and date range. The mockup's 15-day sample renders as `15 D 6 H`; compact families compress the same hierarchy instead of dropping the countdown.

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
- Do not implement `vibrant`: Apple Watch doesn't use that rendering mode, and ConPaws intentionally exposes no iPhone Lock Screen widget.
- Use a removable widget container background. Keep default system content margins for MVP.
- Under reduced luminance, remove bright fills and retain the text hierarchy.

## Implementation gate

Implementation can start after these are true:

- Final widget copy exists in every supported locale.
- Event and convention deep links are stable across development, preview, and production variants.
- Timeline generation has unit coverage for the 30-day, 48-hour, 24-hour, and zero countdown boundaries plus upcoming, leave-soon, event-start, no-event, calendar-month, daylight-saving, and time-zone transitions.
- iOS Xcode previews cover `systemSmall` and `systemMedium` without exposing accessory families. watchOS previews separately cover `accessoryRectangular` in Smart Stack rendering modes.
- VoiceOver and large-text checks pass on a physical iPhone and Apple Watch for their respective families.

## Official references

- [Expo Widgets](https://docs.expo.dev/versions/latest/sdk/widgets/) - config plugin, supported families, `WidgetEnvironment`, snapshots, and timelines.
- [Apple Human Interface Guidelines: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets) - glanceable hierarchy and focused interactions.
- [Apple: Supporting additional widget sizes](https://developer.apple.com/documentation/widgetkit/supporting-additional-widget-sizes) - family-specific layouts.
- [Apple: Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date) - timeline entries and refresh behavior.
- [Apple: Preparing widgets for additional contexts and appearances](https://developer.apple.com/documentation/widgetkit/preparing-widgets-for-additional-contexts-and-appearances) - full-color, accented, vibrant, and reduced-luminance behavior.
- [Apple: Displaying the right widget background](https://developer.apple.com/documentation/widgetkit/displaying-the-right-widget-background) - removable container backgrounds.
