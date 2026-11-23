import Foundation
import Testing
@testable import ConPawsShared

/// The first check a snapshot from the phone meets on the Watch, before it is
/// filtered, compared with the stored one or saved.
struct SnapshotEnvelopeTests {
  /// 2026-09-04 15:20 UTC, in milliseconds.
  private let nowMs: Double = 1_788_535_200_000
  private let dayMs: Double = 86_400_000

  @Test func acceptsAStampExactlyADayAhead() {
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: nowMs + dayMs), nowMs: nowMs))
  }

  @Test func rejectsAStampMoreThanADayAhead() {
    // A phone with a bad clock: stored, this would never be replaced.
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: nowMs + dayMs + 1), nowMs: nowMs) == false)
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: nowMs + 10 * 365 * dayMs), nowMs: nowMs) == false)
  }

  @Test func acceptsAnyStampFromTheEpochToNow() {
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: 0), nowMs: nowMs))
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: nowMs - dayMs), nowMs: nowMs))
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: nowMs), nowMs: nowMs))
  }

  @Test(arguments: [-1, -Double.infinity, Double.infinity, Double.nan])
  func rejectsNegativeNaNAndInfiniteStamps(generatedAtMs: Double) {
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(generatedAtMs: generatedAtMs), nowMs: nowMs) == false)
  }

  @Test(arguments: [0, 3])
  func rejectsUnsupportedSchemaVersions(schemaVersion: Int) {
    #expect(
      ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(schemaVersion: schemaVersion, generatedAtMs: nowMs), nowMs: nowMs)
        == false
    )
  }

  @Test(arguments: [1, 2])
  func acceptsEverySupportedSchemaVersion(schemaVersion: Int) {
    #expect(ConPawsSnapshotStore.isAcceptableEnvelope(snapshot(schemaVersion: schemaVersion, generatedAtMs: nowMs), nowMs: nowMs))
  }

  private func snapshot(schemaVersion: Int = 2, generatedAtMs: Double) -> ConPawsSnapshot {
    ConPawsSnapshot(schemaVersion: schemaVersion, generatedAtMs: generatedAtMs, localeIdentifier: "en", conventions: [])
  }
}
