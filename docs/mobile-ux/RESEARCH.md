# ConPaws mobile UX exploration

Research checked September 3, 2026. **Recommendation: keep concurrent choices in readable lists, and let people plan the portions they want to attend.** Six to ten panels should not become six to ten narrow calendar columns. A personal join/leave time allows parts of two sessions without changing either published event.

## Scope and evidence

This browser prototype explores interaction and visual direction. It is not the native Expo app, and it cannot validate native rendering, VoiceOver, Dynamic Type, haptics, or iOS sheet gestures. Lakeside Fur Con, panels, hosts, rooms, and times are fictional sample data. Choices live in the preview, not a convention account.

Mobbin was requested and its connector was attempted. Access was blocked by a paid-plan requirement. No Mobbin screenshots or flows were inspected; this exploration does not claim otherwise. Research instead uses current Apple guidance and official conference-app documentation.

## Current app audit

The convention screen groups sessions by day, while All, My Schedule, and Now & Next live in a filter menu. Now & Next shows saved sessions only. The data model has one `inSchedule` state, so the star cannot distinguish curiosity from intended attendance. These facts explain why simply making rows prettier would leave the main decision problem unresolved.

The existing overlap grouping is transitive and restricted to saved sessions, preventing unrelated choices from chaining most of the day into one block. A missing end time has a display fallback; that fallback is not proof of a conflict. Cancelled or removed saved panels remain visible so changes do not silently erase a person's plans.

Code references:

- `apps/native/app/(tabs)/(home)/convention/[id].tsx`
- `apps/native/src/db/schema.ts`
- `apps/native/src/lib/day-band.ts`
- `apps/native/src/lib/convention-time.ts`

## Findings and design decisions

**Evidence:** Apple recommends succinct text rows and grouped lists. Its segmented-control guidance limits iPhone controls to about five segments. **Decision:** full-width panel rows, a short date strip, time selection, and category filters; no ten-room segmented control. [Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), [segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls)

**Evidence:** tabs represent destinations, retain navigation state, and need labels. Inline search can clarify the content being searched. **Decision:** Schedule, My Plan, and Now remain visible; search clearly targets panels, hosts, and rooms in the selected convention. [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)

**Evidence:** Liquid Glass belongs on navigation and controls, not content cards. Sheets suit brief decisions, need clear dismissal, and should not stack. **Decision:** quiet, solid session rows beneath translucent navigation; one comparison sheet for resolving a choice. [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)

**Evidence:** Apple calls for larger text support, contrast, VoiceOver descriptions, and indicators beyond color. Current guidance lists 44 × 44 pt as the default iOS control size. **Decision:** target at least 44 pt hit areas; use text and icons for Interested, Going, and overlap states. Native accessibility testing remains required. [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

**Evidence:** Guidebook documents grouped breakout sessions, including ten concurrent alternatives and staggered presenters. Its conflict handling varies with registration and capacity; Sched can forbid overlapping selections. **Inference:** ConPaws benefits from separating Interested from My Plan. A bookmark is neither a seat reservation nor proof of attendance. [Complex schedules](https://www.guidebook.com/post/organizing-complex-schedule), [Guidebook conflicts](https://support.guidebook.com/hc/en-us/articles/204795874-My-Schedule), [Sched agenda](https://support.sched.com/knowledge/manage-event-schedule-/-agenda)

## Recommended flow

1. **Browse:** choose a day and time; scan every matching panel, including sessions already underway. Show actual start/end times and room names.
2. **Save interests:** bookmark several options without triggering conflict warnings. Open details for the description and host.
3. **Plan your attendance:** keep several panels in My Plan. Use native time controls to set join and leave times within each published event. Keep the original schedule visible.
4. **Resolve:** compare personal attendance intervals. Adjust times to catch parts of several panels, switch intentionally, or save an overlap with a warning. Never silently replace a commitment.
5. **Attend:** Now shows the current stop, leave time, next room, and planned join time. Widgets, Watch, and Live Activities reuse those personal times, including late joins.

The Phone flow opens with Schedule, attendance editing, and Now. My Plan, comparison, details, and filters remain interactive. Separate Widgets, Apple Watch, and Live & alerts pages explore glanceable surfaces. Those galleries have independent sample controls; phone edits do not synchronize into them.

The shared starting scenario is 2:18 PM: attend Fursuit photography 2:00–2:25, then Character design 2:35–3:20. Their published events remain 2:00–3:00 and 2:00–3:30. The ten-minute gap is an available buffer, not a measured walking time. Late entry depends on the panel's rules.

## Edge cases

- Different start times can still overlap. Back-to-back sessions do not overlap, but different rooms may need travel time.
- Validate personal join before leave, both within the event. Overlap checks use personal times; published times remain immutable. All edited choices must be checked, including conflicts with other planned sessions.
- Compare direct interval conflicts, not an endlessly expanding chain of transitive overlaps.
- Drop-in spaces differ from timed commitments. Registration, capacity, and age restrictions need their own states when real data supplies them.
- Unknown end times must remain uncertain. Cross-midnight sessions require full timestamps and the convention's time zone.
- Schedule updates must preserve cancellation/removal notices and recheck changed plans. Never infer live occupancy or accessibility from sample rooms.
- Filters need visible scope, counts, and a reset path. A lack of results must not look like a lack of convention programming.

## Four usability checks

- [ ] **Discover:** find an appealing panel among eight simultaneous choices. Success: within 45 seconds, identify its exact time and room without sideways scrolling.
- [ ] **Shortlist:** save three competing panels, then add two to My Plan. Success: explain Interested versus My Plan; all three interests remain available.
- [ ] **Resolve:** leave one panel at 2:25 and join another at 2:35. Success: identify the buffer, find both original event times, and keep an intentional overlap when desired.
- [ ] **Recover:** clear a category filter, inspect another day, then return to Now. Success: find all choices again and distinguish planned attendance from other ongoing options.

## Native UI and NativeWind contract

Added at Nathanial's request: keep the design as native as possible and use only supported NativeWind styling. Every new mockup element must map to an existing app component, an OS control, or a small composition of supported React Native primitives. Native behavior takes priority over matching the browser drawing pixel for pixel.

### Ownership of each layer

| Mockup element | Native implementation | Styling owner |
| --- | --- | --- |
| Tabs, large titles, back button, search, toolbar menus | Existing Expo Router native tabs and stack APIs | Native component props and system defaults |
| Grouped session rows and sections | Existing iOS SwiftUI list pattern; `List`, `Section`, `Button`, `Text` | SwiftUI modifiers and semantic system colors |
| Going / Interested selector | SwiftUI `Picker` with segmented style | Native picker appearance |
| Compare and panel detail presentation | Existing `formSheet` route pattern | Native detents, dismissal, safe areas, and keyboard behavior |
| Personal join and leave controls | SwiftUI `DatePicker` / platform time picker inside the sheet | System presentation, locale, validation, and accessibility |
| Custom day strip, row content, and spacing outside SwiftUI | Existing React Native components | Supported NativeWind utilities and app theme tokens |
| Icons and glass | SF Symbols and native tab/toolbar materials | System rendering; OS availability checks |

SwiftUI lives inside `Host`. Its descendants use `HStack` / `VStack` and modifiers; NativeWind `className` does not turn those controls into React Native views. Use NativeWind on the surrounding React Native layout instead of adding a bridge solely to force classes onto native controls. [Expo SwiftUI integration](https://docs.expo.dev/guides/expo-ui-swift-ui/), [SDK 57 Picker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/picker/)

Reuse `ConventionEventRow.tsx` / `EventItem.tsx` for existing event actions and accessible content, `ui/Row.tsx` for React Native tap rows, and `ui/NativeText.ios.tsx` for semantic SwiftUI text. The current native search and menus already live in `convention/[id].tsx`; the tab and sheet shells live in its parent layouts. Adapt those components before creating replacements. The compact day strip remains a custom composition; it is not a stock iOS date picker.

Preserve existing platform caveats: some SwiftUI-hosted screens deliberately disable large titles/transparency because UIKit cannot track the inner SwiftUI scroll view. Use the proven screen-shell pattern and verify scrolling before applying the browser mockup's large header everywhere.

### Supported styling only

“Approved” means documented support for the target platform and confirmed behavior on the installed version. It is a project rule, not an Apple certification. NativeWind can accept a class that has no native effect. Its compatibility table is the starting point, not a web screenshot. [NativeWind platform support](https://www.nativewind.dev/v5/core-concepts/tailwindcss)

- Prefer simple flex layout, spacing, sizes, text, colors, borders, and radii. Check the exact utility/value before introducing it. `p-4`, `px-4`, `py-3`, and `gap-2` are supported examples. [Padding](https://www.nativewind.dev/v5/tailwind/spacing/padding), [gap](https://www.nativewind.dev/v5/tailwind/flexbox/gap)
- Reuse `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `text-primary`, and `border-border` from `apps/native/src/global.css`. iOS tokens already map to semantic `PlatformColor` values. Preserve the app's separate Android fallbacks.
- Exclude web-only, experimental, and partially supported utilities from the default palette. For example, CSS Grid and `backdrop-blur-*` do not provide native layouts or glass. Use native scrolling/header behavior instead of relying on partial `fixed` / `sticky` support. [Backdrop blur](https://www.nativewind.dev/v5/tailwind/filters/backdrop-blur), [position](https://www.nativewind.dev/v5/tailwind/layout/position)
- Keep system font scaling, labels, touch areas, focus, and reduced-motion behavior. A NativeWind text class is not proof of Dynamic Type compliance. Native control props and targeted `style` values remain valid when they are the documented API.

Current declared baseline: Expo `~57.0.18`, Expo Router `~57.0.17`, Expo UI `~57.0.14`, NativeWind `5.0.0-preview.2`, React Native CSS `^3.0.5`, Tailwind `^4.1.18`, React Native `0.86.3`. NativeWind is already a preview dependency; this exploration does not change versions. Check against that baseline before implementation rather than assuming every later v5 feature is available.

For 6–10 visible alternatives, use the existing native list pattern. A complete convention schedule can contain hundreds of rows; profile before choosing the same rendering strategy for the whole dataset. SDK 57's SwiftUI List currently creates every React row up front. Keep an existing virtualized React Native list where scale requires it rather than sacrificing scrolling performance to a blanket “all SwiftUI” rule. [SDK 57 List limitations](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/list/)

### What this preview proves

The current HTML preview illustrates these components and the decision flow. It does **not** run NativeWind, UIKit, or SwiftUI. Its CSS blur, SVG symbols, device shell, and larger-text toggle are presentation aids only. The screen colors now follow the app's light/dark token fallbacks; live iOS semantic colors can vary with system settings.

Before calling the implementation native-verified, run it in the iOS app and check system sheets/back gestures, keyboard/search, VoiceOver, large accessibility text, reduced motion/transparency, and 6/8/10 concurrent-panel scenarios. Every custom control must have a clear reason an existing native control cannot cover it.

## Widgets, Watch, and live surfaces

**iOS widgets:** the small size answers the next action; medium adds current and next; large adds the day's useful sequence instead of enlarging one countdown. Existing native agenda widgets already have multiple rows, but fixed row limits and spacers leave unused space with shorter plans. The new concepts use each size for a different amount of information. WidgetKit owns layout, system margins, tinting, and supported actions. [Apple widget guidance](https://developer.apple.com/design/human-interface-guidelines/widgets)

**Android widgets:** compact, wide, and tall concepts adapt the information to available space, with light, dark, and wallpaper-color samples. Use Jetpack Glance responsive size handling rather than assuming iOS dimensions. NativeWind does not style Glance or WidgetKit internals. [Glance responsive layouts](https://developer.android.com/develop/ui/compose/glance/build-ui)

**Apple Watch:** open a complication into Now & next, see the leave time and next room, then keep the plan or stay five minutes longer. Today and event details remain available below the immediate action. Staying longer reduces the sample buffer from ten to five minutes while preserving the next join time. Offline edits show pending sync; the browser does not perform device synchronization. [Designing for watchOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos)

**Live Activities:** explore upcoming, attending, leave time, and finished states across the Lock Screen and minimal, compact, and expanded Dynamic Island. Show the personal attendance state and one useful next action. System timers and ActivityKit own the real behavior; no continuous background JavaScript timer is implied. [Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities)

**Android ongoing notification:** shown as a separate platform concept. Do not promise a promoted Live Update for a convention agenda; Android restricts that surface to qualifying ongoing activities. [Live Updates](https://developer.android.com/develop/ui/views/notifications/live-update)

### Data changes required for native implementation

The current iOS widget upcoming filter uses published start times, so a planned late join can disappear after the official start. Watch and notification logic also need personal attendance timestamps. Store join/leave independently from published event times and send both through the existing widget, Watch, activity, and notification payloads. Re-evaluate overlaps after schedule changes. This exploration changes mockups only; those production integrations are not implemented here.

### Notification wording review

Live & alerts provides seven scenarios with short and friendly copy: upcoming panel, leave time, room change, cancellation, overlap, late join, and a user-requested test notification. Edit title/body, preview, hide private details, and compare text sizes. Samples do not request permission or deliver OS notifications.

Use “leave” only for an explicit personal leave time or a supported departure calculation. The existing fallback uses departure wording a few minutes before the official start, which can imply travel knowledge the app does not have. Otherwise use “starts” or “join.” State what changed, name the relevant time/room, and offer the next useful action. Keep saved interest distinct from attendance or a reserved seat. [Apple notification guidance](https://developer.apple.com/design/human-interface-guidelines/notifications)

### Prototype verification

Focused checks cover strict time parsing, attendance bounds, partial and retained conflicts, immutable published times, Activity state data, and notification scenarios. Browser review covers saving personal times, denser widget sizes, Watch adjustments, offline copy, and editable alerts. These checks validate the mockup, not native OS delivery or background execution.

## Empty states and upcoming conventions

Added after reviewing the actual phone, WidgetKit, Watch, snapshot, and import/refresh code. The **Empty & upcoming** page has ten editable wording examples, with the current copy and the condition that supports each. Widget and Watch galleries also offer upcoming and empty scenarios. Native app strings are unchanged.

### What the code actually knows

| Situation | Current behavior | Mockup direction |
| --- | --- | --- |
| No conventions on this device | Home shows “No conventions yet”; Import Schedule is already primary, Create Convention secondary. | Keep both actions; explain that import gives you a schedule to plan from. |
| Convention is upcoming | Home computes Today / Tomorrow / In N days in the convention time zone. Widget and Watch already have countdown views. | Keep con name and dates with the countdown. With picks: Review My Plan. Without picks: Browse Schedule. |
| Convention exists, event list empty | The phone offers Import Schedule and Add Event. | “No events added yet.” Do not infer organizer publication status. |
| Schedule exists, no personal picks | Native phone uses “My Schedule is empty” or “Nothing starred yet.” | “Your plan starts with a panel.” Browse Schedule should lead forward without another import. |
| Search/filter returns zero rows | The phone uses “No matching events.” | “No panels match.” Offer Clear Filters; keep the selected convention. |
| Break before another pick | Now & Next has no current rows and a next section. | “Nothing planned right now,” followed by the real next title, time, and room. |
| No more picks today | The phone uses “No more upcoming events in My Schedule.” | “That’s your plan for today.” Only after the final active pick ends. Show tomorrow’s pick when one exists. |
| Past/archived conventions only | Home keeps Archive and a separate “No upcoming conventions” message. | Retain access to Archive; do not describe this person as a first-time user. |
| Local data query fails | Phone has an error/retry branch before empty content. | “Couldn’t load your schedule.” Offer Try Again; do not call unknown data empty. |

Phone evidence: `apps/native/src/locales/en.json`; Home `app/(tabs)/(home)/index.tsx:77` (import-first actions), `:283` (countdown), `:313` (loading/error/empty priority), `:357` (Archive); convention `app/(tabs)/(home)/convention/[id].tsx:697` (Now & Next), `:816` (filter/mine/no-events branches); aggregate My Schedule `app/(tabs)/schedule/index.tsx:364`; date semantics `src/lib/convention-list.ts:10` and `src/lib/convention-time.ts:54`. These paths are under `apps/native/`.

### A missing schedule is not a publication announcement

The convention schema has dates, status, and a source URL, but no schedule release/publication state. The refresh path is not a “notify me when published” service: it requires an existing source plus import metadata, runs on screen focus/foreground, and the comparison returns unchanged when there are zero sourced events. Use Import Schedule / Add Event for the current empty state. A release alert would require new data and delivery behavior.

An automatic empty-feed response is untrusted and does not erase the existing schedule. A deliberate authoritative empty import has different rules: saved removed events remain marked, unsaved missing imported events can be deleted, and manual events remain. “Removed from the source” is not the same as organizer cancellation.

Evidence: `apps/native/src/db/schema.ts:4`, `src/services/schedule-refresh.ts:87`, `src/lib/schedule-changes.ts:90`, `src/hooks/useScheduleRefresh.ts:113`, `src/lib/import-policy.ts:18`, and `src/db/repositories/events.ts:220`.

### Widget and Watch limits that affect the wording

- **Snapshot scope:** only picked events with valid starts and no cancellation/removal marker are sent. There is no full-program count or publication field. Neither surface can distinguish an unimported program from an available program with no picks. Use “No panels picked” only when there is a convention and the snapshot establishes that absence; a missing/unreadable snapshot needs “Open ConPaws.” (`src/services/widget-snapshot.ts:87`, `:144`; `targets/_shared/ConPawsSnapshot.swift:93`.)
- **Countdown:** the target is the first convention date at midnight in its time zone. It is not doors opening or the first panel start. Day/date wording is safer than promising the con opens in an exact number of hours. (`src/services/widget-snapshot.ts:118`; iOS `targets/widget/widgets.swift:127`, `:641`.)
- **Final active panel:** the iOS provider computes a current event, then falls into empty when there is no next event. A similar Watch complication path can say “No upcoming events” during the last active event. Keep the current event visible; show finished copy only when both current and future picks are absent. (`targets/widget/widgets.swift:143`; `targets/watch-widget/widgets.swift:406`.)
- **Watch zero-pick message:** “No events today” currently always pairs with “Your next saved event is on another day.” That is false when no next saved event exists. Separate no picks, next on another day, and finished cases. (`targets/watch/content.swift:345`; shared English strings `targets/_shared/ConPawsStrings.swift:421`.)
- **Stale is not offline:** Watch marks a snapshot stale after 30 minutes. Its views do not use reachability to establish an offline state, and there is no Watch-side sync/retry control. Prefer “Last updated …” and, when needed, “Open ConPaws on your iPhone.” Proposed on-Watch attendance edits remain mockups, requiring native work. (`targets/watch/WatchScheduleStore.swift:28`; `targets/watch/content.swift:480`.)

The existing all-done branch in the large iOS widget is also undermined by row selection spilling into future days and the provider requiring a next event. These are native implementation findings to address when adopting the mockups, not production fixes included in this exploration.

## Run the exploration

From the repository root, run `bun docs/mobile-ux/serve.ts`, then open [the local preview](http://127.0.0.1:4173). Reuse that server if already running.

Run the focused interaction-logic checks with `bun docs/mobile-ux/app.test.ts`.
