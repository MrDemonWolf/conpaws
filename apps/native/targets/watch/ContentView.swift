import SwiftUI

struct ContentView: View {
  @ObservedObject var store: WatchScheduleStore
  /// The panel the last tapped reminder named. See `WatchAppDelegate`.
  let reminders: WatchReminderOpener
  @Environment(\.scenePhase) private var scenePhase
  @State private var path: [WatchRoute] = []
  /// A tapped reminder whose panel the schedule does not hold yet. See
  /// `ConPawsPendingReminderTap`.
  @State private var waitingReminder: ConPawsPendingReminderTap?

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
      // The newer tap wins over a reminder still waiting for its schedule.
      waitingReminder = nil
      path = WatchRoute.path(opening: link, in: store.snapshot)
    }
    // A tapped reminder: its panel, pushed over the home screen like a
    // complication's, with its room and live STARTS IN timer. `initial` too:
    // a tap that launched the app can land before this view first appears.
    .onChange(of: reminders.link, initial: true) {
      guard let link = reminders.take() else { return }
      // A panel the saved schedule does not hold may be in the one the phone
      // is about to deliver after a cold launch, so it waits briefly for
      // that, then leaves the app where it was.
      waitingReminder = ConPawsPendingReminderTap(link: link, tappedAt: .now)
      pushWaitingReminder()
    }
    .onChange(of: store.snapshot.generatedAtMs) {
      // A new schedule can drop the event a detail screen is showing. Pop it
      // rather than leave the reader on an empty screen.
      let pruned = WatchRoute.pruned(path, against: store.snapshot)
      if pruned != path { path = pruned }
      pushWaitingReminder()
    }
    .onChange(of: scenePhase) { _, phase in
      // A reminder's moment has passed once the app leaves the screen, so a
      // schedule arriving in the background pushes nothing. Wrist-down in
      // Always On is `.inactive`, so a wait there carries on.
      if phase == .background { waitingReminder = nil }
    }
  }

  /// Pushes the waiting reminder's panel once the schedule holds it. No timer
  /// is needed to give up: a schedule arriving after the patience runs out is
  /// turned away when it arrives.
  private func pushWaitingReminder() {
    switch waitingReminder?.outcome(in: store.snapshot, now: .now) {
    case .open(let opened):
      path = opened
      waitingReminder = nil
    case .drop:
      waitingReminder = nil
    case .wait, nil:
      break
    }
  }
}
