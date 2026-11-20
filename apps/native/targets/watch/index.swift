import SwiftUI

@main
struct ConPawsWatchApp: App {
  /// Made as the app launches, so WatchConnectivity is activated, with its
  /// delegate set, before anything is delivered. `ContentView` observes it.
  private let store = WatchScheduleStore.shared

  init() {
    #if DEBUG
    runWatchScheduleSelfCheck()
    #endif
  }

  var body: some Scene {
    WindowGroup {
      ContentView(store: store)
    }
    // A schedule from the phone launches or wakes the app in the background.
    // Without this the app is suspended before it is stored, and the
    // complication keeps the old one until the Watch app is opened.
    .backgroundTask(.watchConnectivity) {
      await WatchScheduleStore.shared.drainPendingContent()
    }
  }
}
