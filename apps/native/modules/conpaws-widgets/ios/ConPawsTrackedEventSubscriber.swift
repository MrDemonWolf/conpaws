#if os(iOS)
import ExpoModulesCore
import UIKit

// The Live Activity's Stop button is performed in this process, possibly on a
// background launch, right after the app finishes launching. Registering here
// means the observer exists before that intent posts its notification; waiting
// for JS to subscribe would miss it.
public final class ConPawsTrackedEventSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // The observer lives as long as the process, so the token is not kept.
    _ = NotificationCenter.default.addObserver(
      forName: ConPawsTrackedEventStop.interactionNotification,
      object: nil,
      queue: nil
    ) { notification in
      guard ConPawsTrackedEventStop.record(userInfo: notification.userInfo) else { return }
      Task { @MainActor in
        await Self.endActivitiesWithBackgroundTime()
      }
    }
    return false
  }

  /// The intent returns as soon as it has posted, so the app can be suspended
  /// again mid-way through ending the activity. A short background task keeps
  /// it awake for that; ending an activity takes well under its budget.
  @MainActor
  private static func endActivitiesWithBackgroundTime() async {
    guard #available(iOS 16.2, *) else { return }
    let application = UIApplication.shared
    let taskID = application.beginBackgroundTask(withName: "ConPaws tracked event stop")
    await ConPawsTrackedEventStop.endRunningActivities()
    if taskID != .invalid {
      application.endBackgroundTask(taskID)
    }
  }
}
#endif
