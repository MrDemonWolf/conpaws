import Foundation

/// A panel reminder the phone filed, read back on the Watch when it is tapped.
///
/// The phone (src/services/notifications.ts) files each reminder with this
/// category and the panel's ids in its `data`, which expo-notifications puts
/// at the top level of the notification's user info. iOS shows it on the
/// Watch when the phone is locked or asleep, and a tap there opens this app,
/// which hands the notification here. Foundation-only, so swift-tests covers
/// it; `notifications-watch-contract.test.ts` holds the spellings to the
/// phone's.
enum ConPawsReminderNotification {
  static let categoryIdentifier = "conpaws.reminder"
  static let kind = "event-reminder"

  static let kindKey = "kind"
  static let eventKey = "eventId"
  static let conventionKey = "conventionId"

  /// The panel a reminder names, or nil for any other notification and for
  /// a reminder missing either id.
  ///
  /// The kind alone also counts: a reminder filed by a phone build from
  /// before the category stays pending, without one, until the phone app is
  /// next opened and files it again.
  static func link(categoryIdentifier: String, userInfo: [AnyHashable: Any]) -> ConPawsWatchLink? {
    guard
      categoryIdentifier == Self.categoryIdentifier || userInfo[kindKey] as? String == kind
    else { return nil }
    // `as? String` also turns away the NSNull a JSON null arrives as.
    guard
      let conventionID = userInfo[conventionKey] as? String, !conventionID.isEmpty,
      let eventID = userInfo[eventKey] as? String, !eventID.isEmpty
    else { return nil }
    return .event(conventionID: conventionID, eventID: eventID)
  }

  /// The screen a tapped reminder shows: its panel's, while the plan holds
  /// it. A panel removed on the phone, or one in a convention this Watch was
  /// not sent, shows nothing, so the app comes forward where it was rather
  /// than on an empty screen.
  static func route(for link: ConPawsWatchLink, in snapshot: ConPawsSnapshot) -> WatchRoute? {
    WatchRoute.path(opening: link, in: snapshot).first
  }

  /// Whether a reminder's screen still has a panel to show once a new
  /// schedule arrives; the same rule that pops a pushed screen.
  static func keeps(_ route: WatchRoute, in snapshot: ConPawsSnapshot) -> Bool {
    WatchRoute.pruned([route], against: snapshot) == [route]
  }
}

/// A tapped reminder waiting, briefly, for a schedule that holds its panel.
///
/// A tap can launch the app cold on a saved schedule older than the
/// reminder: the phone's newer one arrives over WatchConnectivity moments
/// later. Until then the panel is not there to open, so the tap waits for
/// it rather than being dropped.
struct ConPawsPendingReminderTap: Equatable, Sendable {
  /// Covers a cold launch's WatchConnectivity activation and first delivery,
  /// and nothing later: a sheet should not appear long after the tap.
  static let patience: TimeInterval = 10

  enum Outcome: Equatable, Sendable {
    /// The schedule holds the panel: show it.
    case open(WatchRoute)
    /// Not yet, and there is still time for a schedule that holds it.
    case wait
    /// Too late to open anything: forget the tap.
    case drop
  }

  let link: ConPawsWatchLink
  let tappedAt: Date

  /// What to do with the tap once `snapshot` is the app's schedule. The clock
  /// comes first, so a schedule that does arrive, but too late, opens
  /// nothing either.
  func outcome(in snapshot: ConPawsSnapshot, now: Date) -> Outcome {
    guard now.timeIntervalSince(tappedAt) < Self.patience else { return .drop }
    guard let route = ConPawsReminderNotification.route(for: link, in: snapshot) else { return .wait }
    return .open(route)
  }
}
