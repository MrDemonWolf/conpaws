import Foundation

/// What the Watch complication shows at one moment, resolved from the snapshot
/// the phone last sent. Foundation-only, so swift-tests can cover it; the views
/// that draw each state stay in targets/watch-widget.
struct ConPawsComplicationProjection {
  enum State {
    case comingUp(ConPawsConventionSnapshot)
    case leave(ConPawsEventSnapshot?, ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case next(ConPawsEventSnapshot?, ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case current(ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case finished(ConPawsConventionSnapshot)
    case noPicks(ConPawsConventionSnapshot)
    case noConvention
  }

  let now: Date
  let resolved: ConPawsScheduleState
  /// When the snapshot turns stale; nil when it never does.
  let staleDate: Date?
  /// Every convention the resolver chose among, not only the one shown.
  let conventions: [ConPawsConventionSnapshot]

  var convention: ConPawsConventionSnapshot? {
    switch resolved {
    case .noConvention: nil
    case .countdown(let value), .finished(let value), .noPicks(let value): value
    case .next(let value, _, _), .currentOnly(let value, _): value
    }
  }

  var activeEvent: ConPawsEventSnapshot? {
    switch resolved {
    case .next(_, let current, _): current
    case .currentOnly(_, let event): event
    case .noConvention, .countdown, .finished, .noPicks: nil
    }
  }

  var nextEvent: ConPawsEventSnapshot? {
    if case .next(_, _, let upcoming) = resolved { return upcoming }
    return nil
  }

  var state: State {
    switch resolved {
    case .noConvention:
      .noConvention
    case .countdown(let convention):
      .comingUp(convention)
    case .next(let convention, let current, let upcoming):
      ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now)
        ? .leave(current, upcoming, convention)
        : .next(current, upcoming, convention)
    case .currentOnly(let convention, let event):
      .current(event, convention)
    case .finished(let convention):
      .finished(convention)
    case .noPicks(let convention):
      .noPicks(convention)
    }
  }

  var timeZone: TimeZone? { convention?.timeZone }

  var countdownTarget: Date? {
    switch state {
    case .comingUp(let convention): convention.startDate
    case .leave(_, let upcoming, _): upcoming.startDate
    case .next, .current, .finished, .noPicks, .noConvention: nil
    }
  }

  var isLeaveState: Bool {
    if case .leave = state { return true }
    return false
  }

  /// The moment the card turns stale, while that is still to come.
  var staleBoundary: Date? {
    staleDate.flatMap { $0 > now ? $0 : nil }
  }

  /// The next moment the state itself can change, or nil when nothing is
  /// scheduled to. A countdown's wording is not counted: its change points
  /// cover it up to its target.
  var nextChange: Date? {
    let lift = ConPawsComplicationTimeline.relevanceWindow
    var candidates: [Date] = []
    switch state {
    case .comingUp(let convention):
      candidates.append(convention.startDate)
      // An entry for the Smart Stack's relevance to start on.
      candidates.append(convention.startDate.addingTimeInterval(-lift))
    case .leave(let current, let upcoming, let convention),
      .next(let current, let upcoming, let convention):
      candidates.append(upcoming.startDate)
      candidates.append(upcoming.startDate.addingTimeInterval(-lift))
      if let current { candidates.append(ConPawsScheduleResolver.effectiveEnd(of: current)) }
      if let minutes = upcoming.reminderMinutes, minutes > 0 {
        candidates.append(upcoming.startDate.addingTimeInterval(-Double(minutes) * 60))
      }
      // "Tomorrow · 10:00 AM" turns into "10:00 AM" at the convention's
      // midnight, and nothing else would redraw the card then.
      let calendar = convention.calendar
      if !calendar.isDate(upcoming.startDate, inSameDayAs: now),
        let midnight = calendar.nextDate(
          after: now,
          matching: DateComponents(hour: 0, minute: 0, second: 0),
          matchingPolicy: .nextTime
        )
      {
        candidates.append(midnight)
      }
    case .current(let event, _):
      candidates.append(ConPawsScheduleResolver.effectiveEnd(of: event))
    case .finished, .noPicks, .noConvention:
      break
    }
    // Which convention the card follows can change wherever any of them
    // starts or stops counting as active, not only the one shown: one with
    // saved panels takes over from one without when it starts, and the next
    // one takes over just after the shown one ends.
    for convention in conventions {
      candidates.append(convention.startDate)
      candidates.append(convention.pastActiveDate)
    }
    // Strictly after `now`: the moment past an end is a millisecond away when
    // the walk stands on the end itself.
    return candidates.filter { $0 > now }.min()
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    self.now = now
    staleDate = ConPawsSnapshotAge.staleDate(of: snapshot)
    conventions = snapshot.conventions
    resolved = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
  }
}

/// The complication's timeline: an entry for every moment the card reads
/// differently, built ahead rather than left to the system waking the
/// extension on time. The Watch reloads it only when a new phone snapshot
/// arrives, and complications get an even smaller refresh budget than Home
/// Screen widgets, so a moment without an entry leaves an old card on screen.
enum ConPawsComplicationTimeline {
  /// How far ahead one timeline walks the schedule. The last entry ends it
  /// (`.atEnd`) and the system plans again from there.
  static let horizon: TimeInterval = 86_400
  /// Enough for a 60-minute leave window's per-minute countdown and more.
  static let maximumEntries = 64
  /// How long before and after a convention or panel start the Smart Stack
  /// rotates the card up.
  static let relevanceWindow: TimeInterval = 30 * 60
  /// How long a timeline lasts when nothing is scheduled to change.
  static let idleRefresh: TimeInterval = 6 * 3_600

  struct Entry: Equatable {
    let date: Date
    /// While non-nil, the Smart Stack should rotate the card up until then.
    let relevantUntil: Date?
  }

  /// Walks the schedule from `now`, one state change at a time: each step
  /// resolves the card at that moment, adds its countdown's change points and
  /// moves to the next change. The plan stops at the horizon, at the entry
  /// limit or where a capped countdown runs out, and it is complete up to its
  /// last entry, never past it.
  static func plan(
    snapshot: ConPawsSnapshot,
    now: Date,
    horizon: TimeInterval = horizon,
    limit: Int = maximumEntries
  ) -> [Entry] {
    var dates: Set<Date> = []
    var cursor = now
    var end: Date
    while true {
      let projection = ConPawsComplicationProjection(snapshot: snapshot, now: cursor)
      dates.insert(cursor)
      if let staleBoundary = projection.staleBoundary { dates.insert(staleBoundary) }
      let change = projection.nextChange
      var next = change ?? cursor.addingTimeInterval(idleRefresh)
      var walkOn = change != nil
      if let target = projection.countdownTarget, let zone = projection.timeZone {
        // The leave countdown reads in whole minutes, so it ticks per minute;
        // every other countdown rides the shared hourly ladder.
        let points = projection.isLeaveState
          ? ConPawsCountdown.leaveChangePoints(from: cursor, to: target, limit: limit)
          : ConPawsCountdown.changePoints(from: cursor, to: target, timeZone: zone)
        dates.formUnion(points)
        // A capped countdown is planned only as far as its last point.
        if let last = points.last, last < target, last < next {
          next = last
          walkOn = false
        }
      }
      if !walkOn || next > now.addingTimeInterval(horizon)
        || dates.count(where: { $0 < next }) >= limit
      {
        end = next
        break
      }
      cursor = next
    }
    dates.insert(end)

    return dates.filter { $0 <= end }.sorted().prefix(limit).map { date in
      Entry(date: date, relevantUntil: relevantUntil(snapshot: snapshot, at: date))
    }
  }

  /// Half an hour after the latest convention or saved-panel start within half
  /// an hour of `date`, or nil when there is none. A panel counts whether or
  /// not it has a reminder: starring one sets none.
  static func relevantUntil(snapshot: ConPawsSnapshot, at date: Date) -> Date? {
    guard
      let convention = ConPawsComplicationProjection(snapshot: snapshot, now: date).convention
    else { return nil }
    let starts = [convention.startDate] + convention.events.map(\.startDate)
    return starts
      .filter { start in
        date >= start.addingTimeInterval(-relevanceWindow)
          && date < start.addingTimeInterval(relevanceWindow)
      }
      .map { $0.addingTimeInterval(relevanceWindow) }
      .max()
  }
}

private extension ConPawsConventionSnapshot {
  /// The first moment the resolver no longer counts this convention as active
  /// or upcoming, a millisecond past the last one: an entry at the end itself
  /// still draws this convention.
  var pastActiveDate: Date {
    Date(timeIntervalSince1970: (ConPawsScheduleResolver.lastActiveMs(of: self) + 1) / 1_000)
  }
}
