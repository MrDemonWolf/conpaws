import Foundation

/// What became of a save or remove tapped on the Watch, once a snapshot from
/// the phone ended its wait.
enum ConPawsWatchTapResult: Hashable, Sendable {
  /// The snapshot shows what the tap asked for.
  case landed
  /// The phone left the plan as it was.
  case declined(ConPawsWatchTapDecline)
}

/// Why a tap changed nothing, in the terms the Watch tells the wearer.
enum ConPawsWatchTapDecline: Hashable, Sendable {
  /// The phone changed the panel after the tap, and the phone wins. Also a
  /// tap the phone applied whose change was undone there before the Watch
  /// saw it.
  case changedOnIphone
  /// The convention cancelled the panel.
  case cancelled
  /// The panel is gone from the convention's schedule.
  case offSchedule
  /// A panel the Watch cannot add, such as a drop-in, which needs a visit
  /// time chosen on the phone.
  case addOnIphone
  /// More than a day old, so the phone ignores it.
  case tooOld
  /// The phone tried and gave up.
  case failed
  /// Listed as handled with no outcome: an iPhone app from before outcomes
  /// were sent, or one this build cannot read.
  case unknown

  /// The reason for a tap the snapshot does not show, from what the phone
  /// reported. Applied or already so, yet not shown, means the phone changed
  /// it since.
  init(outcome: ConPawsWatchCommandOutcome?) {
    switch outcome {
    case .superseded, .applied, .unchanged: self = .changedOnIphone
    case .cancelled: self = .cancelled
    case .removed, .missing: self = .offSchedule
    case .notAllowed: self = .addOnIphone
    case .expired: self = .tooOld
    case .failed: self = .failed
    case nil: self = .unknown
    }
  }
}

extension ConPawsWatchCommand {
  /// What `receipts` and `shown` make of this tap, or nil while it is still
  /// waiting.
  ///
  /// Landed whenever `shown`, the schedule on screen, holds what the tap
  /// asked for, whatever the phone reported: the plan is as the wearer
  /// wanted, by this tap or by their own hand on the phone. Otherwise a tap
  /// `receipts` lists as handled was declined, for the reason it gives. They
  /// are the same snapshot except for a late one too old to show, whose
  /// receipts still count (see `ConPawsPendingCommands.settling(_:byReceiptsIn:shown:)`).
  /// Never landed on the phone's word alone: only a snapshot showing the
  /// change counts as success.
  func result(shown: ConPawsSnapshot, receipts: ConPawsSnapshot) -> ConPawsWatchTapResult? {
    if isShown(in: shown) { return .landed }
    guard receipts.handledCommandIds?.contains(id) == true else { return nil }
    return .declined(ConPawsWatchTapDecline(outcome: receipts.commandOutcomes?[commandID: id]))
  }
}

/// What the Watch says about the last tap on each event, and for how long.
///
/// A table keyed by event id, like the pending commands. The functions return
/// a new table and touch nothing else; the Watch app keeps the published one
/// in memory, since a reason is only worth showing for a few minutes.
enum ConPawsWatchTapLog {
  struct Entry: Hashable, Sendable {
    let result: ConPawsWatchTapResult
    /// What the tap asked for. Its reason holds only under the button that
    /// would send it again: once the phone changes the panel the other way,
    /// the screen offers the opposite action and the reason no longer fits.
    let action: ConPawsWatchCommand.Action
    let settledAt: Date
  }

  typealias Table = [String: Entry]

  /// The haptic a snapshot's results play.
  enum Haptic: Hashable, Sendable {
    case success
    case failure
  }

  /// How long a decline stays under its button: long enough to read after
  /// lowering the wrist and looking again, short enough that it does not
  /// describe a plan the phone has changed since.
  static let shownFor: TimeInterval = 10 * 60

  /// `results`, from settling `pending` at `now`, in place of anything
  /// earlier on their events, without entries no longer shown. A result
  /// whose tap `pending` does not hold is left out: it cannot say which
  /// button it belongs under.
  static func recording(
    _ results: [String: ConPawsWatchTapResult],
    of pending: ConPawsPendingCommands.Table,
    at now: Date,
    in table: Table
  ) -> Table {
    var updated = table.filter { _, entry in now.timeIntervalSince(entry.settledAt) < shownFor }
    for (eventID, result) in results {
      guard let action = pending[eventID]?.command.action else { continue }
      updated[eventID] = Entry(result: result, action: action, settledAt: now)
    }
    return updated
  }

  /// Without the entry for `eventID`: a new tap there starts a new wait.
  static func forgetting(_ eventID: String, in table: Table) -> Table {
    var updated = table
    updated[eventID] = nil
    return updated
  }

  /// Why the last tap on `eventID` changed nothing, for the button that
  /// sends `action`, while that is still worth saying; nil after a landing,
  /// under the opposite button (the phone has changed the panel since), or
  /// once `shownFor` has passed.
  static func decline(
    for eventID: String,
    action: ConPawsWatchCommand.Action,
    in table: Table,
    at now: Date
  ) -> ConPawsWatchTapDecline? {
    guard
      let entry = table[eventID],
      entry.action == action,
      case .declined(let decline) = entry.result,
      now.timeIntervalSince(entry.settledAt) < shownFor
    else { return nil }
    return decline
  }

  /// One haptic for everything a snapshot settled: failure if any tap was
  /// declined, since that is the one the wearer must act on, success if
  /// they all landed, and none for nothing.
  ///
  /// A tap more than a day old counts for neither. The wearer has long
  /// stopped waiting on it, so a buzz hours later would say nothing; its
  /// reason still shows under the button.
  static func haptic(for results: some Collection<ConPawsWatchTapResult>) -> Haptic? {
    let current = results.filter { $0 != .declined(.tooOld) }
    if current.contains(where: { $0 != .landed }) { return .failure }
    return current.isEmpty ? nil : .success
  }

  /// The decline VoiceOver announces for a snapshot's results: one, the
  /// first by event id so the choice is stable, or nil when none declined.
  /// Never a day-old tap, for the reason `haptic(for:)` gives.
  static func announcedDecline(in results: [String: ConPawsWatchTapResult]) -> ConPawsWatchTapDecline? {
    results.sorted { $0.key < $1.key }.lazy.compactMap { _, result in
      if case .declined(let decline) = result, decline != .tooOld { decline } else { nil }
    }.first
  }
}
