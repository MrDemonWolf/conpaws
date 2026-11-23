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
}
