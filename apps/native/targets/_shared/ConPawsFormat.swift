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

  /// `reminderAt` while the reminder is still to come; nil once it has fired.
  ///
  /// The rule every Watch app screen reads: after the reminder fires,
  /// "Reminder at 1:50 PM" describes the past, and on a running panel's
  /// screen it read as a reminder still to come.
  static func upcomingReminderAt(
    _ event: ConPawsEventSnapshot,
    now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    guard ConPawsScheduleResolver.isReminderPending(event, now: now) else { return nil }
    return reminderAt(event, in: convention, locale: locale, strings: strings)
  }

  /// "1:50 PM · 10 min before": `upcomingReminderAt` without its words, for
  /// a line that draws a bell beside it. The whole sentence was cut to
  /// "Reminder at 11:43 AM · 10 minut…" on the Up Next card. A caller gives
  /// VoiceOver the sentence, which does not depend on seeing the bell.
  static func upcomingReminderTime(
    _ event: ConPawsEventSnapshot,
    now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    guard
      ConPawsScheduleResolver.isReminderPending(event, now: now),
      let minutes = event.reminderMinutes
    else { return nil }
    let reminderDate = event.startDate.addingTimeInterval(-Double(minutes) * 60)
    return "\(time(reminderDate, in: convention, locale: locale)) · \(strings.reminderOffset(minutes))"
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

  /// How long the wait is, spoken in at most two units: "1 hour, 30
  /// minutes", "18 minutes", "3 days".
  ///
  /// A unit that counts zero is left out, and the last minute is still "1
  /// minute". Months are used only once the wait is 30 days and a whole
  /// calendar month, as the visible ladder does, and each branch asks the
  /// calendar for its own two units alone: asking for months as well put a
  /// February wait of 28 days into "1 month" and left "0 days" to say.
  ///
  /// Deliberately without "remaining" or its equivalents: the caller decides
  /// whether the duration stands alone or sits inside a longer sentence, and
  /// several languages phrase "remaining" as a prefix rather than a suffix.
  /// The units are in the plain case, which is what "remaining" takes.
  static func countdownDuration(
    from now: Date,
    to target: Date,
    in timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    let calendar = ConPawsCalendar.convention(in: timeZone)
    let seconds = target.timeIntervalSince(now)

    if seconds >= 30 * 86_400 {
      let parts = calendar.dateComponents([.month, .day], from: now, to: target)
      let months = parts.month ?? 0
      if months >= 1 {
        return spokenPair(
          (months, strings.months),
          (parts.day ?? 0, strings.days),
          strings: strings
        )
      }
    }
    if seconds >= 86_400 {
      let parts = calendar.dateComponents([.day, .hour], from: now, to: target)
      return spokenPair(
        (parts.day ?? 0, strings.days),
        (parts.hour ?? 0, strings.hours),
        strings: strings
      )
    }
    let parts = calendar.dateComponents([.hour, .minute], from: now, to: target)
    let hours = max(0, parts.hour ?? 0)
    let minutes = max(0, parts.minute ?? 0)
    if hours == 0 { return strings.minutes(max(1, minutes)) }
    return spokenPair((hours, strings.hours), (minutes, strings.minutes), strings: strings)
  }

  /// Two counted units, without whichever of them is zero.
  private static func spokenPair(
    _ first: (count: Int, unit: (Int) -> String),
    _ second: (count: Int, unit: (Int) -> String),
    strings: ConPawsStrings
  ) -> String {
    switch (first.count > 0, second.count > 0) {
    case (true, true): strings.duration(first.unit(first.count), second.unit(second.count))
    case (true, false): first.unit(first.count)
    case (false, _): second.unit(max(1, second.count))
    }
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
