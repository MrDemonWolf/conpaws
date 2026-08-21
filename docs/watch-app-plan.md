# ConPaws Apple Watch companion plan

## Product boundary

ConPaws on Apple Watch is a focused schedule companion, not a smaller copy of the phone app. It answers four wrist-sized questions:

1. What am I doing now?
2. What is next, and when should I leave?
3. What is on my schedule today?
4. How long until the convention starts?

This plan covers the watchOS app and its one Apple Watch Smart Stack widget. The iPhone Lock Screen is a separate surface owned by `docs/widget-plan.md`, and it now ships its own accessory families — this plan does not describe them.

## Screen flow

`Pre-convention countdown` → `Now / Next` ↔ `Today schedule` → `Event detail`

- The first app screen changes with context: countdown before the convention, Now / Next during it, and saved/offline content if a fresh sync is unavailable.
- Turning the Digital Crown scrolls the Today list. Tapping a row opens Event detail.
- Tapping the Smart Stack widget opens Now / Next, or Event detail when its event is unambiguous.
- Every common task takes one or two taps. No settings hierarchy belongs on the watch for MVP.

## States

| State | Primary information | Primary interaction |
| --- | --- | --- |
| Now / Next | Leave countdown, current event, next event and start time | Tap next event for detail |
| Today | Saved events in time order; current row highlighted | Crown to scroll, tap a row |
| Event detail | Title, time, location, leave-reminder status | Review; reminder changes remain on iPhone for MVP |
| Pre-convention | Convention name, adaptive time remaining, start date | Tap to view convention summary |
| Offline | Cached next event, cache age, sync status | Keep reading the saved schedule |

## Adaptive countdown

Use calendar-aware units and show at most two units at once:

| Time remaining | Display |
| --- | --- |
| 30 days or more | `2 mo 14 d` using calendar months, never days ÷ 30 |
| 2–29 days | `12 d 6 h` |
| 24–47 hours | `1 d 8 h` |
| Under 24 hours | Live timer: `23:42:18`, then `42:18`, then `0:59` |
| Started | Switch to Now / Next |
| Ended | `Convention ended` and last sync time |

The target date and timezone come from the convention record. Seconds are presentation only: use the platform’s dynamic date/timer rendering instead of scheduling one update per second. Always On may reduce the visible precision.

## Data and sync

- Treat the Watch app as independently readable. Persist the latest convention, itinerary, reminder, and event-transition data locally.
- Send latest-state snapshots from iPhone with Watch Connectivity application context; queue schedule changes for later delivery.
- Never replace good cached data with an empty or failed response.
- Show `Offline · Updated 12 min ago` and `Using saved schedule` as a passive footer when disconnected. Do not interrupt cached content with a retry button.
- Reserve a blocking empty state for a watch that has never received a schedule: `Your schedule isn’t here yet` and `Open ConPaws on iPhone to sync`.
- Smart Stack data should come from the same compact cached snapshot as the app and use event transition dates for its timeline.

## Apple Watch Smart Stack widget

Offer one context-sensitive widget, not a family of speculative complications:

- Before the reminder window: next event and start time.
- With a configured leave reminder: send one Watch notification/haptic at `leaveAt`, then show the leave countdown plus current → next context.
- Without a leave reminder: never show `Leave in`, never send a leave haptic, and remain in the next-event state until the event starts.
- Before the convention: adaptive convention countdown.
- With no schedule: `No upcoming events`.
- Increase Smart Stack relevance only around the convention, event starts, and leave-reminder windows.

The mockup labels this surface as an Apple Watch Smart Stack widget. It is not the iPhone Lock Screen widget, which is a separate target with its own views; the two share `ConPawsCountdown` so their wording agrees, and nothing else.

## Appearance

- The Watch app uses the native watchOS black canvas with semantic foreground and accent colors. watchOS has no user-selectable Light/Dark Mode, so do not add an app appearance setting.
- Test the app in normal, Always On, and Increase Contrast states.
- The Smart Stack widget supports WidgetKit's `fullColor` and `accented` rendering modes. Apple Watch does not use the `vibrant` mode.
- The iPhone Home Screen widgets remain separate and adapt to the system's light, dark, clear, and tinted appearances.

## Accessibility and layout

- Design on a 46 mm reference content canvas of 208 × 248 points (416 × 496 pixels at 2×), then verify smaller supported watches.
- Use native watchOS type styles and Dynamic Type. Titles may wrap to two lines; time and status must not truncate before location.
- Keep actionable rows and buttons at least 38 points high. Do not rely on color alone for current, offline, or reminder states.
- Expose each event row as one VoiceOver element, for example: `Current event, Fursuit Meetup, ends at 2:50 PM`.
- Suggested Now / Next announcement: `Leave in 18 minutes. Current event: Fursuit Meetup, ends at 2:50 PM. Next event: Opening Ceremonies, starts at 3 PM.`
- The Digital Crown scrolls every vertical list; equivalent swipe navigation remains available.
- Reduce or remove decorative motion when Reduce Motion is enabled. Dim secondary content appropriately for Always On.

## MVP cut

Build only the five app states and one Smart Stack widget shown in the mockup. Skip watch-side schedule editing, search, maps, complication families, and notification controls until device testing proves they reduce phone use.

## Research basis

- [Designing for watchOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos/) — focused, glanceable interactions and shallow navigation.
- [Digital Crown](https://developer.apple.com/design/human-interface-guidelines/digital-crown) — primary vertical navigation for watchOS lists and pages.
- [watchOS layout](https://developer.apple.com/design/human-interface-guidelines/layout#watchOS) — edge-to-edge content and restrained control density.
- [WidgetKit](https://developer.apple.com/documentation/widgetkit/) — Smart Stack widgets, timelines, and glanceable content.
- [Smart Stack relevance](https://developer.apple.com/documentation/widgetkit/widget-suggestions-in-smart-stacks) — contextual relevance on Apple Watch.
- [Watch Connectivity](https://developer.apple.com/documentation/watchconnectivity) — companion data transfer and offline-tolerant synchronization.
