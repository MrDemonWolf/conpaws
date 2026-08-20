# ConPaws UX opportunities

## Product direction

ConPaws should be the fastest answer to one question: **what do I need to do next?** Mature event apps already converge on searchable agendas, personal schedules, reminders, maps, and organizer updates. ConPaws can stay simpler and win on offline reliability, next-action clarity, and low-stress transitions.

Research references:

- [Whova: agenda search, personal schedule, and reminders](https://whova.com/resources/how-to-guide/whova-app-faq/)
- [Sched: viewing and managing a personal schedule](https://support.sched.com/knowledge/view-and-manage-your-schedule)
- [Guidebook: personalized schedules, maps, and timely updates](https://www.guidebook.com/solutions/conference-app)
- [Apple: focused, glanceable WidgetKit experiences](https://developer.apple.com/documentation/widgetkit/)
- [Apple: accurate notification urgency](https://developer.apple.com/design/human-interface-guidelines/managing-notifications)

## Now — MVP polish

1. **Now / Next / Later schedule** — keep the most immediate event and transition advice above the full agenda.
2. **Leave-early indicator** — show the configured reminder as plain text, such as “Leave 15 min early,” in the event row and accessibility label.
3. **Honest event source** — show Added or Imported. Add Official only after the import contract can verify a trusted publisher.
4. **Useful empty states** — explain what is missing and offer Add event plus Import schedule without decorative dead space.
5. **Automatic convention archive** — keep active and upcoming conventions focused; hide past conventions behind a collapsed Archive count.
6. **Previewable failure states** — keep blank, loading, and error states reachable from Debug Tools.

## Next — highest-value additions

1. **Per-convention travel buffer** — one default walking buffer, with an event override only when needed. No location tracking required.
2. **Schedule-change review** — when an imported source changes time, room, or cancellation status, show a compact diff before replacing saved data.
3. **Conflict resolution sheet** — tapping an overlap badge compares the conflicting events and lets the user keep one, both, or change reminders.
4. **Next Up widget** — start with one read-only small widget, then add medium and Lock Screen families after real use proves the need.
5. **Offline venue essentials** — a small saved card for map, registration hours, quiet room, medical help, and emergency contacts.
6. **Notification controls in context** — reminder timing belongs on the event; global defaults and permission status belong in Settings.

## Later — only after MVP use validates them

1. **Live Activity during an active convention day** — current event, next event, and leave time.
2. **Apple Watch glance** — next event and room, based on the same widget timeline data.
3. **Shared itinerary card** — export a privacy-safe image or link containing only selected events.
4. **Official-source verification** — signed or server-verified feeds, source identity, and update history.
5. **Quiet-mode schedule** — user-selected rest blocks and reduced reminders without pretending to diagnose or manage health.

## Deliberately skipped

- Social feeds, attendee networking, leaderboards, ticketing, and organizer analytics. They are common event-platform features, but they would dilute an offline personal schedule MVP.
- “AI recommendations.” The app does not yet have enough trustworthy preference or attendance data to make them useful.
- Always-on location tracking. A user-set walking buffer provides most of the transition value with less battery and privacy cost.

