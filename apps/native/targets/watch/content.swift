import Foundation
import SwiftUI

struct ContentView: View {
  @ObservedObject var store: WatchScheduleStore
  @State private var path: [WatchRoute] = []

  var body: some View {
    // NavigationStack OUTSIDE the TimelineView: with the stack inside, the
    // minute tick that changed the root branch (con started, snapshot
    // emptied) rebuilt the stack and popped the reader out of a detail
    // screen. `.everyMinute` aligns ticks to the minute boundary and is the
    // cadence the system throttles correctly in Always On.
    NavigationStack(path: $path) {
      TimelineView(.everyMinute) { context in
        WatchRootView(
          snapshot: store.snapshot,
          now: context.date,
          isUsingSavedSchedule: store.isUsingSavedSchedule(at: context.date),
          snapshotDate: store.snapshotDate
        )
      }
      // Registered once, outside the TimelineView closure. Each destination
      // runs its own minute timeline against the store, so a pushed screen
      // stays live without depending on the root re-creating it.
      .navigationDestination(for: WatchRoute.self) { route in
        WatchRouteView(store: store, route: route)
      }
    }
    // On the stack, not the root view: pushed screens inherit the stack's
    // environment rather than the root's, and every time they format has to
    // be in the app's language, which is a phone setting, not the watch's.
    .environment(\.locale, store.snapshot.locale)
    // A complication tap: the panel the card named, over the home screen, or
    // the home screen alone for a card without one. Without this the app came
    // forward on whatever screen it was last left on.
    .onOpenURL { url in
      guard let link = ConPawsWatchLink(url: url) else { return }
      path = WatchRoute.path(opening: link, in: store.snapshot)
    }
    .onChange(of: store.snapshot.generatedAtMs) {
      // A new schedule can drop the event a detail screen is showing. Pop it
      // rather than leave the reader on an empty screen.
      let pruned = WatchRoute.pruned(path, against: store.snapshot)
      if pruned != path { path = pruned }
    }
  }
}

/// A pushed screen, re-resolved against the store every minute.
private struct WatchRouteView: View {
  @ObservedObject var store: WatchScheduleStore
  let route: WatchRoute

  var body: some View {
    TimelineView(.everyMinute) { context in
      let snapshot = store.snapshot
      switch route {
      case .today:
        TodayListView(
          schedule: WatchScheduleProjection(snapshot: snapshot, now: context.date),
          strings: snapshot.strings
        )
      case .event(let conventionID, let eventID):
        // A miss lasts one frame at most: ContentView pops the route as soon
        // as the snapshot that dropped the event lands.
        if let found = snapshot.event(id: eventID, in: conventionID) {
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.remove, found.event, found.convention, now: context.date)
          )
        }
      case .option(let conventionID, let eventID):
        if let found = snapshot.event(id: eventID, in: conventionID) {
          // Added from this screen and confirmed by the phone.
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.remove, found.event, found.convention, now: context.date),
            confirmsSaved: true
          )
        } else if let found = snapshot.option(id: eventID, in: conventionID) {
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.add, found.event, found.convention, now: context.date)
          )
        }
      }
    }
  }

  private func planAction(
    _ kind: WatchPlanAction.Kind,
    _ event: ConPawsEventSnapshot,
    _ convention: ConPawsConventionSnapshot,
    now: Date
  ) -> WatchPlanAction {
    WatchPlanAction(
      kind: kind,
      // Either direction: a remove waiting on the phone also blocks an add.
      isPending: store.pendingAction(for: event.id, now: now) != nil
    ) { [store] in
      store.send(kind == .add ? .save : .remove, event: event, convention: convention)
    }
  }
}

/// The root screen for whichever state the schedule is in.
///
/// Always On redacts per view, not per screen: only event titles, rooms, age
/// ratings and descriptions are `privacySensitive`, so the system hides those
/// wrist-down while the countdown, the clock times and the convention name
/// stay readable.
/// A crowded hall can read a title off a raised wrist; the countdown is the
/// reason this app opts into Always On at all. Card fills drop too (see
/// `CardBackground`).
private struct WatchRootView: View {
  let snapshot: ConPawsSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  let snapshotDate: Date?

  var body: some View {
    // Projected once per tick so every section reads the same answer.
    let schedule = WatchScheduleProjection(snapshot: snapshot, now: now)
    // The app's language, which is a setting on the phone rather than a
    // setting on this watch. It arrives with the schedule and is threaded down
    // by hand so no view can quietly fall back to the watch's own language.
    let strings = snapshot.strings

    switch schedule.state {
    case .noConvention:
      // "Open ConPaws" read oddly from inside the ConPaws watch app; these
      // purpose-built strings say where to go instead.
      EmptyScheduleView(
        title: strings.noScheduleTitle,
        message: strings.noScheduleMessage,
        systemImage: "iphone"
      )
    case .countdown(let convention):
      PreConventionView(
        convention: convention,
        now: now,
        isUsingSavedSchedule: isUsingSavedSchedule,
        snapshotDate: snapshotDate,
        strings: strings
      )
    case .noPicks(let convention):
      // An empty plan is when adding from the wrist matters most -- removing
      // the last saved panel here lands on this screen -- so the hour's
      // options stay offered under the empty state rather than vanish.
      let options = convention.optionsThisHour(at: now)
      if schedule.isOverWithoutPicks {
        EmptyScheduleView(
          title: strings.nothingUpcomingTitle,
          message: strings.nothingUpcomingMessage,
          systemImage: "checkmark.circle"
        )
      } else if options.isEmpty {
        EmptyScheduleView(
          title: strings.noPicksTitle,
          message: strings.noPicksWatchMessage
        )
      } else {
        NoPicksOptionsView(
          convention: convention,
          options: options,
          now: now,
          isUsingSavedSchedule: isUsingSavedSchedule,
          snapshotDate: snapshotDate,
          strings: strings
        )
      }
    case .next, .currentOnly, .finished:
      ScheduleHomeView(
        schedule: schedule,
        isUsingSavedSchedule: isUsingSavedSchedule,
        snapshotDate: snapshotDate,
        strings: strings
      )
    }
  }
}

private struct PreConventionView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    let showsTimer = ConPawsCountdown.showsLiveTimer(
      from: now,
      to: convention.startDate,
      within: ConPawsCountdown.conventionTimerWindow
    )
    // Centered when it fits, scrollable for large Dynamic Type. A decorative
    // mark used to sit above the title and pushed the date range off the
    // bottom of a 46mm screen -- it was already hidden from VoiceOver, so it
    // cost a line and carried nothing.
    CenteredScrollView {
      VStack(spacing: 8) {
        Text(convention.name)
          .font(.headline)

        VStack(spacing: 2) {
          AdaptiveCountdownView(
            target: convention.startDate,
            now: now,
            timeZone: convention.timeZone,
            showsTimer: showsTimer,
            strings: strings
          )
          .font(.title2.bold())
          .foregroundStyle(Color.accentColor)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)

          // Only under the ticking timer. Beside "In 12 days" or "Tomorrow"
          // it read as the same thing said twice.
          if showsTimer {
            Text(strings.untilTheConvention)
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        }

        Text(convention.dateRangeLabel)
          .font(.caption)

        if isUsingSavedSchedule {
          SavedScheduleLabel(
            strings: strings,
            snapshotDate: snapshotDate,
            now: now,
            alignment: .center
          )
        }
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, 8)
      .accessibilityElement(children: .combine)
    }
    .navigationTitle(strings.comingUpTitle)
  }
}

private struct ScheduleHomeView: View {
  @Environment(\.locale) private var locale
  let schedule: WatchScheduleProjection
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: WatchMetrics.cardSpacing) {
        if let convention = schedule.convention {
          header(convention)

          // The outcome first, centered, before any link: it used to render
          // at the very bottom, under the Today row, as two overlapping lines.
          if case .finished = schedule.state {
            FinishedStatusView(convention: convention, now: schedule.now, strings: strings)
          }

          if let current = schedule.activeEvent {
            if schedule.nextEvent == nil {
              currentOnlyHero(current, in: convention)
            } else {
              EventCard(
                eyebrow: strings.happeningNowCaps,
                event: current,
                conventionID: convention.id
              ) {
                TimeAndPlace(
                  time: ConPawsFormat.timeRange(current, in: convention, locale: locale),
                  place: current.shortPlace
                )
              }
            }
          }

          if let next = schedule.nextEvent {
            nextHero(next, in: convention)
          }

          if !schedule.laterEvents.isEmpty {
            SectionLabel(title: strings.laterLabel)
            ForEach(schedule.laterEvents) { event in
              EventCard(
                // Day-aware: a bare "11:00 AM" for tomorrow's panel read as
                // later today.
                eyebrow: ConPawsFormat.nextEventTime(
                  event.startDate,
                  relativeTo: schedule.now,
                  in: convention,
                  locale: locale,
                  strings: strings
                ),
                event: event,
                conventionID: convention.id,
                accented: false
              ) {
                if let place = event.shortPlace {
                  Text(place).privacySensitive()
                }
              }
            }
          }

          // Hidden on a day with no picks rather than offering "Today 0" and
          // an empty screen behind it.
          if !schedule.todayEvents.isEmpty {
            TodayLinkRow(count: schedule.todayEvents.count, strings: strings)
          }

          OtherOptionsSection(
            convention: convention,
            options: convention.optionsThisHour(at: schedule.now),
            strings: strings
          )
        }

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: schedule.now)
            .padding(.horizontal, WatchMetrics.cardInset)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
    .toolbar {
      if !schedule.todayEvents.isEmpty {
        ToolbarItem(placement: .topBarTrailing) {
          NavigationLink(value: WatchRoute.today) {
            Label(strings.today, systemImage: "list.bullet")
          }
        }
      }
    }
  }

  private func header(_ convention: ConPawsConventionSnapshot) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      Text(convention.name)
        .font(.caption.bold())
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .accessibilityAddTraits(.isHeader)
      Spacer(minLength: 0)
      if isUsingSavedSchedule {
        // Seen at the top, where the eye lands; spoken once, by the footer,
        // which carries the full sentence and when the plan last synced.
        Image(systemName: "exclamationmark.arrow.circlepath")
          .font(.caption)
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .padding(.horizontal, WatchMetrics.cardInset)
  }

  private func nextHero(
    _ next: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> some View {
    // One answer for both the eyebrow and the value line. Separate boundary
    // tests left the first minute of every leave window reading
    // "STARTS IN / Starting soon" instead of a ticking timer.
    let showsTimer = ConPawsCountdown.showsLiveTimer(
      from: schedule.now,
      to: next.startDate,
      within: ConPawsCountdown.eventTimerWindow
    )
    let isToday = ConPawsFormat.dayLabel(
      next.startDate,
      relativeTo: schedule.now,
      in: convention,
      locale: locale,
      strings: strings
    ) == nil

    return HeroCard(
      eyebrow: showsTimer ? strings.startsInCaps : strings.upNextCaps,
      event: next,
      conventionID: convention.id
    ) {
      if showsTimer {
        AdaptiveCountdownView(
          target: next.startDate,
          now: schedule.now,
          timeZone: convention.timeZone,
          showsTimer: true,
          strings: strings
        )
      } else if isToday {
        // "In 3 hours": the same ladder the complication reads. Another day
        // gets no value line; the detail line already says "Tomorrow".
        Text(
          ConPawsCountdown.label(
            from: schedule.now,
            to: next.startDate,
            timeZone: convention.timeZone,
            strings: strings
          )
        )
      }
    } detail: {
      TimeAndPlace(
        time: ConPawsFormat.nextEventTime(
          next.startDate,
          relativeTo: schedule.now,
          in: convention,
          locale: locale,
          strings: strings
        ),
        place: next.shortPlace
      )
      // Only while it is still to come: after it fires, "Reminder at…"
      // describes the past. The bell says "reminder", so the line keeps the
      // time and the offset; VoiceOver, which cannot see the bell, gets the
      // whole sentence.
      if let reminder = ConPawsFormat.upcomingReminderTime(
        next, now: schedule.now, in: convention, locale: locale, strings: strings
      ),
        let spoken = ConPawsFormat.upcomingReminderAt(
          next, now: schedule.now, in: convention, locale: locale, strings: strings
        )
      {
        Label {
          Text(reminder)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(spoken)
        } icon: {
          Image(systemName: "bell")
            .accessibilityHidden(true)
        }
      }
    }
  }

  private func currentOnlyHero(
    _ current: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> some View {
    let timing = current.currentTimingLabel(
      timeZone: convention.timeZone,
      locale: locale,
      strings: strings
    )
    return HeroCard(
      eyebrow: "\(strings.happeningNowCaps) · \(timing)",
      event: current,
      conventionID: convention.id
    ) {
      EmptyView()
    } detail: {
      if let place = current.shortPlace {
        Text(place).privacySensitive()
      }
      // The short form: the long one truncated at 41 and 45mm.
      Text(strings.noLaterSavedEventsShort)
    }
  }
}

/// The phone's "Other options this hour", by this watch's clock. Each row
/// opens the panel with an Add button. Draws nothing without options.
private struct OtherOptionsSection: View {
  @Environment(\.locale) private var locale
  let convention: ConPawsConventionSnapshot
  let options: [ConPawsEventSnapshot]
  let strings: ConPawsStrings

  var body: some View {
    if !options.isEmpty {
      SectionLabel(title: strings.otherOptionsThisHour)
      ForEach(options) { option in
        EventCard(
          eyebrow: ConPawsFormat.timeRange(option, in: convention, locale: locale),
          event: option,
          conventionID: convention.id,
          accented: false,
          route: .option(conventionID: convention.id, eventID: option.id)
        ) {
          if let place = option.shortPlace {
            Text(place).privacySensitive()
          }
        }
      }
    }
  }
}

/// No saved panels yet, but some running this hour: the empty state's words,
/// then the options to add from.
private struct NoPicksOptionsView: View {
  let convention: ConPawsConventionSnapshot
  let options: [ConPawsEventSnapshot]
  let now: Date
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: WatchMetrics.cardSpacing) {
        VStack(spacing: 4) {
          Text(strings.noPicksTitle)
            .font(.headline)
            .accessibilityAddTraits(.isHeader)
          Text(strings.noPicksWatchMessage)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 6)
        .accessibilityElement(children: .combine)

        OtherOptionsSection(convention: convention, options: options, strings: strings)

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: now)
            .padding(.horizontal, WatchMetrics.cardInset)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
  }
}

/// The finished state's message, centered under the header.
private struct FinishedStatusView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "checkmark.circle")
        .font(.title2)
        .foregroundStyle(Color.accentColor)
        .accessibilityHidden(true)
      Text(strings.finishedTitle)
        .font(.headline)
      // Only while the convention is still on, when adding a panel on the
      // phone is still worth doing. The watch has no schedule to browse, so
      // this points at the phone rather than at "the schedule in ConPaws".
      if convention.endDate > now {
        Text(strings.openOnIphone)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity)
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}

/// A label between cards, inset to the cards' text edge.
private struct SectionLabel: View {
  let title: String

  var body: some View {
    Text(title)
      .font(.caption2.bold())
      .foregroundStyle(.secondary)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.top, 2)
      .accessibilityAddTraits(.isHeader)
  }
}

/// The card that answers "what now": the next event, or the running one when
/// nothing follows it. Tinted so it stands apart from the Later cards.
private struct HeroCard<Value: View, Detail: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let eyebrow: String
  let event: ConPawsEventSnapshot
  let conventionID: String
  @ViewBuilder var value: Value
  @ViewBuilder var detail: Detail

  var body: some View {
    NavigationLink(value: WatchRoute.event(conventionID: conventionID, eventID: event.id)) {
      VStack(alignment: .leading, spacing: 2) {
        Text(eyebrow)
          .font(.caption2.bold())
          .foregroundStyle(Color.accentColor)
        // Directly under its eyebrow, so "STARTS IN" and its timer read as
        // one phrase instead of having the title between them.
        value
          .font(.title3.bold())
          .monospacedDigit()
          .foregroundStyle(Color.accentColor)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(event.title)
          .font(.headline)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 3)
          .privacySensitive()
          .padding(.top, 1)
        VStack(alignment: .leading, spacing: 1) {
          detail
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 9)
      .cardBackground(Color.accentColor.opacity(0.22))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

private struct EventCard<Detail: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let eyebrow: String
  let event: ConPawsEventSnapshot
  let conventionID: String
  var accented = true
  /// Where the card leads; a saved event's detail unless told otherwise.
  var route: WatchRoute?
  @ViewBuilder var detail: Detail

  var body: some View {
    NavigationLink(value: route ?? WatchRoute.event(conventionID: conventionID, eventID: event.id)) {
      VStack(alignment: .leading, spacing: 3) {
        // Callers hand this over in the case it is drawn in. Upper-casing here
        // instead would also hit the clock times the later-event cards use as
        // their label, and would do it with the wrong language's casing rules.
        Text(eyebrow)
          .font(.caption2.bold())
          .foregroundStyle(accented ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.secondary))
        Text(event.title)
          .font(.headline)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
        VStack(alignment: .leading, spacing: 1) {
          detail
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 8)
      .cardBackground(.quaternary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

/// A time and a room: one line when both fit, stacked when they do not.
///
/// Always two Text views, never one string. Always On redacts the room and
/// must leave the time beside it readable; a joined "2:00 PM · Studio B"
/// could only hide both or neither.
private struct TimeAndPlace: View {
  let time: String
  let place: String?

  var body: some View {
    if let place {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 4) {
          Text(time)
          Text(verbatim: "·")
            .accessibilityHidden(true)
          Text(place)
            .privacySensitive()
        }
        .lineLimit(1)

        VStack(alignment: .leading, spacing: 1) {
          Text(time)
          Text(place)
            .privacySensitive()
        }
      }
    } else {
      Text(time)
    }
  }
}

private struct TodayLinkRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let count: Int
  let strings: ConPawsStrings

  var body: some View {
    // At accessibility sizes the count drops under the label instead of
    // squeezing "Today" down to a few letters.
    let layout = dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
      : AnyLayout(HStackLayout(spacing: 6))

    NavigationLink(value: WatchRoute.today) {
      layout {
        Label(strings.today, systemImage: "list.bullet")
          .frame(maxWidth: .infinity, alignment: .leading)
        Text("\(count)")
          .foregroundStyle(.secondary)
      }
      .font(.body)
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 4)
      .cardBackground(.quaternary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("\(strings.today), \(strings.events(count))")
  }
}

private struct TodayListView: View {
  @Environment(\.locale) private var locale
  @Environment(\.redactionReasons) private var redactionReasons
  /// One-shot, so coming back from a detail screen keeps the reader's place
  /// instead of jumping back to the running event.
  @State private var didScrollToNow = false
  let schedule: WatchScheduleProjection
  let strings: ConPawsStrings

  var body: some View {
    Group {
      if let convention = schedule.convention, !schedule.todayEvents.isEmpty {
        list(convention)
      } else {
        emptyState
      }
    }
    .navigationTitle(strings.today)
  }

  private func list(_ convention: ConPawsConventionSnapshot) -> some View {
    ScrollViewReader { proxy in
      List(schedule.todayEvents) { event in
        let isRunning = event.id == schedule.activeEvent?.id
        let hasEnded = ConPawsScheduleResolver.effectiveEnd(of: event) <= schedule.now
        let timeRange = ConPawsFormat.timeRange(event, in: convention, locale: locale)
        NavigationLink(value: WatchRoute.event(conventionID: convention.id, eventID: event.id)) {
          TodayRow(
            event: event,
            timeRange: timeRange,
            isRunning: isRunning,
            hasEnded: hasEnded
          )
        }
        // This label replaces the row's Texts, so their `privacySensitive`
        // never reaches it: wrist-down it must leave the title and room out
        // itself and speak only the time that stays drawn.
        .accessibilityLabel(
          redactionReasons.contains(.privacy)
            ? timeRange
            : [event.title, timeRange, event.shortPlace].compactMap { $0 }.joined(separator: ", ")
        )
        // The accent bar and the check are hidden from VoiceOver, so the
        // running row and the ended ones say so.
        .accessibilityValue(isRunning ? strings.now : hasEnded ? strings.ended : "")
      }
      // ponytail: plain, not .carousel — carousel scales rows toward the
      // screen center, so a single-event day renders as an oversized slab.
      .listStyle(.plain)
      .task {
        // Open at now rather than at the first panel of the morning. In a
        // task, not onAppear, so the scroll lands after the list has laid out.
        guard !didScrollToNow else { return }
        didScrollToNow = true
        if let target = scrollTarget {
          proxy.scrollTo(target, anchor: .top)
        }
      }
    }
  }

  /// The running event, else the next to start; nil leaves the list at the top.
  private var scrollTarget: String? {
    let events = schedule.todayEvents
    if let active = schedule.activeEvent?.id, events.contains(where: { $0.id == active }) {
      return active
    }
    return events.first { $0.startDate > schedule.now }?.id
  }

  @ViewBuilder private var emptyState: some View {
    switch schedule.state {
    case .noConvention:
      EmptyScheduleView(
        title: strings.noScheduleTitle,
        message: strings.noScheduleMessage,
        systemImage: "iphone"
      )
    case .noPicks where schedule.isOverWithoutPicks:
      EmptyScheduleView(
        title: strings.nothingUpcomingTitle,
        message: strings.nothingUpcomingMessage,
        systemImage: "checkmark.circle"
      )
    case .noPicks:
      EmptyScheduleView(title: strings.noPicksTitle, message: strings.noPicksWatchMessage)
    case .finished:
      // Not "No more panels today": that was wrong on every day after the
      // convention, and this screen is about today's list.
      EmptyScheduleView(
        title: strings.noEventsTodayTitle,
        message: strings.finishedTitle,
        systemImage: "checkmark.circle"
      )
    case .next, .countdown:
      EmptyScheduleView(title: strings.noEventsTodayTitle, message: strings.noEventsTodayMessage)
    case .currentOnly:
      EmptyScheduleView(title: strings.happeningNowCaps, message: strings.noLaterSavedEvents)
    }
  }
}

private struct TodayRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let event: ConPawsEventSnapshot
  let timeRange: String
  let isRunning: Bool
  let hasEnded: Bool

  var body: some View {
    HStack(spacing: 6) {
      if isRunning {
        // Mockup frame 2: the running event is marked, not styled by
        // color alone — a bar plus the accent both carry it.
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
          .fill(Color.accentColor)
          .frame(width: 3)
          .accessibilityHidden(true)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(event.title)
          .font(.body.weight(.semibold))
          .foregroundStyle(hasEnded ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.primary)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
        HStack(spacing: 3) {
          // Ended rows carry a check as well as the dimmer title, by the same
          // rule as the running bar: state is never shown by color alone.
          if hasEnded {
            Image(systemName: "checkmark")
              .accessibilityHidden(true)
          }
          Text(timeRange)
        }
        .font(.caption2)
        .foregroundStyle(isRunning ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.secondary))
        if let place = event.shortPlace {
          Text(place)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .privacySensitive()
        }
      }
    }
    .frame(minHeight: 44, alignment: .leading)
  }
}

/// Add or remove, as the detail screen's last control.
private struct WatchPlanAction {
  enum Kind {
    case add
    case remove
  }

  let kind: Kind
  /// Sent and not yet confirmed by a snapshot from the phone.
  let isPending: Bool
  let perform: () -> Void
}

private struct EventDetailView: View {
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings
  var planAction: WatchPlanAction?
  /// The panel was just added from this screen; say so once it is confirmed.
  var confirmsSaved = false

  private var hasEnded: Bool {
    ConPawsScheduleResolver.effectiveEnd(of: event) <= now
  }

  var body: some View {
    // No navigation title: the event's own title is the heading, as watchOS
    // 10 lays out pushed screens. A generic "Event" in the bar said nothing.
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text(event.title)
          .font(.headline)
          .fixedSize(horizontal: false, vertical: true)
          .privacySensitive()
          .accessibilityAddTraits(.isHeader)

        savedConfirmation

        status

        if let rating = event.ageRating {
          Text(rating)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.quaternary, in: .capsule)
            .privacySensitive()
        }

        Label {
          Text(clockLabel)
            .foregroundStyle(hasEnded ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.primary)
        } icon: {
          // A check once it is over, so an ended event is not marked by a
          // dimmer color alone.
          Image(systemName: hasEnded ? "checkmark.circle" : "clock")
            .accessibilityHidden(true)
        }
        // The check is hidden, so VoiceOver hears the state in words.
        .accessibilityValue(hasEnded ? strings.ended : "")

        if let location = event.place {
          Label {
            Text(location)
              .privacySensitive()
          } icon: {
            Image(systemName: "mappin.and.ellipse")
              .accessibilityHidden(true)
          }
        }

        // The Home card's rule: only while it is still to come. Kept after it
        // fired, it read as a reminder still coming on a running panel.
        if let reminder = ConPawsFormat.upcomingReminderAt(
          event, now: now, in: convention, locale: locale, strings: strings
        ) {
          Label {
            Text(reminder)
          } icon: {
            Image(systemName: "bell")
              .accessibilityHidden(true)
          }
        }

        if let summary = event.summary {
          VStack(alignment: .leading, spacing: 2) {
            Text(strings.aboutThisPanel)
              .font(.caption2.bold())
              .foregroundStyle(.secondary)
              .accessibilityAddTraits(.isHeader)
            // Hidden wrist-down like the title: a description can say as much.
            Text(summary)
              .font(.footnote)
              .fixedSize(horizontal: false, vertical: true)
              .privacySensitive()
          }
          .padding(.top, 4)
        }

        if let planAction {
          PlanActionButton(action: planAction, eventTitle: event.title, strings: strings)
            .padding(.top, 6)
        }
      }
      .font(.callout)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
    }
    .onAppear {
      // The branch that draws this replaces the option screen the moment the
      // phone confirms, so appearing is the confirmation.
      if confirmsSaved {
        AccessibilityNotification.Announcement(strings.saved).post()
      }
    }
  }

  @ViewBuilder private var savedConfirmation: some View {
    if confirmsSaved {
      Label {
        Text(strings.saved)
      } icon: {
        Image(systemName: "checkmark.circle.fill")
          .accessibilityHidden(true)
      }
      .font(.caption.bold())
      .foregroundStyle(Color.accentColor)
    }
  }

  /// Running, about to start, or later today -- in the words the Home cards
  /// already use. Another day says nothing here; the clock line names the day.
  @ViewBuilder private var status: some View {
    let start = event.startDate
    if start <= now, !hasEnded {
      Text(
        "\(strings.happeningNowCaps) · \(event.currentTimingLabel(timeZone: convention.timeZone, locale: locale, strings: strings))"
      )
      .font(.caption2.bold())
      .foregroundStyle(Color.accentColor)
    } else if ConPawsCountdown.showsLiveTimer(
      from: now,
      to: start,
      within: ConPawsCountdown.eventTimerWindow
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(strings.startsInCaps)
          .font(.caption2.bold())
        AdaptiveCountdownView(
          target: start,
          now: now,
          timeZone: convention.timeZone,
          showsTimer: true,
          strings: strings
        )
        .font(.title3.bold())
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      }
      .foregroundStyle(Color.accentColor)
      .accessibilityElement(children: .combine)
    } else if start > now,
      ConPawsFormat.dayLabel(start, relativeTo: now, in: convention, locale: locale, strings: strings) == nil
    {
      Text(ConPawsCountdown.label(from: now, to: start, timeZone: convention.timeZone, strings: strings))
        .font(.caption.bold())
        .foregroundStyle(Color.accentColor)
    }
  }

  /// "Tomorrow · 10:00–11:30 AM" once the event is not today.
  private var clockLabel: String {
    let range = ConPawsFormat.timeRange(event, in: convention, locale: locale)
    guard
      let day = ConPawsFormat.dayLabel(
        event.startDate,
        relativeTo: now,
        in: convention,
        locale: locale,
        strings: strings
      )
    else { return range }
    return "\(day) · \(range)"
  }
}

/// "Add to my plan" straight away; "Remove from my plan" after a
/// confirmation, since it also drops the reminder and any visit.
///
/// While the phone has not confirmed, the label is a spinner and the button
/// is disabled, so a second tap cannot send a second command. A line under it
/// says what a long wait needs and when the phone did not make the change
/// (see `WatchPlanNote`).
private struct PlanActionButton: View {
  @Environment(\.redactionReasons) private var redactionReasons
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  let action: WatchPlanAction
  let eventTitle: String
  let strings: ConPawsStrings
  @State private var isConfirmingRemoval = false
  @State private var note = WatchPlanNote.none

  private var actionTitle: String {
    action.kind == .add ? strings.addToPlan : strings.removeFromPlan
  }

  /// A dialog title cannot be marked `privacySensitive`, so wrist-down it
  /// names the action instead of the panel, the way every other title on
  /// these screens is hidden.
  private var dialogTitle: String {
    redactionReasons.contains(.privacy) || isLuminanceReduced
      ? strings.removeFromPlan
      : eventTitle
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Button(role: action.kind == .remove ? .destructive : nil) {
        switch action.kind {
        case .add: action.perform()
        case .remove: isConfirmingRemoval = true
        }
      } label: {
        if action.isPending {
          ProgressView()
            // Alone it read the system's "In progress", in the watch's
            // language rather than the app's, and named no action.
            .accessibilityLabel(actionTitle)
        } else {
          Text(actionTitle)
        }
      }
      .disabled(action.isPending)
      .confirmationDialog(dialogTitle, isPresented: $isConfirmingRemoval, titleVisibility: .visible) {
        Button(strings.remove, role: .destructive, action: action.perform)
      }

      if let text = note.text(strings) {
        Text(text)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
    .onChange(of: action.isPending) { wasPending, isPending in
      let next = note.after(wasPending: wasPending, isPending: isPending)
      if next == .notChanged, note != .notChanged {
        AccessibilityNotification.Announcement(strings.notChanged).post()
      }
      note = next
    }
    .task(id: action.isPending) {
      // Named only once the wait outlasts a running phone app; a new task
      // replaces this one, cancelling the sleep, whenever the wait ends.
      guard action.isPending else { return }
      guard (try? await Task.sleep(for: .seconds(WatchPlanNote.waitingDelay))) != nil else { return }
      note = .waiting
    }
  }
}

private struct AdaptiveCountdownView: View {
  let target: Date
  let now: Date
  let timeZone: TimeZone
  /// Decided by the caller, once, so an eyebrow that reads STARTS IN and this
  /// view can never disagree about which form is showing.
  let showsTimer: Bool
  let strings: ConPawsStrings

  var body: some View {
    if showsTimer, target > now {
      // Inside its window the app keeps a live timer. Unlike a widget it is
      // on screen and refreshing, so it can honour per-second precision --
      // and this is the stretch where that precision is worth having.
      Text(timerInterval: now...target, countsDown: true)
        .accessibilityLabel(
          strings.remaining(
            ConPawsFormat.countdownDuration(from: now, to: target, in: timeZone, strings: strings)
          )
        )
    } else {
      // Further out, read the same ladder the complication and the iPhone
      // Lock Screen read. The app used to say "12 D 9 H" here while its own
      // complication said "In 12 days" about the same wait.
      Text(ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings))
    }
  }
}

private struct SavedScheduleLabel: View {
  @Environment(\.locale) private var locale
  let strings: ConPawsStrings
  var snapshotDate: Date?
  let now: Date
  var alignment: TextAlignment = .leading

  private var updatedText: String? {
    snapshotDate.map { ConPawsSnapshotAge.updatedText(since: $0, now: now, locale: locale) }
  }

  private var stackAlignment: HorizontalAlignment {
    switch alignment {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }

  var body: some View {
    // Modifiers go on the stack: an `if` is not a view to modify. The symbol
    // carries "this may be out of date", which used to be a third line.
    if let updatedText {
      VStack(alignment: stackAlignment, spacing: 1) {
        Label {
          Text(strings.text(strings.lastUpdatedFormat, updatedText))
        } icon: {
          Image(systemName: "exclamationmark.arrow.circlepath")
        }
        Text(strings.openOnIphone)
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(alignment)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(strings.text(strings.staleA11yFormat, updatedText))
    }
  }
}

private struct EmptyScheduleView: View {
  let title: String
  let message: String
  var systemImage = "calendar"

  var body: some View {
    // Scrollable at accessibility sizes for the same reason PreConventionView
    // is: the message — the only text telling the user how to recover —
    // clipped with no way to reach it.
    CenteredScrollView {
      VStack(spacing: 8) {
        Image(systemName: systemImage)
          .font(.title2)
          .foregroundStyle(Color.accentColor)
          .accessibilityHidden(true)
        Text(title)
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, 10)
      .accessibilityElement(children: .combine)
    }
  }
}

/// Centers short content on the screen and scrolls it once it outgrows the
/// screen (large Dynamic Type, long translations), so it never clips.
private struct CenteredScrollView<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    ViewThatFits(in: .vertical) {
      content
      ScrollView {
        content
      }
    }
  }
}

/// Shared measurements, so the header, the section labels and the text inside
/// the cards start at one leading edge.
private enum WatchMetrics {
  /// A card's inner horizontal padding, and the inset of every label between
  /// cards.
  static let cardInset: CGFloat = 10
  static let cardSpacing: CGFloat = 10
  static let cornerRadius: CGFloat = 12
}

/// A card's platter, dropped in Always On as Apple's Always On guidance asks:
/// on the dimmed display a filled card reads as a lit slab, and the text alone
/// carries the layout. Reading `isLuminanceReduced` here, in a leaf modifier,
/// keeps the wrist-down switch from invalidating the whole screen.
private struct CardBackground<Style: ShapeStyle>: ViewModifier {
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  let style: Style

  func body(content: Content) -> some View {
    content.background {
      if !isLuminanceReduced {
        RoundedRectangle(cornerRadius: WatchMetrics.cornerRadius, style: .continuous)
          .fill(style)
      }
    }
  }
}

private extension View {
  func cardBackground<Style: ShapeStyle>(_ style: Style) -> some View {
    modifier(CardBackground(style: style))
  }
}

#if DEBUG
/// Snapshots for the canvas, built around the moment the preview renders.
private enum WatchPreviewFixtures {
  static let now = Date()

  private static var calendar: Calendar {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = .autoupdatingCurrent
    return calendar
  }

  /// `hour` o'clock, `days` from today.
  private static func at(days: Int, hour: Int) -> Date {
    let day = calendar.date(byAdding: .day, value: days, to: calendar.startOfDay(for: now)) ?? now
    return calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day) ?? day
  }

  private static func event(
    _ id: String,
    _ title: String,
    from start: Date,
    minutes: Double = 60,
    room: String? = "Studio B",
    reminderMinutes: Int? = nil,
    ageRating: String? = nil,
    summary: String? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: title,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: start.addingTimeInterval(minutes * 60).timeIntervalSince1970 * 1_000,
      location: "ConPaws Convention Center",
      room: room,
      reminderMinutes: reminderMinutes,
      ageRating: ageRating,
      summary: summary
    )
  }

  private static func snapshot(
    _ events: [ConPawsEventSnapshot],
    options: [ConPawsEventSnapshot]? = nil
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "preview-convention",
          name: "ConPaws Preview Con",
          startAtMs: at(days: -1, hour: 0).timeIntervalSince1970 * 1_000,
          endAtMs: at(days: 4, hour: 23).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
          dateRangeLabel: "Preview dates",
          events: events,
          options: options
        ),
      ]
    )
  }

  /// Today's pick is over and three are left. Three, not two: Up Next takes
  /// the first, so only the other two can show under Later.
  static var later: ConPawsSnapshot {
    snapshot([
      event("ended", "Opening Ceremonies", from: now.addingTimeInterval(-7_200), room: "Main Ballroom"),
      event("tomorrow-10", "Tabletop Games 101", from: at(days: 1, hour: 10)),
      event("tomorrow-11", "Music Production Workshop", from: at(days: 1, hour: 11), room: "Hall A"),
      event("later-14", "Maker Skills Roundtable", from: at(days: 3, hour: 14), ageRating: "18+ Adult"),
    ])
  }

  /// A panel running now and the next starting in 20 minutes inside its
  /// 30-minute reminder: the leave window, with a ticking timer.
  static var leaveWindow: ConPawsSnapshot {
    snapshot([
      event("running", "Fursuit Parade Staging", from: now.addingTimeInterval(-1_800), room: "Main Ballroom"),
      event("next", "Fursuit Meetup", from: now.addingTimeInterval(1_200), room: "Hall A", reminderMinutes: 30),
      event("after", "Art Show Tour", from: now.addingTimeInterval(7_200)),
    ])
  }

  /// Saved panels plus two unsaved ones in this hour, with descriptions.
  static var options: ConPawsSnapshot {
    let hour = calendar.dateInterval(of: .hour, for: now)?.start ?? now
    return snapshot(
      [
        event(
          "running",
          "Fursuit Parade Staging",
          from: now.addingTimeInterval(-1_800),
          room: "Main Ballroom",
          summary: "Line up by colour group. Handlers stay with their suiters until the parade leaves."
        ),
        event("after", "Art Show Tour", from: now.addingTimeInterval(7_200)),
      ],
      options: [
        event(
          "option-1",
          "Beginner Fursuit Making",
          from: hour.addingTimeInterval(1_800),
          room: "Hall B",
          summary: "Foam, fleece and patterning basics. Bring nothing; materials are provided."
        ),
        event("option-2", "Writers' Circle", from: hour, room: "Studio C"),
      ]
    )
  }

  /// Nothing saved yet, with the same two options running this hour.
  static var noPicksWithOptions: ConPawsSnapshot {
    snapshot([], options: options.conventions[0].options)
  }

  static var savedPanel: (event: ConPawsEventSnapshot, convention: ConPawsConventionSnapshot) {
    let convention = options.conventions[0]
    return (convention.events[0], convention)
  }
}

#Preview("Home · Later") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.later,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.later.locale)
}

#Preview("Home · Options") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.options,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.options.locale)
}

#Preview("Home · No picks, options") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.noPicksWithOptions,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.noPicksWithOptions.locale)
}

#Preview("Detail · Remove") {
  let found = WatchPreviewFixtures.savedPanel
  NavigationStack {
    EventDetailView(
      event: found.event,
      convention: found.convention,
      now: WatchPreviewFixtures.now,
      strings: .english,
      planAction: WatchPlanAction(kind: .remove, isPending: false) {}
    )
  }
}

#Preview("Detail · Pending") {
  let found = WatchPreviewFixtures.savedPanel
  NavigationStack {
    EventDetailView(
      event: found.event,
      convention: found.convention,
      now: WatchPreviewFixtures.now,
      strings: .english,
      planAction: WatchPlanAction(kind: .add, isPending: true) {}
    )
  }
}

#Preview("Home · Always On") {
  // The canvas cannot drop a wrist, so this sets what the system sets: the
  // dimmed display and the privacy redaction. Titles and rooms should turn to
  // bars; the timer, the clock times and the convention name should not.
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.leaveWindow,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.leaveWindow.locale)
  .environment(\.isLuminanceReduced, true)
  .environment(\.redactionReasons, .privacy)
}
#endif
