import SwiftUI

@main
struct ConPawsWatchApp: App {
  @StateObject private var store = WatchScheduleStore()

  init() {
    #if DEBUG
    runWatchScheduleSelfCheck()
    #endif
  }

  var body: some Scene {
    WindowGroup {
      ContentView(store: store)
    }
  }
}
