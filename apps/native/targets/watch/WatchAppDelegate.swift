import UserNotifications
import WatchKit

/// The app's delegate, for the one thing the SwiftUI scene cannot hear: a
/// notification being tapped.
///
/// A panel reminder the phone files shows on the Watch when the phone is
/// locked or asleep. Tapping it opens this app, which without a delegate came
/// forward on whatever screen it was last left on. This hands the reminder's
/// panel to `reminders`, and the scene shows it (see `TappedReminderSheet`).
///
/// It implements no `handle(_:)` for background tasks: one here would take
/// every task from the scene's `.backgroundTask(.watchConnectivity)` handler,
/// and with it the complication's updates while the app is closed.
@MainActor
final class WatchAppDelegate: NSObject, WKApplicationDelegate, UNUserNotificationCenterDelegate {
  /// The panel the last tapped reminder named, until the scene shows it.
  let reminders = WatchReminderOpener()

  func applicationDidFinishLaunching() {
    // Before launching finishes, or the tap that launched the app is lost.
    UNUserNotificationCenter.current().delegate = self
  }

  /// Without this, watchOS silences any of this app's notifications that
  /// arrive while the app is frontmost, and with Always On it stays frontmost
  /// wrist-down through the very minutes a reminder is for.
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.banner, .list, .sound]
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    // A tap on the notification itself. A dismissal reaches here only for a
    // category that asks for it, and reminders carry no buttons.
    guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
    let content = response.notification.request.content
    // Read here, off the main actor, so only the Sendable link crosses.
    guard
      let link = ConPawsReminderNotification.link(
        categoryIdentifier: content.categoryIdentifier,
        userInfo: content.userInfo
      )
    else { return }
    await reminders.open(link)
  }
}
