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
        == "Reminder at 1:50\u{202F}PM · 10 minutes before"
    )
  }

  @Test(arguments: [nil, -5] as [Int?])
  func reminderAtIsNilWithoutAReminder(minutes: Int?) {
    let panel = event(from: 1_795_204_800, reminderMinutes: minutes)
    #expect(ConPawsFormat.reminderAt(panel, in: convention, locale: english, strings: .english) == nil)
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
}
