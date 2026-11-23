import SwiftUI

struct ContentView: View {
  @ObservedObject var store: WatchScheduleStore
  @State private var path: [WatchRoute] = []

  var body: some View {
    // NavigationStack OUTSIDE the TimelineView: with the stack inside, the
    // minute tick that changed the root branch (con started, snapshot
    // emptied) rebuilt the stack and popped the reader out of a detail
    // screen. `.everyMinute` aligns ticks to the minute boundary and is the
    // cadence the system throttles correctly in Always On.
    NavigationStack(path: $path) {
      TimelineView(.everyMinute) { context in
        WatchRootView(
          snapshot: store.snapshot,
          now: context.date,
          isUsingSavedSchedule: store.isUsingSavedSchedule(at: context.date),
          snapshotDate: store.snapshotDate
        )
      }
      // Registered once, outside the TimelineView closure. Each destination
      // runs its own minute timeline against the store, so a pushed screen
      // stays live without depending on the root re-creating it.
      .navigationDestination(for: WatchRoute.self) { route in
        WatchRouteView(store: store, route: route)
      }
    }
    // On the stack, not the root view: pushed screens inherit the stack's
    // environment rather than the root's, and every time they format has to
    // be in the app's language, which is a phone setting, not the watch's.
    .environment(\.locale, store.snapshot.locale)
    // A complication tap: the panel the card named, over the home screen, or
    // the home screen alone for a card without one. Without this the app came
    // forward on whatever screen it was last left on.
    .onOpenURL { url in
      guard let link = ConPawsWatchLink(url: url) else { return }
      path = WatchRoute.path(opening: link, in: store.snapshot)
    }
    .onChange(of: store.snapshot.generatedAtMs) {
      // A new schedule can drop the event a detail screen is showing. Pop it
      // rather than leave the reader on an empty screen.
      let pruned = WatchRoute.pruned(path, against: store.snapshot)
      if pruned != path { path = pruned }
    }
  }
}
