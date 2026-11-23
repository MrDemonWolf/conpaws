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
    // The day's saved panels with the ones the convention withdrew among
    // them, so a cancelled panel stays where the reader expects it, marked.
    let rows = schedule.todayRows
    Group {
      if let convention = schedule.convention, !rows.isEmpty {
        list(rows, in: convention)
      } else {
        emptyState
      }
    }
    .navigationTitle(strings.today)
  }

  private func list(_ rows: [WatchTodayRow], in convention: ConPawsConventionSnapshot) -> some View {
    ScrollViewReader { proxy in
      List(rows) { row in
        let event = row.event
        // Never running or over: a withdrawn panel did not happen.
        let withdrawnLabel = row.status.map(strings.withdrawnStrings.label(for:))
        let isRunning = withdrawnLabel == nil && event.id == schedule.activeEvent?.id
        let hasEnded = withdrawnLabel == nil
          && ConPawsScheduleResolver.effectiveEnd(of: event) <= schedule.now
        let timeRange = ConPawsFormat.timeRange(event, in: convention, locale: locale)
        // A withdrawn panel opens the same screen, which then shows it marked
        // and offers only to remove it.
        NavigationLink(value: WatchRoute.event(conventionID: convention.id, eventID: event.id)) {
          TodayRow(
            event: event,
            timeRange: timeRange,
            isRunning: isRunning,
            hasEnded: hasEnded,
            withdrawnLabel: withdrawnLabel
          )
        }
        // This label replaces the row's Texts, so their `privacySensitive`
        // never reaches it: wrist-down it must leave the title and room out
        // itself and speak only the time that stays drawn. A withdrawn row
        // draws no room.
        .accessibilityLabel(
          redactionReasons.contains(.privacy)
            ? timeRange
            : [event.title, timeRange, withdrawnLabel == nil ? event.shortPlace : nil]
              .compactMap { $0 }
              .joined(separator: ", ")
        )
        // The accent bar, the check and the cross are hidden from VoiceOver,
        // so the running row, the ended ones and the withdrawn ones say so.
        .accessibilityValue(withdrawnLabel ?? (isRunning ? strings.now : hasEnded ? strings.ended : ""))
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
