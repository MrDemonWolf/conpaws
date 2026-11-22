import Foundation

/// Countdown text and timeline scheduling for the Watch complication, which
/// the Watch app's worded countdowns share.
///
/// A complication is refreshed on the system's schedule, not ours, so a label
/// has to stay true for as long as it might sit on screen. Two rules follow
/// from that:
///
/// - Outside the leave window the smallest unit shown is a whole hour.
///   Seconds and minutes imply a precision a complication refreshed on
///   someone else's schedule cannot deliver.
/// - The timeline carries an entry for every moment the text would change,
///   rather than one entry and a refresh request. WidgetKit renders those
///   pre-built entries itself, so the countdown stays correct even when the
///   system declines to wake the extension.
enum ConPawsCountdown {
  /// The most change points one call returns. The caller plans again from
  /// the last one.
  static let maximumEntries = 24

  /// How much of a wait is left, in the only terms these countdowns are
  /// willing to state.
  private enum Remaining {
    case now
    case soon
    case hours(Int)
    case today
    case tomorrow
    case days(Int)
    case months(Int)
  }

  private static func remaining(from: Date, to: Date, timeZone: TimeZone) -> Remaining {
    let seconds = to.timeIntervalSince(from)
    if seconds <= 0 { return .now }

    // The final hour is one label, not a per-minute countdown. Minutes would
    // need an entry each, which exhausts the timeline budget inside a single
    // hour and leaves nothing for the transition that actually matters.
    if seconds < 3_600 { return .soon }

    if seconds < 86_400 { return .hours(Int(seconds / 3_600)) }

    let calendar = ConPawsCalendar.convention(in: timeZone)
    // Count calendar days, not 24-hour blocks. An event 23 hours away can
    // still be "Tomorrow", and one 25 hours away can still be "Tomorrow" too.
    let startOfFrom = calendar.startOfDay(for: from)
    let startOfTo = calendar.startOfDay(for: to)
    let days = calendar.dateComponents([.day], from: startOfFrom, to: startOfTo).day ?? 0

    if days <= 0 { return .today }
    if days == 1 { return .tomorrow }
    if days < 30 { return .days(days) }

    let months = calendar.dateComponents([.month], from: startOfFrom, to: startOfTo).month ?? 0
    if months < 1 { return .days(days) }
    return .months(months)
  }

  /// Human-readable countdown for the gap between two dates.
  ///
  /// `timeZone` is the convention's, not the reader's: whether something is
  /// "Tomorrow" depends on the calendar day where the convention happens.
  /// `strings` is the app's language, which is not the phone's either.
  static func label(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    switch remaining(from: from, to: to, timeZone: timeZone) {
    case .now: strings.now
    case .soon: strings.startingSoon
    case .hours(let hours): strings.inHours(hours)
    case .today: strings.today
    case .tomorrow: strings.tomorrow
    case .days(let days): strings.inDays(days)
    case .months(let months): strings.inMonths(months)
    }
  }

  /// The leave window's countdown, "Starts in 18 min": whole minutes inside
  /// the final hour, the shared ladder above it.
  ///
  /// The leave window is the one place the hour floor gives way. It is
  /// minutes wide by definition, and `leaveChangePoints` pre-builds an entry
  /// for every minute so the label never overpromises. Above an hour it uses
  /// the inline starts-in phrasing, because gluing the lead onto a label that
  /// already carries its own "In" reads twice.
  static func leaveLead(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    guard let minutes = leaveMinutes(from: from, to: to) else {
      return strings.text(
        strings.inlineStartsFormat,
        strings.midSentenceCountdown(
          label(from: from, to: to, timeZone: timeZone, strings: strings)
        )
      )
    }
    return "\(strings.startsIn) \(strings.compactMinutes(minutes))"
  }

  /// How close a panel's start must be before the watch app ticks a timer.
  /// The Up Next card and the detail screen both use it, so they never
  /// disagree about the same panel. Every reminder the app offers is an hour
  /// or less, so a leave window always falls inside it.
  static let eventTimerWindow: TimeInterval = 3_600
  /// The same for the convention's own start, on the pre-convention screen.
  static let conventionTimerWindow: TimeInterval = 86_400

  /// Whether a screen that redraws itself -- the watch app, not a widget --
  /// should show a ticking timer for this wait instead of the worded ladder.
  ///
  /// Inclusive at the edge of the window. The watch app ticks on minute
  /// boundaries and event and reminder times are whole minutes, so the tick
  /// that opens a 60-minute window lands on exactly 3,600 seconds; an
  /// exclusive test showed "In 1 hour" under a "STARTS IN" eyebrow for that
  /// first minute. Callers compute this once and hand the same answer to the
  /// eyebrow and the timer so the two cannot disagree.
  static func showsLiveTimer(from: Date, to: Date, within window: TimeInterval) -> Bool {
    let remaining = to.timeIntervalSince(from)
    return remaining > 0 && remaining <= window
  }

  /// Whole minutes remaining, or nil once the wait is an hour or more and the
  /// shared ladder takes over. Never below 1 so the countdown does not show 0.
  static func leaveMinutes(from: Date, to: Date) -> Int? {
    let remaining = to.timeIntervalSince(from)
    guard remaining < 3_600 else { return nil }
    return max(1, Int((remaining / 60).rounded(.up)))
  }

  /// Every moment between `from` and `to` at which the leave countdown would
  /// change: hourly while it reads on the shared ladder, then every minute
  /// inside the final hour. Capped like `changePoints`, and the caller
  /// re-plans from the last entry the same way.
  static func leaveChangePoints(
    from: Date,
    to: Date,
    limit: Int = maximumEntries
  ) -> [Date] {
    guard limit > 0, to > from else { return [] }

    var ticks: [Date] = []
    let totalHours = Int(to.timeIntervalSince(from) / 3_600)
    if totalHours >= 1 {
      for hoursLeft in stride(from: totalHours, through: 1, by: -1) {
        // The +1 lands just inside the new hour, same as the shared ladder.
        ticks.append(to.addingTimeInterval(TimeInterval(-hoursLeft * 3_600) + 1))
      }
    }
    let minutesSpan = min(59, Int(to.timeIntervalSince(from) / 60))
    if minutesSpan >= 1 {
      for minutesLeft in stride(from: minutesSpan, through: 1, by: -1) {
        ticks.append(to.addingTimeInterval(TimeInterval(-minutesLeft * 60)))
      }
    }

    var points = Array(ticks.filter { $0 > from }.sorted().prefix(limit))
    if points.count < limit {
      points.append(to)
    }
    return points
  }

  /// Every moment between `from` and `to` at which `label` would produce
  /// different text.
  ///
  /// Beyond a day out the text only changes at the convention's local
  /// midnight; inside a day it changes on the hour; inside the final hour it
  /// does not change at all. The list is capped, and the caller re-plans from
  /// the last entry.
  static func changePoints(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    limit: Int = maximumEntries
  ) -> [Date] {
    guard limit > 0, to > from else { return [] }

    let calendar = ConPawsCalendar.convention(in: timeZone)

    var points: [Date] = []
    var cursor = from

    while points.count < limit {
      guard let next = nextChange(after: cursor, to: to, calendar: calendar) else { break }
      guard next < to else { break }
      points.append(next)
      cursor = next
    }

    // The moment the wait ends always deserves an entry: it is the switch from
    // a countdown to "Now", and the most important frame of the sequence.
    if points.count < limit, to > from {
      points.append(to)
    }

    return points
  }

  private static func nextChange(
    after date: Date,
    to target: Date,
    calendar: Calendar
  ) -> Date? {
    let remaining = target.timeIntervalSince(date)
    if remaining <= 0 { return nil }

    // Inside the last hour the wording no longer changes, so the only entry
    // still owed is the target itself, which changePoints appends.
    if remaining <= 3_600 { return nil }

    if remaining <= 86_400 {
      // Step down one whole hour at a time. The +1 lands just inside the new
      // hour so the label reads the lower number rather than the boundary.
      let hoursLeft = Int(remaining / 3_600)
      return target.addingTimeInterval(TimeInterval(-hoursLeft * 3_600) + 1)
    }

    // Further out, the wording turns over at local midnight, and once more a
    // second after the wait drops under a day, where the hourly wording takes
    // over whatever the calendar day says. Waiting for midnight alone kept
    // "Tomorrow" on the card for most of a day after it should have read
    // "In 23 hours".
    let underADay = target.addingTimeInterval(-86_400 + 1)
    let midnight = calendar.nextDate(
      after: date,
      matching: DateComponents(hour: 0, minute: 0, second: 0),
      matchingPolicy: .nextTime
    )
    return midnight.map { min($0, underADay) } ?? underADay
  }
}
