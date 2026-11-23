import Foundation
import Testing
@testable import ConPawsShared

/// The clock times, day names and spoken durations the Watch app and the
/// complication both draw. The convention is in Chicago, so a Mac in any other
/// zone formats against the wrong clock if a formatter forgets the
/// convention's zone. Instants are seconds since 1970, with their Chicago
/// wall-clock time beside them.
struct ConPawsFormatTests {
  private let english = Locale(identifier: "en_US")
  private let german = Locale(identifier: "de_DE")
  private let convention = ConPawsConventionSnapshot(
    id: "con",
    name: "Convention",
    startAtMs: 1_795_186_800_000, // Fri 20 Nov 2026, 09:00 CST
    endAtMs: 1_795_449_600_000, // Mon 23 Nov 2026, 10:00 CST
    timeZoneIdentifier: "America/Chicago",
    dateRangeLabel: "",
    events: [],
    options: nil
  )

  private func at(_ seconds: TimeInterval) -> Date {
    Date(timeIntervalSince1970: seconds)
  }

  private func event(
    from start: TimeInterval,
    until end: TimeInterval? = nil,
    reminderMinutes: Int? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: "panel",
      title: "Panel",
      startAtMs: start * 1_000,
      endAtMs: end.map { $0 * 1_000 },
      location: nil,
      room: nil,
      reminderMinutes: reminderMinutes,
      ageRating: nil,
      summary: nil
    )
  }

  // MARK: Time ranges

  @Test func timeRangeIsStartAloneWithoutAnEnd() {
    let panel = event(from: 1_795_204_800) // 14:00
    #expect(ConPawsFormat.timeRange(panel, in: convention, locale: english) == "2:00\u{202F}PM")
  }

  @Test func timeRangeJoinsStartAndEnd() {
    let panel = event(from: 1_795_204_800, until: 1_795_210_200) // 14:00-15:30
    #expect(
      ConPawsFormat.timeRange(panel, in: convention, locale: english)
        == "2:00\u{202F}PM–3:30\u{202F}PM"
    )
    #expect(ConPawsFormat.timeRange(panel, in: convention, locale: german) == "14:00–15:30")
  }

  /// The app's 24-hour setting reaches the Watch as the snapshot's
  /// `timeFormat`, and wins over the language's 12-hour default.
  @Test func timeRangeUsesTheConventionsZoneAndTheAppsClock() {
    let snapshot = ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: 0,
      localeIdentifier: "en-US",
      conventions: [convention],
      timeFormat: "24"
    )
    let panel = event(from: 1_795_204_800, until: 1_795_210_200) // 14:00-15:30
    #expect(ConPawsFormat.timeRange(panel, in: convention, locale: snapshot.locale) == "14:00–15:30")
  }

  // MARK: Day labels

  @Test func dayLabelIsNilForTodayInTheConventionsZone() {
    // 23:30 in Chicago is already Saturday in UTC, but still today here.
    let now = at(1_795_186_800) // Fri 09:00
    let lateTonight = at(1_795_239_000) // Fri 23:30
    #expect(
      ConPawsFormat.dayLabel(lateTonight, relativeTo: now, in: convention, locale: english, strings: .english)
        == nil
    )
  }

  @Test func dayLabelSaysTomorrowFromTheConventionsMidnight() {
    // Both moments fall on Saturday 21 November in UTC; in Chicago the first
    // is Friday night and the second is after midnight.
    let now = at(1_795_239_000) // Fri 23:30
    let afterMidnight = at(1_795_244_400) // Sat 01:00
    #expect(
      ConPawsFormat.dayLabel(afterMidnight, relativeTo: now, in: convention, locale: english, strings: .english)
        == "Tomorrow"
    )
  }

  @Test func dayLabelNamesTheWeekdayInTheAppsLanguage() {
    let now = at(1_795_186_800) // Fri 09:00
    let sunday = at(1_795_363_200) // Sun 22 Nov, 10:00
    #expect(
      ConPawsFormat.dayLabel(sunday, relativeTo: now, in: convention, locale: english, strings: .english)
        == "Sunday"
    )
    #expect(
      ConPawsFormat.dayLabel(sunday, relativeTo: now, in: convention, locale: german, strings: .resolve("de"))
        == "Sonntag"
    )
  }

  // MARK: Next event time

  @Test func nextEventTimeIsBareToday() {
    let now = at(1_795_186_800) // Fri 09:00
    #expect(
      ConPawsFormat.nextEventTime(at(1_795_239_000), relativeTo: now, in: convention, locale: english, strings: .english)
        == "11:30\u{202F}PM"
    )
  }

  @Test func nextEventTimeSaysTomorrowAtTheConventionsMidnight() {
    let now = at(1_795_239_000) // Fri 23:30
    #expect(
      ConPawsFormat.nextEventTime(at(1_795_242_600), relativeTo: now, in: convention, locale: english, strings: .english)
        == "Tomorrow · 12:30\u{202F}AM"
    )
  }

  @Test func nextEventTimeNamesTheWeekdayBeyondTomorrow() {
    let now = at(1_795_186_800) // Fri 09:00
    let sunday = at(1_795_363_200) // Sun 22 Nov, 10:00
    #expect(
      ConPawsFormat.nextEventTime(sunday, relativeTo: now, in: convention, locale: english, strings: .english)
        == "Sunday · 10:00\u{202F}AM"
    )
    #expect(
      ConPawsFormat.nextEventTime(sunday, relativeTo: now, in: convention, locale: german, strings: .resolve("de"))
        == "Sonntag · 10:00"
    )
  }

  // MARK: Reminders

  @Test func reminderAtIsStartMinusOffset() {
    let panel = event(from: 1_795_204_800, reminderMinutes: 10) // 14:00
    #expect(
      ConPawsFormat.reminderAt(panel, in: convention, locale: english, strings: .english)
        == "Reminder at 1:50\u{202F}PM · 10 min before"
    )
  }

  @Test(arguments: [nil, -5] as [Int?])
  func reminderAtIsNilWithoutAReminder(minutes: Int?) {
    let panel = event(from: 1_795_204_800, reminderMinutes: minutes)
    #expect(ConPawsFormat.reminderAt(panel, in: convention, locale: english, strings: .english) == nil)
  }

  /// The reminder line in the app's language, worded as the phone's reminder
  /// picker words it: the offset reads as "before", never "ago", and the
  /// minutes are the catalog's short form, so no language needs a case for
  /// the number. Dutch, Russian and Ukrainian once read "10 minutes ago".
  @Test(arguments: [
    ("en", "1:50 PM", 10, "Reminder at 1:50 PM · 10 min before"),
    ("en", "1:59 PM", 1, "Reminder at 1:59 PM · 1 min before"),
    ("de", "13:50", 10, "Erinnerung um 13:50 · 10 Min. vorher"),
    ("fr", "13:55", 5, "Rappel à 13:55 · 5 min avant"),
    ("pl", "13:58", 2, "Przypomnienie o 13:58 · 2 min wcześniej"),
    ("ja", "13:45", 15, "13:45にリマインダー · 15分前"),
    ("nl", "14:10", 10, "Herinnering om 14:10 · 10 min van tevoren"),
    ("ru", "14:10", 10, "Напоминание в 14:10 · За 10 мин"),
    ("ru", "14:19", 1, "Напоминание в 14:19 · За 1 мин"),
    ("uk", "14:10", 10, "Нагадування о 14:10 · За 10 хв"),
    ("cs", "14:10", 10, "Připomenutí v 14:10 · 10 min předem"),
    ("hu", "14:10", 10, "Emlékeztető: 14:10 · 10 perccel előtte"),
  ])
  func reminderWordingSaysBeforeInTheAppsLanguage(
    language: String,
    time: String,
    minutes: Int,
    expected: String
  ) {
    #expect(ConPawsStrings.resolve(language).reminderAt(time, minutes: minutes) == expected)
  }

  /// The phone offers 0 as "At event time" and 60 as "1 hour before"; the
  /// Watch used to read them as "0 minutes before" and "60 minutes before".
  @Test(arguments: [
    ("en", "2:00 PM", 0, "Reminder at 2:00 PM · At event time"),
    ("en", "1:00 PM", 60, "Reminder at 1:00 PM · 1 hour before"),
    ("nl", "14:00", 0, "Herinnering om 14:00 · Op het tijdstip van het evenement"),
    ("ru", "13:00", 60, "Напоминание в 13:00 · За 1 час"),
  ])
  func reminderAtTheStartOrAnHourAheadUsesThePhonesWords(
    language: String,
    time: String,
    minutes: Int,
    expected: String
  ) {
    #expect(ConPawsStrings.resolve(language).reminderAt(time, minutes: minutes) == expected)
  }

  @Test func reminderAtTheStartFormatsTheStartTime() {
    let panel = event(from: 1_795_204_800, reminderMinutes: 0) // 14:00
    #expect(
      ConPawsFormat.reminderAt(panel, in: convention, locale: english, strings: .english)
        == "Reminder at 2:00\u{202F}PM · At event time"
    )
  }

  /// One rule for every Watch screen: the reminder line shows while the
  /// reminder is still to come. Once it has fired, "Reminder at 1:50 PM"
  /// describes the past, and on a running panel it read as still coming.
  @Test(arguments: [
    (1_795_201_200.0, true), // 13:00
    (1_795_204_140, true), // 13:49
    (1_795_204_200, false), // 13:50, the reminder fires
    (1_795_204_500, false), // 13:55
    (1_795_206_600, false), // 14:30, the panel is running
  ])
  func aReminderLineShowsOnlyUntilItFires(now: TimeInterval, shows: Bool) {
    let panel = event(from: 1_795_204_800, until: 1_795_208_400, reminderMinutes: 10) // 14:00-15:00
    let long = ConPawsFormat.upcomingReminderAt(
      panel, now: at(now), in: convention, locale: english, strings: .english
    )
    let short = ConPawsFormat.upcomingReminderTime(
      panel, now: at(now), in: convention, locale: english, strings: .english
    )
    #expect(long == (shows ? "Reminder at 1:50\u{202F}PM · 10 min before" : nil))
    #expect(short == (shows ? "1:50\u{202F}PM · 10 min before" : nil))
  }

  /// The Up Next card's line, beside a bell that says "reminder": the time
  /// and the offset alone, which fit where the sentence was cut to
  /// "Reminder at 11:43 AM · 10 minut…".
  @Test func theShortReminderLineKeepsTheTimeAndTheOffset() {
    let panel = event(from: 1_795_204_800, reminderMinutes: 10) // 14:00
    let now = at(1_795_201_200) // 13:00
    #expect(
      ConPawsFormat.upcomingReminderTime(
        panel, now: now, in: convention, locale: german, strings: .resolve("de")
      ) == "13:50 · 10 Min. vorher"
    )
    #expect(
      ConPawsFormat.upcomingReminderTime(
        panel, now: now, in: convention, locale: english, strings: .english
      ) == "1:50\u{202F}PM · 10 min before"
    )
  }

  @Test func noReminderMeansNoReminderLine() {
    let panel = event(from: 1_795_204_800)
    let now = at(1_795_201_200)
    #expect(
      ConPawsFormat.upcomingReminderAt(panel, now: now, in: convention, locale: english, strings: .english)
        == nil
    )
    #expect(
      ConPawsFormat.upcomingReminderTime(panel, now: now, in: convention, locale: english, strings: .english)
        == nil
    )
  }

  // MARK: Spoken durations

  @Test(arguments: [
    (1_795_192_200.0, "1 hour, 30 minutes"), // Fri 10:30
    (1_795_370_400, "2 days, 3 hours"), // Sun 22 Nov, 12:00
    (1_800_889_200, "2 months, 5 days"), // Mon 25 Jan 2027, 09:00
  ])
  func countdownDurationSpeaksTwoUnits(target: TimeInterval, expected: String) {
    let now = at(1_795_186_800) // Fri 20 Nov 2026, 09:00
    #expect(
      ConPawsFormat.countdownDuration(from: now, to: at(target), in: convention.timeZone, strings: .english)
        == expected
    )
  }

  /// A unit that counts zero is not spoken: VoiceOver read "0 hours, 18
  /// minutes remaining" through every final hour. The last minute is still
  /// one minute, never zero.
  @Test(arguments: [
    (1_795_187_880.0, "18 minutes"), // Fri 09:18
    (1_795_186_859, "1 minute"), // 59 seconds on
    (1_795_190_400, "1 hour"), // Fri 10:00
    (1_795_190_460, "1 hour, 1 minute"), // Fri 10:01
    (1_795_204_800, "5 hours"), // Fri 14:00
    (1_795_204_980, "5 hours, 3 minutes"), // Fri 14:03
    (1_795_280_400, "1 day, 2 hours"), // Sat 21 Nov, 11:00
    (1_795_446_000, "3 days"), // Mon 23 Nov, 09:00
    (1_797_778_800, "1 month"), // Sun 20 Dec, 09:00
  ])
  func countdownDurationDropsAZeroUnit(target: TimeInterval, expected: String) {
    let now = at(1_795_186_800) // Fri 20 Nov 2026, 09:00
    #expect(
      ConPawsFormat.countdownDuration(from: now, to: at(target), in: convention.timeZone, strings: .english)
        == expected
    )
  }

  /// A wait under 30 days that spans February is a calendar month long, and
  /// asking the calendar for months took every day of it: "0 days, 0 hours"
  /// while the card read "In 28 days".
  @Test(arguments: [
    (1_801_807_200.0, 1_804_226_400.0, "28 days"), // Fri 5 Feb 2027 -> Fri 5 Mar
    (1_801_764_000, 1_804_226_400, "28 days, 12 hours"), // Thu 4 Feb 2027, 12:00 -> 5 Mar
    (1_801_288_800, 1_803_794_400, "29 days"), // Sat 30 Jan 2027 -> Sun 28 Feb
    (1_833_343_200, 1_835_848_800, "29 days"), // Sat 5 Feb 2028 -> Sun 5 Mar, leap year
    (1_801_634_400, 1_804_226_400, "1 month, 2 days"), // Wed 3 Feb 2027 -> 5 Mar, 30 days
  ])
  func countdownDurationKeepsEveryDayAcrossFebruary(
    from: TimeInterval,
    to: TimeInterval,
    expected: String
  ) {
    #expect(
      ConPawsFormat.countdownDuration(from: at(from), to: at(to), in: convention.timeZone, strings: .english)
        == expected
    )
  }

  /// Thirty days that are not yet a calendar month read as days, the way the
  /// card's own "In 30 days" does, not "0 months, 30 days".
  @Test func countdownDurationMatchesTheLadderAtThirtyDays() throws {
    let now = at(1_767_225_600) // Thu 1 Jan 2026, 00:00 UTC
    let target = now.addingTimeInterval(30 * 86_400)
    let utc = try #require(TimeZone(identifier: "UTC"))
    #expect(ConPawsCountdown.label(from: now, to: target, timeZone: utc, strings: .english) == "In 30 days")
    #expect(ConPawsFormat.countdownDuration(from: now, to: target, in: utc, strings: .english) == "30 days")
  }

  /// No language leads with, or trails, a unit that counts zero.
  @Test(arguments: ConPawsLanguage.allCases)
  func countdownDurationNeverSpeaksAZero(language: ConPawsLanguage) {
    let now = at(1_795_186_800) // Fri 20 Nov 2026, 09:00
    let strings = ConPawsStrings.table(for: language)
    for target in [1_795_187_880.0, 1_795_190_400, 1_795_446_000, 1_797_778_800] {
      let spoken = ConPawsFormat.countdownDuration(
        from: now,
        to: at(target),
        in: convention.timeZone,
        strings: strings
      )
      #expect(spoken.hasPrefix("0") == false, "\(language): \(spoken)")
      #expect(spoken.contains(", 0") == false, "\(language): \(spoken)")
    }
  }

  /// "remaining" takes the plain case: "pozostało: 18 minut", "осталось:
  /// 1 минута".
  @Test(arguments: [
    ("pl", 1_795_187_880.0, "18 minut"),
    ("ru", 1_795_186_860, "1 минута"),
    ("ru", 1_795_190_400, "1 час"),
  ])
  func countdownDurationIsInThePlainCase(language: String, target: TimeInterval, expected: String) {
    let now = at(1_795_186_800) // Fri 20 Nov 2026, 09:00
    #expect(
      ConPawsFormat.countdownDuration(
        from: now,
        to: at(target),
        in: convention.timeZone,
        strings: .resolve(language)
      ) == expected
    )
  }

  /// The live timer's spoken "remaining" wraps hours and minutes, which
  /// differ in gender and number, so a verb or adjective that agrees with
  /// the noun is wrong for some of them: "1 minute restants", "pozostało
  /// 1 minuta", "faltan 1 minuto". These languages use a phrasing that
  /// agrees with nothing.
  @Test(arguments: [
    ("fr", 1, "il reste 1 minute"),
    ("pl", 2, "pozostało: 2 minuty"),
    ("ru", 1, "осталось: 1 минута"),
    ("uk", 1, "залишилось: 1 хвилина"),
    ("it", 1, "tempo rimanente: 1 minuto"),
    ("cs", 2, "zbývá: 2 minuty"),
    ("es-ES", 1, "tiempo restante: 1 minuto"),
    ("es-419", 1, "tiempo restante: 1 minuto"),
    ("pt-BR", 1, "tempo restante: 1 minuto"),
    ("pt-PT", 1, "tempo restante: 1 minuto"),
  ])
  func remainingAgreesWithEveryUnit(language: String, minutes: Int, expected: String) {
    let strings = ConPawsStrings.resolve(language)
    #expect(strings.remaining(strings.minutes(minutes)) == expected)
  }

  @Test func remainingReadsTwoUnitsOfDifferentGenders() {
    let strings = ConPawsStrings.resolve("fr")
    #expect(
      strings.remaining(strings.duration(strings.hours(1), strings.minutes(30)))
        == "il reste 1 heure, 30 minutes"
    )
  }
}
