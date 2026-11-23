import Foundation

extension ConPawsSnapshotStore {
  /// How far ahead of the watch's own clock a delivered snapshot may be
  /// stamped.
  ///
  /// `generatedAtMs` is the phone's wall clock, so a phone that boots with a
  /// bad RTC can stamp one years out. Refused at the point the value is first
  /// trusted, it is never shown or stored. Sits with `rewindToleranceMs`,
  /// which covers a stored stamp that got past this ceiling's day of slack.
  static let futureToleranceMs: Double = 86_400 * 1_000

  /// Whether a snapshot delivered to the Watch is worth looking at: a schema
  /// this binary renders, stamped at a real time no later than
  /// `futureToleranceMs` past `nowMs`. Checked before records are filtered,
  /// which leaves the schema and the stamp as they are.
  static func isAcceptableEnvelope(_ snapshot: ConPawsSnapshot, nowMs: Double) -> Bool {
    supportedSchemaVersions.contains(snapshot.schemaVersion)
      && snapshot.generatedAtMs.isFinite
      && snapshot.generatedAtMs >= 0
      && snapshot.generatedAtMs <= nowMs + futureToleranceMs
  }
}
