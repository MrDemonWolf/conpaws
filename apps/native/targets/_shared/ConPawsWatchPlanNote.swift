import Foundation

/// The line under the Watch app's Add or Remove button.
///
/// The Watch shows a change only once a snapshot from the phone confirms it,
/// and a confirmed change replaces the button: an added option's screen shows
/// the panel as saved, and a removed panel's screen closes. So a wait that
/// ends with the same button still on screen is a change the phone did not
/// make -- it declined the tap, or the tap grew too old to apply -- and the
/// button says so instead of quietly offering the same change again.
enum WatchPlanNote: Equatable, Sendable {
  case none
  /// Still waiting after `waitingDelay`. A phone app iOS has ended applies
  /// the tap only when it is next opened, which can be hours away.
  case waiting
  /// The wait ended and the button still offers the same change.
  case notChanged

  /// How long a tap waits before the button says what it is waiting for. A
  /// phone app that is running confirms in about a second, so a caption shown
  /// at once would only flash.
  static let waitingDelay: TimeInterval = 3

  /// The note once the button's wait goes from `wasPending` to `isPending`.
  func after(wasPending: Bool, isPending: Bool) -> WatchPlanNote {
    switch (wasPending, isPending) {
    case (true, false): .notChanged
    case (false, true): .none
    default: self
    }
  }

  /// What the note says, or nil when there is nothing to say.
  func text(_ strings: ConPawsStrings) -> String? {
    switch self {
    case .none: nil
    case .waiting: strings.openOnIphone
    case .notChanged: strings.notChanged
    }
  }
}
