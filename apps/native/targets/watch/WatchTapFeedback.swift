import Observation
import SwiftUI
import WatchKit

/// What became of recent Add and Remove taps, and the buzz and spoken line
/// that tell the wearer as the phone answers.
///
/// `WatchScheduleStore` records here whenever a snapshot settles a waiting
/// tap; a plan button reads its event's reason. Kept apart from the store, an
/// `ObservableObject` the whole navigation stack observes, so only a screen
/// that reads an event's entry redraws when it changes. In memory only: a
/// reason is worth showing for minutes (`ConPawsWatchTapLog.shownFor`).
///
/// Nothing here ever reports success on its own: a tap lands only when the
/// snapshot that settles it shows the change (see
/// `ConPawsWatchCommand.result(shown:receipts:)`).
@MainActor
@Observable
final class WatchTapFeedback {
  /// The one log, shared by the store that writes it and the screens that
  /// read it.
  static let shared = WatchTapFeedback()

  private(set) var log: ConPawsWatchTapLog.Table

  /// `log` for previews; the app uses `shared`.
  init(log: ConPawsWatchTapLog.Table = [:]) {
    self.log = log
  }

  /// Why the last tap on `eventID` changed nothing, while that is still worth
  /// saying.
  func decline(for eventID: String, at now: Date) -> ConPawsWatchTapDecline? {
    ConPawsWatchTapLog.decline(for: eventID, in: log, at: now)
  }

  /// A new tap on `eventID` starts a new wait, so its old reason goes.
  func forget(_ eventID: String) {
    guard log[eventID] != nil else { return }
    log = ConPawsWatchTapLog.forgetting(eventID, in: log)
  }

  /// Keeps what a snapshot settled, keyed by event id. With `tellsWearer`,
  /// and only while the app is in front, also plays one haptic for the lot,
  /// failure if any tap was declined and success if they all landed, and
  /// has VoiceOver read one decline's reason: the screen that showed the
  /// button may already be gone, closed by the same snapshot.
  ///
  /// The haptic does nothing in the background or wrist-down anyway; the
  /// check also keeps a spoken line from arriving long after the tap, when
  /// the app is next opened.
  func record(
    _ results: [String: ConPawsWatchTapResult],
    at now: Date,
    strings: ConPawsStrings,
    tellsWearer: Bool
  ) {
    guard !results.isEmpty else { return }
    log = ConPawsWatchTapLog.recording(results, at: now, in: log)
    guard tellsWearer, WKApplication.shared().applicationState == .active else { return }
    switch ConPawsWatchTapLog.haptic(for: results.values) {
    case .success: WKInterfaceDevice.current().play(.success)
    case .failure: WKInterfaceDevice.current().play(.failure)
    case nil: break
    }
    if let decline = ConPawsWatchTapLog.announcedDecline(in: results) {
      AccessibilityNotification.Announcement(strings.declineText(decline)).post()
    }
  }
}
