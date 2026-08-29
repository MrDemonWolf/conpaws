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

  /// The leave window's countdown: whole minutes inside the final hour
  /// ("18 min"), the shared ladder above it.
  ///
  /// The leave window is the one place the hour floor gives way — it is
  /// minutes wide by definition, and `leaveChangePoints` pre-builds an entry
  /// for every minute so the label never overpromises.
  static func leaveCountdown(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    guard let minutes = leaveMinutes(from: from, to: to) else {
      return label(from: from, to: to, timeZone: timeZone, strings: strings)
    }
    return strings.compactMinutes(minutes)
  }

  /// The same countdown phrased as an instruction: "Leave in 18 min".
  ///
  /// Above an hour it falls back to the inline leave phrasing ("Leave in
  /// 2 hours"), because gluing `leaveIn` onto a label that already carries
  /// its own "In" reads twice.
  static func leaveLead(
    from: Date,
    to: Date,
    timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    guard let minutes = leaveMinutes(from: from, to: to) else {
      return strings.text(
        strings.inlineLeaveFormat,
        strings.midSentenceCountdown(
          label(from: from, to: to, timeZone: timeZone, strings: strings)
        )
      )
    }
    return "\(strings.leaveIn) \(strings.compactMinutes(minutes))"
  }

  /// Whole minutes remaining, or nil once the wait is an hour or more and the
  /// shared ladder takes over. Never below 1: a "0 min" instruction to leave
  /// reads as already too late, which "Now" handles instead.
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

  /// How full the leave window's circular gauge is, from 0 at the reminder to
  /// 1 at the event. Scaled to the window itself: it is minutes wide, so
  /// unlike the pre-con ring it can afford to move visibly.
  static func leaveProgress(from: Date, to: Date, windowMinutes: Int) -> Double {
    let window = TimeInterval(max(1, windowMinutes) * 60)
    let remaining = to.timeIntervalSince(from)
    if remaining <= 0 { return 1 }
    if remaining >= window { return 0 }
    return 1 - (remaining / window)
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
