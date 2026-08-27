import Foundation

/// Countdown text and timeline scheduling shared by the iPhone and Watch
/// widgets.
///
/// Widgets are refreshed on the system's schedule, not ours, so a label has to
/// stay true for as long as it might sit on screen. Two rules follow from that:
///
/// - The smallest unit shown is a whole hour. Seconds and minutes imply a
///   precision a widget refreshed on someone else's schedule cannot deliver.
/// - The timeline carries an entry for every moment the text would change,
///   rather than one entry and a refresh request. WidgetKit renders those
///   pre-built entries itself, so the countdown stays correct even when the
///   system declines to wake the extension.
enum ConPawsCountdown {
  /// Longest a single label is allowed to remain on screen before an entry
  /// exists to replace it.
  static let maximumEntries = 24

  /// How much of a wait is left, in the only terms these widgets are willing
  /// to state.
  ///
  /// Every rendering switches on this rather than re-deriving its own
  /// thresholds, so a Lock Screen rectangle reading "Tomorrow" can never sit
  /// beside a circle reading "2d".
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

    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = timeZone
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

  /// The same ladder compressed to the handful of characters a Lock Screen
  /// circular gauge can hold.
  ///
  /// `today` and `tomorrow` both read as "1d": both are a full day or more
  /// out, and `today` only arises when a DST-lengthened day pushes a 24-hour
  /// gap back onto the same calendar date.
  static func compactLabel(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    switch remaining(from: from, to: to, timeZone: timeZone) {
    case .now: strings.compactNow
    case .soon: strings.compactSoon
    case .hours(let hours): strings.compactHours(hours)
    case .today, .tomorrow: strings.compactDays(1)
    case .days(let days): strings.compactDays(days)
    case .months(let months): strings.compactMonths(months)
    }
  }

  /// The stretch of the wait a Lock Screen ring is scaled to.
  static let ringWindow: TimeInterval = 7 * 86_400

  /// How full the Lock Screen countdown ring should be, from 0 to 1.
  ///
  /// Scaled to the final week rather than the whole wait. A ring that barely
  /// moves for two months reads as broken, and the week before a convention
  /// is the stretch worth glancing at.
  ///
  /// Like the wording, this only redraws at the moments `changePoints`
  /// already emits -- daily beyond a day out, hourly inside one -- so the
  /// ring steps rather than sweeps. Same limit, same reason.
  static func ringProgress(from: Date, to: Date) -> Double {
    let remaining = to.timeIntervalSince(from)
    if remaining <= 0 { return 1 }
    if remaining >= ringWindow { return 0 }
    return 1 - (remaining / ringWindow)
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

    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = timeZone

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

    // Further out, the wording only turns over at local midnight.
    return calendar.nextDate(
      after: date,
      matching: DateComponents(hour: 0, minute: 0, second: 0),
      matchingPolicy: .nextTime
    )
  }
}
