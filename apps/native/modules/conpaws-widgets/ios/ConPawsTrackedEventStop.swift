import ActivityKit
import Foundation

/// Native half of the tracked event's Stop button.
///
/// expo-widgets runs the Live Activity's buttons as a `LiveActivityIntent` in
/// the app process, launching it in the background when it is not running,
/// and only reports the press by posting a notification. Its own module starts
/// listening once JS subscribes, so a press that cold-launches the app is lost
/// before JS ever loads. This records the press and ends the activity here,
/// without waiting for JS.
enum ConPawsTrackedEventStop {
  /// Mirrors `TRACKED_EVENT_STOP_TARGET` in src/lib/tracked-event.types.ts.
  static let stopTarget = "conpaws-tracked-event-stop"

  /// Mirrors `TRACKED_EVENT_ACTIVITY_NAME` in src/lib/tracked-event.types.ts.
  static let activityName = "ConPawsTrackedEvent"

  /// The name expo-widgets posts button presses under (`onUserInteraction` in
  /// its WidgetsModule.swift). It is internal there, so it is spelled out here
  /// and pinned by src/lib/tracked-event-native-contract.test.ts.
  static let interactionNotification = Notification.Name("onExpoWidgetsUserInteraction")

  /// Device-only flag that JS reads, and clears, on its next reconcile.
  private static let pendingStopKey = "conpaws.trackedEvent.pendingStop"

  /// Records a Stop press. Returns true when the notification was one, so the
  /// caller knows to end the running activities.
  ///
  /// UserDefaults is thread-safe, which matters because the intent posts from
  /// whatever thread the system runs it on.
  static func record(userInfo: [AnyHashable: Any]?) -> Bool {
    guard
      let eventData = userInfo?["eventData"] as? [String: Any],
      eventData["target"] as? String == stopTarget
    else {
      return false
    }
    UserDefaults.standard.set(true, forKey: pendingStopKey)
    return true
  }

  /// Ends every running tracked-event Live Activity straight away, so Stop
  /// works even when the app never reaches JS before it is suspended again.
  @available(iOS 16.2, *)
  static func endRunningActivities() async {
    for activity in Activity<LiveActivityAttributes>.activities
    where activity.content.state.name == activityName {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  /// True once per Stop press since the last call.
  static func consumePending() -> Bool {
    let defaults = UserDefaults.standard
    guard defaults.bool(forKey: pendingStopKey) else { return false }
    defaults.removeObject(forKey: pendingStopKey)
    return true
  }
}

/// A copy of expo-widgets' attributes type, which is internal to its module.
///
/// ActivityKit is expected to match activities by the attributes type's
/// unqualified name and Codable shape, the same way a widget extension's copy
/// of an app's attributes type matches. If it ever refuses this parallel type
/// at runtime, `activities` comes back empty and nothing is ended here; the
/// pending-stop flag is still recorded, and JS ends the activity on its next
/// reconcile. The test pins the name and stored properties to expo-widgets.
struct LiveActivityAttributes: ActivityAttributes {
  var url: String?

  struct ContentState: Codable, Hashable {
    var name: String
    var props: String?
  }
}
