import Observation

/// The panel a tapped reminder asked to open, passed from the notification
/// delegate that hears the tap to the scene that shows it.
@MainActor
@Observable
final class WatchReminderOpener {
  /// Set by a tap; the scene takes it once it has acted on it.
  private(set) var link: ConPawsWatchLink?

  /// Nonisolated so the app delegate can make one as a stored property's
  /// default: the delegate's init overrides NSObject's, which is not on the
  /// main actor. Nothing is read until a tap arrives.
  nonisolated init() {}

  func open(_ link: ConPawsWatchLink) {
    self.link = link
  }

  /// The waiting link, cleared, so the same reminder tapped again opens again.
  func take() -> ConPawsWatchLink? {
    defer { link = nil }
    return link
  }
}
