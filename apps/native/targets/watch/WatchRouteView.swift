import SwiftUI

/// A pushed screen, re-resolved against the store every minute.
struct WatchRouteView: View {
  @ObservedObject var store: WatchScheduleStore
  let route: WatchRoute

  var body: some View {
    TimelineView(.everyMinute) { context in
      let snapshot = store.snapshot
      switch route {
      case .today:
        TodayListView(
          schedule: WatchScheduleProjection(snapshot: snapshot, now: context.date),
          strings: snapshot.strings
        )
      case .event(let conventionID, let eventID):
        // A miss lasts one frame at most: ContentView pops the route as soon
        // as the snapshot that dropped the event lands.
        if let found = snapshot.event(id: eventID, in: conventionID) {
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.remove, found.event, found.convention, now: context.date)
          )
        }
      case .option(let conventionID, let eventID):
        if let found = snapshot.event(id: eventID, in: conventionID) {
          // Added from this screen and confirmed by the phone.
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.remove, found.event, found.convention, now: context.date),
            confirmsSaved: true
          )
        } else if let found = snapshot.option(id: eventID, in: conventionID) {
          EventDetailView(
            event: found.event,
            convention: found.convention,
            now: context.date,
            strings: snapshot.strings,
            planAction: planAction(.add, found.event, found.convention, now: context.date)
          )
        }
      }
    }
  }

  private func planAction(
    _ kind: WatchPlanAction.Kind,
    _ event: ConPawsEventSnapshot,
    _ convention: ConPawsConventionSnapshot,
    now: Date
  ) -> WatchPlanAction {
    WatchPlanAction(
      kind: kind,
      // Either direction: a remove waiting on the phone also blocks an add.
      isPending: store.pendingAction(for: event.id, now: now) != nil
    ) { [store] in
      store.send(kind == .add ? .save : .remove, event: event, convention: convention)
    }
  }
}
