import Foundation
import Testing
@testable import ConPawsShared

/// The sentence VoiceOver reads for each complication state. Every family
/// (rectangular, circular, corner, inline) draws a different slice of the
/// same card, so all of them speak this one summary, and a redacted face
/// speaks only what stays drawn on it: never a title or a room.
struct ComplicationSummaryTests {
  private let strings = ConPawsStrings.english
  private let locale = FaceFixture.english

  private func summary(
    _ projection: ConPawsComplicationProjection,
    redacted: Bool = false,
    stale: String? = nil
  ) -> String {
    ConPawsComplicationSpeech.summary(
      projection,
      strings: strings,
      locale: locale,
      redacted: redacted,
      stale: stale
    )
  }

  // MARK: Leave

  @Test func leaveNamesThePanelAndItsTime() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    #expect(summary(card) == "Starts in 18 minutes for Fursuit Meetup, at 2:00\u{202F}PM.")
  }

  @Test func redactedLeaveKeepsTheCountdownAndTheTime() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    #expect(summary(card, redacted: true) == "Starts in 18 min, 2:00\u{202F}PM.")
  }

  // MARK: Up next

  @Test func nextNamesTheRunningPanelThePlaceAndTheReminder() {
    let meetup = FaceFixture.event(
      "Fursuit Meetup",
      from: FaceFixture.local(21, 14),
      room: "Hall A",
      location: "Center",
      reminderMinutes: 10
    )
    let card = FaceFixture.projection([FaceFixture.artJam, meetup], at: FaceFixture.local(21, 13, 20))
    #expect(
      summary(card)
        == "HAPPENING NOW, Art Jam. Next event: Fursuit Meetup, starts 2:00\u{202F}PM, Hall A • Center. "
        + "Reminder at 1:50\u{202F}PM · 10 min before."
    )
  }

  @Test func redactedNextSaysOnlyWhenAndTheReminder() {
    let meetup = FaceFixture.event(
      "Fursuit Meetup",
      from: FaceFixture.local(21, 14),
      room: "Hall A",
      reminderMinutes: 10
    )
    let card = FaceFixture.projection([FaceFixture.artJam, meetup], at: FaceFixture.local(21, 13, 20))
    #expect(summary(card, redacted: true) == "UP NEXT, 2:00\u{202F}PM. Reminder at 1:50\u{202F}PM · 10 min before.")
  }

  @Test func nextWithoutAPlaceOrReminderIsOneSentence() {
    let quiz = FaceFixture.event("Quiz", from: FaceFixture.local(21, 16))
    let card = FaceFixture.projection([quiz], at: FaceFixture.local(21, 12))
    #expect(summary(card) == "Next event: Quiz, starts 4:00\u{202F}PM.")
  }

  // MARK: Happening now

  @Test func currentNamesThePanelItsTimesAndItsPlace() {
    let card = FaceFixture.projection([FaceFixture.artJam], at: FaceFixture.local(21, 13, 30))
    #expect(
      summary(card)
        == "HAPPENING NOW, Art Jam, 1:00\u{202F}PM–2:30\u{202F}PM, Studio B. No later saved events."
    )
  }

  @Test func redactedCurrentKeepsOnlyTheTimes() {
    let card = FaceFixture.projection([FaceFixture.artJam], at: FaceFixture.local(21, 13, 30))
    #expect(
      summary(card, redacted: true)
        == "HAPPENING NOW, 1:00\u{202F}PM–2:30\u{202F}PM. No later saved events."
    )
  }

  // MARK: Countdown and status

  @Test func comingUpSpeaksTheCountdown() {
    let card = FaceFixture.projection([], at: FaceFixture.local(17, 9))
    #expect(summary(card) == "Coming up, FurCon, in 3 days")
    // The convention's name is not private: it stays when redacted.
    #expect(summary(card, redacted: true) == "Coming up, FurCon, in 3 days")
  }

  @Test func statusSpeaksItsTitleAndDetail() {
    let card = FaceFixture.projection([], at: FaceFixture.local(21, 12))
    #expect(summary(card) == "Add panels on iPhone, No panels picked")
  }

  // MARK: Stale

  @Test(arguments: [
    ("Starts in 18 min, 2:00 PM.", "Starts in 18 min, 2:00 PM. This plan may be out of date."),
    ("Coming up, FurCon, in 3 days", "Coming up, FurCon, in 3 days. This plan may be out of date."),
    ("次の予定。", "次の予定。 This plan may be out of date."),
  ])
  func staleSentenceFollowsTheSummary(summary: String, expected: String) {
    #expect(
      ConPawsComplicationSpeech.withStale(summary, stale: "This plan may be out of date.") == expected
    )
  }

  @Test func freshSummaryIsUnchanged() {
    #expect(ConPawsComplicationSpeech.withStale("Coming up", stale: nil) == "Coming up")
  }

  @Test func staleSentenceIsAppendedToTheStatesSummary() {
    let card = FaceFixture.projection([], at: FaceFixture.local(21, 12))
    #expect(
      summary(card, stale: "This plan may be out of date.")
        == "Add panels on iPhone, No panels picked. This plan may be out of date."
    )
  }

  // MARK: Privacy

  /// Wrist down, the face hides titles and rooms, and VoiceOver must not
  /// read them out either: the summary replaces the drawn children.
  @Test(arguments: [
    FaceFixture.local(21, 13, 20), // up next, with Art Jam running
    FaceFixture.local(21, 13, 42), // leave
    FaceFixture.local(21, 14, 40), // happening now, nothing later
  ])
  func aRedactedSummaryNamesNoPanelOrRoom(now: Date) {
    let card = FaceFixture.projection([FaceFixture.artJam, FaceFixture.meetup], at: now)
    let spoken = summary(card, redacted: true)
    for secret in ["Art Jam", "Fursuit Meetup", "Hall A", "Studio B", "Center"] {
      #expect(spoken.contains(secret) == false, "\(spoken) names \(secret)")
    }
  }
}
