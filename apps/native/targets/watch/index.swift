import SwiftUI

@main
struct ConPawsWatchApp: App {
  /// Hears a tapped notification, which the scene cannot: a panel reminder
  /// tapped on the wrist opens that panel. See `WatchAppDelegate`.
  @WKApplicationDelegateAdaptor private var appDelegate: WatchAppDelegate

  /// Made as the app launches, so WatchConnectivity is activated, with its
  /// delegate set, before anything is delivered. `ContentView` observes it.
  private let store = WatchScheduleStore.shared

  var body: some Scene {
    WindowGroup {
      ContentView(store: store, reminders: appDelegate.reminders)
    }
    // A schedule from the phone launches or wakes the app in the background.
    // Without this the app is suspended before it is stored, and the
    // complication keeps the old one until the Watch app is opened.
    .backgroundTask(.watchConnectivity) {
      await WatchScheduleStore.shared.drainPendingContent()
    }
  }
}
