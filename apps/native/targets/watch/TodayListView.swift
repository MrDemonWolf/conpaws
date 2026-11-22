import SwiftUI

struct TodayListView: View {
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
