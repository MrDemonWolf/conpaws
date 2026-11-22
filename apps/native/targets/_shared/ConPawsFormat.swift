import Foundation

/// Clock times, day names and spoken durations, shared by the Watch app and
/// its complication so the two describe the same panel in the same words.
///
/// Dates are formatted in the convention's time zone, not the wearer's, and in
/// the locale the snapshot asks for (`ConPawsSnapshot.locale`), not the
/// watch's. Formatters are made per call: a shared cache would be mutable
/// state reached from several threads, and a formatter or two per row is cheap
/// next to a screen that redraws once a minute.
enum ConPawsFormat {
  /// "2:00 PM", or "14:00" on a 24-hour clock.
  static func time(
    _ date: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> String {
    timeFormatter(in: convention, locale: locale).string(from: date)
  }

  /// "2:00 PM–3:30 PM", or the start alone while the end is unknown.
  static func timeRange(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> String {
    let formatter = timeFormatter(in: convention, locale: locale)
    let start = formatter.string(from: event.startDate)
    guard let end = event.endDate else { return start }
    return "\(start)–\(formatter.string(from: end))"
  }

  /// "Reminder at 1:50 PM · 10 min before", from the offset the user chose,
  /// or nil when the event has no reminder.
  static func reminderAt(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    guard let minutes = event.reminderMinutes, minutes >= 0 else { return nil }
    let reminderDate = event.startDate.addingTimeInterval(-Double(minutes) * 60)
    return strings.reminderAt(time(reminderDate, in: convention, locale: locale), minutes: minutes)
  }

  /// "Tomorrow" or a weekday for a date that is not today in the convention's
  /// time zone; nil for today, which needs no day.
  static func dayLabel(
    _ date: Date,
    relativeTo now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    let calendar = convention.calendar
    guard !calendar.isDate(date, inSameDayAs: now) else { return nil }

    if
      let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)),
      calendar.isDate(date, inSameDayAs: tomorrow)
    {
      return strings.tomorrow
    }

    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.timeZone = convention.timeZone
    formatter.setLocalizedDateFormatFromTemplate("EEEE")
    return formatter.string(from: date)
  }

  /// "11:30 PM" today, "Tomorrow · 12:30 AM", "Sunday · 10:00 AM": a bare
  /// time for another day read as later today.
  static func nextEventTime(
    _ date: Date,
    relativeTo now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String {
    let timeLabel = time(date, in: convention, locale: locale)
    guard
      let day = dayLabel(date, relativeTo: now, in: convention, locale: locale, strings: strings)
    else { return timeLabel }
    return "\(day) · \(timeLabel)"
  }

  /// How long the wait is, spoken as two units.
  ///
  /// Deliberately without "remaining" or its equivalents: the caller decides
  /// whether the duration stands alone or sits inside a longer sentence, and
  /// several languages phrase "remaining" as a prefix rather than a suffix.
  static func countdownDuration(
    from now: Date,
    to target: Date,
    in timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    let calendar = ConPawsCalendar.convention(in: timeZone)
    let parts = calendar.dateComponents([.month, .day, .hour, .minute], from: now, to: target)
    let months = max(0, parts.month ?? 0)
    let days = max(0, parts.day ?? 0)
    let hours = max(0, parts.hour ?? 0)
    let minutes = max(0, parts.minute ?? 0)

    if target.timeIntervalSince(now) >= 30 * 86_400 {
      return strings.duration(strings.months(months), strings.days(days))
    }
    if target.timeIntervalSince(now) >= 86_400 {
      return strings.duration(strings.days(days), strings.hours(hours))
    }
    return strings.duration(strings.hours(hours), strings.minutes(minutes))
  }

  private static func timeFormatter(
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> DateFormatter {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.timeZone = convention.timeZone
    formatter.timeStyle = .short
    return formatter
  }
}
