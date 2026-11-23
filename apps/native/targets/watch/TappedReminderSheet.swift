import SwiftUI

extension View {
  /// Shows the panel a tapped reminder names over whatever screen the app
  /// is on. See `TappedReminderSheet`.
  func showsTappedReminders(from opener: WatchReminderOpener, store: WatchScheduleStore) -> some View {
    modifier(TappedReminderSheet(opener: opener, store: store))
  }
}

/// A tapped reminder's panel, with its room and its live STARTS IN timer,
/// shown over whatever screen the app was on.
///
/// Presented rather than pushed: the navigation path belongs to ContentView,
/// and this sits outside it. Closing the sheet puts the reader back where
/// they were. The panel's screen is the same `WatchRouteView` a pushed one
/// is, so Always On, privacy and VoiceOver behave the same.
struct TappedReminderSheet: ViewModifier {
  let opener: WatchReminderOpener
  @ObservedObject var store: WatchScheduleStore
  @Environment(\.scenePhase) private var scenePhase
  @State private var screen: ReminderScreen?

  func body(content: Content) -> some View {
    content
      .sheet(item: $screen) { screen in
        NavigationStack {
          WatchRouteView(store: store, route: screen.route)
        }
        // A sheet takes its environment from here, outside the stack that
        // sets the app's language, which is a phone setting.
        .environment(\.locale, store.snapshot.locale)
      }
      // `initial` too: a tap that launched the app can land before this
      // view first appears.
      .onChange(of: opener.link, initial: true) {
        guard let link = opener.take() else { return }
        // A panel the plan no longer holds leaves the app where it was.
        guard let route = ConPawsReminderNotification.route(for: link, in: store.snapshot) else { return }
        screen = ReminderScreen(route: route)
      }
      .onChange(of: store.snapshot.generatedAtMs) {
        // Removed on the phone, or from this screen once the phone confirms:
        // close rather than leave the reader on an empty screen.
        if let screen, !ConPawsReminderNotification.keeps(screen.route, in: store.snapshot) {
          self.screen = nil
        }
      }
      .onChange(of: scenePhase) { _, phase in
        // The reminder's moment has passed once the app leaves the screen.
        // Wrist-down in Always On is `.inactive`, so the countdown stays.
        // Left open, the sheet would also cover the panel a later
        // complication tap opens underneath it.
        if phase == .background { screen = nil }
      }
  }
}

/// A reminder's screen. Identified by its route, so a tap on another
/// reminder replaces it and the same one tapped again leaves it be.
private struct ReminderScreen: Identifiable {
  let route: WatchRoute
  var id: WatchRoute { route }
}
