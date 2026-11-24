import Foundation

/// Add or remove, as the detail screen's last control.
struct WatchPlanAction {
  enum Kind {
    case add
    case remove
  }

  let kind: Kind
  /// Sent and not yet confirmed by a snapshot from the phone.
  let isPending: Bool
  let perform: () -> Void

  /// The command this button sends to the phone.
  var commandAction: ConPawsWatchCommand.Action {
    switch kind {
    case .add: .save
    case .remove: .remove
    }
  }
}
