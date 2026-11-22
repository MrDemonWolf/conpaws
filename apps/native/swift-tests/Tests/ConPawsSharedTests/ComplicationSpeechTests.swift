import Foundation
import Testing
@testable import ConPawsShared

/// What VoiceOver reads on the complication. WidgetKit keeps each entry's
/// label with its pixels until the next entry, so a spoken countdown must
/// change only where the drawn one does. Instants are seconds since 1970,
/// with their Chicago wall-clock time beside them.
struct ComplicationSpeechTests {
  private let convention = ConPawsConventionSnapshot(
    id: "furcon",
    name: "FurCon",
    startAtMs: 1_804_831_200_000, // Fri 12 Mar 2027, 00:00 CST
    endAtMs: 1_805_000_000_000,
    timeZoneIdentifier: "America/Chicago",
    dateRangeLabel: "",
    events: [],
    options: nil
  )

  private let panel = ConPawsEventSnapshot(
    id: "meetup",
    title: "Fursuit Meetup",
    startAtMs: 1_795_204_800_000, // Fri 20 Nov 2026, 14:00 CST
    endAtMs: nil,
    location: nil,
    room: nil,
    reminderMinutes: 30,
    ageRating: nil,
    summary: nil
  )

  private func at(_ seconds: TimeInterval) -> Date {
    Date(timeIntervalSince1970: seconds)
  }

  // MARK: Coming up

  /// The midnight entry used to say "11 days, 0 hours remaining" and keep
  /// saying it until 23:59, while the card read "In 11 days" all day.
  @Test(arguments: [
    1_803_880_800.0, // Mon 1 Mar 2027, 00:00
    1_803_952_800, // Mon 1 Mar 2027, 20:00
  ])
  func comingUpSpeaksTheWordsTheCardDraws(now: TimeInterval) {
    #expect(
      ConPawsComplicationSpeech.comingUp(convention, now: at(now), strings: .english)
        == "Coming up, FurCon, in 11 days"
    )
  }

  /// German keeps its capitals mid-sentence, as the leave line does.
  @Test func comingUpKeepsGermanCapitals() {
    #expect(
      ConPawsComplicationSpeech.comingUp(convention, now: at(1_803_880_800), strings: .resolve("de"))
        == "Demnächst, FurCon, In 11 Tagen"
    )
  }

  // MARK: Leave

  /// "Starts in %@" takes the noun in the case its preposition governs, and
  /// a zero unit is never spoken.
  @Test(arguments: [
    ("en", 1_795_203_720.0, "18 minutes"), // 13:42
    ("en", 1_795_201_200, "1 hour"), // 13:00, a 60-minute reminder opening
    ("pl", 1_795_204_740, "1 minutę"), // 13:59
    ("ru", 1_795_204_740, "1 минуту"),
    ("uk", 1_795_204_740, "1 хвилину"),
    ("cs", 1_795_204_740, "1 minutu"),
    ("fi", 1_795_203_720, "18 minuutin"),
    ("de", 1_795_203_720, "18 Minuten"),
  ])
  func leaveCountdownIsInTheCaseOfItsPreposition(
    language: String,
    now: TimeInterval,
    expected: String
  ) {
    #expect(
      ConPawsComplicationSpeech.leaveCountdown(
        from: at(now),
        to: panel.startDate,
        strings: .resolve(language)
      ) == expected
    )
  }

  @Test func leaveSentenceNamesThePanelAndItsTime() {
    let now = at(1_795_203_720) // 13:42
    #expect(
      ConPawsComplicationSpeech.leave(
        current: nil,
        next: panel,
        now: now,
        startTime: "2:00 PM",
        strings: .english
      ) == "Starts in 18 minutes for Fursuit Meetup, at 2:00 PM."
    )
    #expect(
      ConPawsComplicationSpeech.leave(
        current: nil,
        next: panel,
        now: now,
        startTime: "14:00",
        strings: .resolve("pl")
      ) == "Zaczyna się za 18 minut dla Fursuit Meetup, o 14:00."
    )
  }

  /// Inside the final hour the timeline has an entry every minute, so the
  /// spoken minutes hold from one entry to the next.
  @Test func leaveCountdownHoldsUntilTheNextMinuteEntry() {
    let start = panel.startDate
    let ticks = ConPawsCountdown.leaveChangePoints(from: at(1_795_203_000), to: start, limit: 64)
    for (entry, next) in zip(ticks, ticks.dropFirst()) {
      #expect(
        ConPawsComplicationSpeech.leaveCountdown(from: entry, to: start, strings: .english)
          == ConPawsComplicationSpeech.leaveCountdown(
            from: next.addingTimeInterval(-1),
            to: start,
            strings: .english
          ),
        "changed between \(entry) and \(next)"
      )
    }
  }
}
