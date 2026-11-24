import Foundation

// Saved panels the convention withdrew, as the Watch app's Today list, detail
// screen and Home notice show them. Foundation-only, so swift-tests covers it.
// Nothing here feeds the resolver or the complication, which read only a
// convention's `events`; the complication compiles this folder and ignores it.

extension ConPawsConventionSnapshot {
  /// Withdrawn saved panels starting on `now`'s day in the convention's
  /// zone, the ones already over included, soonest first: the rows the Today
  /// list adds to the live ones, by the same day rule.
  func withdrawnStarting(onDayOf now: Date) -> [ConPawsWithdrawnEvent] {
    let calendar = calendar
    return (withdrawn ?? [])
      .filter { calendar.isDate($0.event.startDate, inSameDayAs: now) }
      .sorted(by: ConPawsWithdrawnEvent.isSoonerThan)
  }

  /// Withdrawn saved panels yet to end at `now`, soonest first: the ones the
  /// wearer might still walk to, which the Home notice counts. An unknown end
  /// counts as an hour, as it does for a live panel.
  func upcomingWithdrawn(at now: Date) -> [ConPawsWithdrawnEvent] {
    (withdrawn ?? [])
      .filter { ConPawsScheduleResolver.effectiveEnd(of: $0.event) > now }
      .sorted(by: ConPawsWithdrawnEvent.isSoonerThan)
  }
}

extension ConPawsWithdrawnEvent {
  /// By start, then by title, as the phone sorts them.
  static func isSoonerThan(_ lhs: ConPawsWithdrawnEvent, _ rhs: ConPawsWithdrawnEvent) -> Bool {
    lhs.event.startAtMs != rhs.event.startAtMs
      ? lhs.event.startAtMs < rhs.event.startAtMs
      : lhs.event.title.localizedCompare(rhs.event.title) == .orderedAscending
  }
}

extension ConPawsSnapshot {
  /// A withdrawn saved panel and its convention: what an event route shows
  /// once its panel is no longer live. Kept apart from `event(id:in:)`, which
  /// answers only for live panels, so no screen that offers to add a panel or
  /// confirms one saved can be handed a withdrawn one.
  func withdrawnEvent(
    id eventID: String,
    in conventionID: String
  ) -> (withdrawn: ConPawsWithdrawnEvent, convention: ConPawsConventionSnapshot)? {
    guard
      let convention = conventions.first(where: { $0.id == conventionID }),
      let withdrawn = convention.withdrawn?.first(where: { $0.id == eventID })
    else { return nil }
    return (withdrawn, convention)
  }
}

extension WatchScheduleProjection {
  /// Today's list: every saved panel starting today, with the day's
  /// withdrawn ones among them in start order.
  var todayRows: [WatchTodayRow] {
    WatchTodayRow.merging(
      saved: todayEvents,
      withdrawn: convention?.withdrawnStarting(onDayOf: now) ?? []
    )
  }

  /// The withdrawn saved panels still to come, for the Home notice.
  var upcomingWithdrawn: [ConPawsWithdrawnEvent] {
    convention?.upcomingWithdrawn(at: now) ?? []
  }

  /// Where the Home notice leads: the soonest panel it counts, which is the
  /// only one when there is one and otherwise the one that matters first.
  /// Not Today, which lists only today's and would miss a panel withdrawn
  /// from a later day. Nil when there is no notice.
  var withdrawnNoticeRoute: WatchRoute? {
    guard let convention, let soonest = upcomingWithdrawn.first else { return nil }
    return .event(conventionID: convention.id, eventID: soonest.id)
  }

  /// Whether the Home notice or Today has a withdrawn saved panel to lead
  /// to. The no-picks screen asks: with every saved panel withdrawn nothing
  /// is live, and that screen would otherwise hide them all.
  var hasWithdrawnToShow: Bool {
    !upcomingWithdrawn.isEmpty || todayRows.contains { $0.status != nil }
  }
}
