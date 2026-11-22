import Foundation
import Testing
@testable import ConPawsShared

/// Where the worded countdown changes, which is where the complication needs a
/// timeline entry. Instants are written out as seconds since 1970 rather than
/// recomputed with the code's own arithmetic; the comment beside each one gives
/// its wall-clock time in America/Chicago.
struct ConPawsCountdownTests {
  private let chicago = TimeZone(identifier: "America/Chicago")!

  private func at(_ seconds: TimeInterval) -> Date {
    Date(timeIntervalSince1970: seconds)
  }

  private func label(from: Date, to: Date) -> String {
    ConPawsCountdown.label(from: from, to: to, timeZone: chicago, strings: .english)
  }

  @Test func changePointsStepAtMidnightThenHourlyThenOnlyAtTheTarget() {
    let from = at(1_795_235_400) // Fri 20 Nov 2026, 22:30 CST
    let to = at(1_795_449_600) // Mon 23 Nov 2026, 10:00 CST
    let points = ConPawsCountdown.changePoints(from: from, to: to, timeZone: chicago, limit: 64)

    #expect(Array(points.prefix(3)) == [
      at(1_795_240_800), // Sat 21 Nov, 00:00: "In 2 days"
      at(1_795_327_200), // Sun 22 Nov, 00:00: "Tomorrow"
      at(1_795_363_201), // Sun 22 Nov, 10:00:01: "In 23 hours"
    ])
    let hourly = Array(points.dropFirst(2).dropLast())
    #expect(hourly.count == 24)
    #expect(hourly.last == at(1_795_446_001)) // Mon 23 Nov, 09:00:01: "Starting soon"
    #expect(zip(hourly, hourly.dropFirst()).allSatisfy { $1.timeIntervalSince($0) == 3_600 })
    // Nothing inside the final hour but the target itself.
    #expect(points.last == to)
  }

  /// The countdown reads "In 23 hours" a second after the wait drops under a
  /// day, whatever the calendar day says. A step that waited for midnight
  /// kept "Tomorrow" on the card for most of a day.
  @Test func changePointsIncludeTheMomentTheWaitDropsUnderADay() {
    let from = at(1_795_180_380) // Fri 20 Nov 2026, 07:13 CST
    let to = at(1_795_288_380) // Sat 21 Nov 2026, 13:13 CST, 30 hours on
    let points = ConPawsCountdown.changePoints(from: from, to: to, timeZone: chicago)

    #expect(label(from: from, to: to) == "Tomorrow")
    let underADay = at(1_795_201_981) // Fri 20 Nov, 13:13:01
    #expect(label(from: underADay, to: to) == "In 23 hours")
    #expect(points.first == underADay)
  }

  @Test func changePointsLandJustInsideEachHour() {
    let from = at(1_795_180_380) // Fri 20 Nov 2026, 07:13 CST
    let to = at(1_795_198_380) // 12:13, five hours on
    let points = ConPawsCountdown.changePoints(from: from, to: to, timeZone: chicago)

    #expect(points == [
      at(1_795_180_381), // 07:13:01
      at(1_795_183_981), // 08:13:01
      at(1_795_187_581), // 09:13:01
      at(1_795_191_181), // 10:13:01
      at(1_795_194_781), // 11:13:01
      to,
    ])
    #expect(points.map { label(from: $0, to: to) } == [
      "In 4 hours", "In 3 hours", "In 2 hours", "In 1 hour", "Starting soon", "Now",
    ])
    // One second earlier each point still read the previous step.
    #expect(points.map { label(from: $0.addingTimeInterval(-1), to: to) } == [
      "In 5 hours", "In 4 hours", "In 3 hours", "In 2 hours", "In 1 hour", "Starting soon",
    ])
  }

  @Test func changePointsStopAtTheLimitAndAlwaysEndAtTheTarget() {
    let from = at(1_795_180_380) // Fri 20 Nov 2026, 07:13 CST
    let fiveHours = at(1_795_198_380)

    #expect(
      ConPawsCountdown.changePoints(from: from, to: fiveHours, timeZone: chicago, limit: 3)
        == [at(1_795_180_381), at(1_795_183_981), at(1_795_187_581)]
    )
    #expect(ConPawsCountdown.changePoints(from: from, to: fiveHours, timeZone: chicago, limit: 0).isEmpty)
    #expect(ConPawsCountdown.changePoints(from: fiveHours, to: from, timeZone: chicago).isEmpty)
    #expect(ConPawsCountdown.changePoints(from: from, to: from, timeZone: chicago).isEmpty)
    // Inside the final hour the wording holds until the target.
    let halfHour = at(1_795_182_180)
    #expect(ConPawsCountdown.changePoints(from: from, to: halfHour, timeZone: chicago) == [halfHour])
    // 23 hours 30 minutes: 23 hourly steps and the target fill the default
    // limit of 24 exactly.
    let almostADay = at(1_795_264_980)
    let points = ConPawsCountdown.changePoints(from: from, to: almostADay, timeZone: chicago)
    #expect(points.count == 24)
    #expect(points.last == almostADay)
  }

  /// Chicago leaves daylight time at 02:00 on Sunday 1 November 2026, so that
  /// day is 25 hours long. The day steps still land on local midnight.
  @Test func changePointsAcrossChicagoDSTEnd() {
    let from = at(1_793_494_800) // Sat 31 Oct 2026, 20:00 CDT
    let to = at(1_793_901_600) // Thu 5 Nov 2026, 12:00 CST
    let points = ConPawsCountdown.changePoints(from: from, to: to, timeZone: chicago)

    #expect(Array(points.prefix(4)) == [
      at(1_793_509_200), // Sun 1 Nov, 00:00 CDT
      at(1_793_599_200), // Mon 2 Nov, 00:00 CST, 25 hours later
      at(1_793_685_600), // Tue 3 Nov, 00:00 CST
      at(1_793_772_000), // Wed 4 Nov, 00:00 CST
    ])
    #expect(points.prefix(4).map { label(from: $0, to: to) } == [
      "In 4 days", "In 3 days", "In 2 days", "Tomorrow",
    ])
    // The last second of the long day is still four days out.
    #expect(label(from: at(1_793_599_199), to: to) == "In 4 days")
  }
}

/// Days and months are counted on the Gregorian calendar in the convention's
/// zone, whatever calendar the watch is set to: a Hebrew or Islamic calendar
/// counted a 30-day wait as "In 1 month" while the iPhone said "In 30 days".
/// The test cannot change the Mac's calendar, so it pins the helper itself.
struct ConventionCalendarTests {
  @Test func countdownLadderIsGregorianWhateverTheDeviceCalendar() {
    let zone = TimeZone(identifier: "Asia/Jerusalem")!
    let calendar = ConPawsCalendar.convention(in: zone)
    #expect(calendar.identifier == .gregorian)
    #expect(calendar.timeZone == zone)

    let from = Date(timeIntervalSince1970: 1_767_225_600) // Thu 1 Jan 2026, 00:00 UTC
    let to = from.addingTimeInterval(30 * 86_400)
    #expect(ConPawsCountdown.label(from: from, to: to, timeZone: zone, strings: .english) == "In 30 days")
  }
}
