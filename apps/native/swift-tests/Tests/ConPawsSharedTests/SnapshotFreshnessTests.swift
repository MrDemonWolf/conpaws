import Foundation
import Testing
@testable import ConPawsShared

/// When the Watch flags its plan as possibly out of date, and how it says how
/// old the plan is. The Watch app, the complication's entry and the timeline
/// that places that entry all read these, so they cannot disagree.
struct SnapshotFreshnessTests {
  /// Tue 15 Jan 2027, 08:00 UTC, when the phone made the snapshot.
  private let generatedAt = Date(timeIntervalSince1970: 1_800_000_000)

  private func snapshot(withConventions: Bool) -> ConPawsSnapshot {
    let convention = ConPawsConventionSnapshot(
      id: "con",
      name: "Convention",
      startAtMs: 1_800_000_000_000,
      endAtMs: 1_800_172_800_000,
      timeZoneIdentifier: "UTC",
      dateRangeLabel: "",
      events: [],
      options: nil
    )
    return ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: generatedAt.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: withConventions ? [convention] : []
    )
  }

  @Test func anEmptySnapshotIsNeverStale() {
    let empty = snapshot(withConventions: false)
    let dayLater = generatedAt.addingTimeInterval(86_400)
    #expect(ConPawsSnapshotAge.staleDate(of: empty) == nil)
    #expect(ConPawsSnapshotAge.isStale(empty, now: dayLater) == false)
  }

  @Test func aPlanTurnsStaleThirtyMinutesAfterThePhoneMadeIt() {
    #expect(
      ConPawsSnapshotAge.staleDate(of: snapshot(withConventions: true))
        == Date(timeIntervalSince1970: 1_800_001_800)
    )
  }

  @Test(arguments: [(-60.0, false), (0, false), (1_799, false), (1_800, true), (86_400, true)])
  func aPlanIsStaleFromThirtyMinutesOn(age: TimeInterval, stale: Bool) {
    let plan = snapshot(withConventions: true)
    #expect(ConPawsSnapshotAge.isStale(plan, now: generatedAt.addingTimeInterval(age)) == stale)
  }

  @Test(arguments: [("en_US", "45 min. ago"), ("de_DE", "vor 45 Min.")])
  func updatedTextSaysHowLongAgoInTheAppsLanguage(locale: String, expected: String) {
    let now = generatedAt.addingTimeInterval(45 * 60)
    #expect(ConPawsSnapshotAge.updatedText(since: generatedAt, now: now, locale: Locale(identifier: locale)) == expected)
  }
}
