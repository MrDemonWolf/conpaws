import Foundation

/// What the phone did with a Watch command, as `WATCH_COMMAND_OUTCOMES` in
/// src/services/watch-command-receipts.ts spells it.
/// watch-command-contract.test.ts holds the two lists together, in order.
enum ConPawsWatchCommandOutcome: String, CaseIterable, Sendable {
  case applied
  case unchanged
  case expired
  case missing
  case superseded
  case notAllowed = "not-allowed"
  case cancelled
  case removed
  case failed
}

/// The phone's outcome for each command it lists in `handledCommandIds`,
/// keyed by command id. Sent beside the ids by the iOS app only.
///
/// Decoding never throws: an outcome a newer phone app invented is left out,
/// and a list this build cannot read at all reads as empty, so the newest and
/// least important field can never cost the Watch its schedule. Without an
/// outcome a tap still settles by its id, and the Watch says only that
/// nothing changed.
struct ConPawsCommandOutcomes: Codable, Hashable, Sendable {
  let byCommandID: [String: ConPawsWatchCommandOutcome]

  init(_ byCommandID: [String: ConPawsWatchCommandOutcome] = [:]) {
    self.byCommandID = byCommandID
  }

  subscript(commandID commandID: String) -> ConPawsWatchCommandOutcome? {
    byCommandID[commandID]
  }

  init(from decoder: any Decoder) {
    let raw = (try? decoder.singleValueContainer().decode([String: String].self)) ?? [:]
    byCommandID = raw.compactMapValues(ConPawsWatchCommandOutcome.init(rawValue:))
  }

  /// Flat, as the phone sent it: the Watch stores the snapshot re-encoded,
  /// and the next launch reads that copy.
  func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(byCommandID.mapValues(\.rawValue))
  }
}
