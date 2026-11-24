import SwiftUI

/// The root screen for whichever state the schedule is in.
///
/// Always On redacts per view, not per screen: only event titles, rooms, age
/// ratings and descriptions are `privacySensitive`, so the system hides those
/// wrist-down while the countdown, the clock times and the convention name
/// stay readable.
/// A crowded hall can read a title off a raised wrist; the countdown is the
/// reason this app opts into Always On at all. Card fills drop too (see
/// `CardBackground`).
struct WatchRootView: View {
  let snapshot: ConPawsSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  let snapshotDate: Date?

  var body: some View {
    // Projected once per tick so every section reads the same answer.
    let schedule = WatchScheduleProjection(snapshot: snapshot, now: now)
    // The app's language, which is a setting on the phone rather than a
    // setting on this watch. It arrives with the schedule and is threaded down
    // by hand so no view can quietly fall back to the watch's own language.
    let strings = snapshot.strings

    switch schedule.state {
    case .noConvention:
      // "Open ConPaws" read oddly from inside the ConPaws watch app; these
      // purpose-built strings say where to go instead.
      EmptyScheduleView(
        title: strings.noScheduleTitle,
        message: strings.noScheduleMessage,
        systemImage: "iphone"
      )
    case .countdown(let convention):
      PreConventionView(
        convention: convention,
        now: now,
        // Its own, slower rule: nothing on this screen goes out of date in
        // half an hour.
        isUsingSavedSchedule: ConPawsSnapshotAge.isCountdownStale(snapshot, now: now),
        snapshotDate: snapshotDate,
        strings: strings
      )
    case .noPicks(let convention):
      // An empty plan is when adding from the wrist matters most -- removing
      // the last saved panel here lands on this screen -- so the hour's
      // options stay offered under the empty state rather than vanish. So do
      // saved panels the convention withdrew: with every one withdrawn the
      // plan has nothing live, and this is the only screen left to reach them.
      let options = convention.optionsThisHour(at: now)
      if schedule.isOverWithoutPicks {
        EmptyScheduleView(
          title: strings.nothingUpcomingTitle,
          message: strings.nothingUpcomingMessage,
          systemImage: "checkmark.circle"
        )
      } else if options.isEmpty, !schedule.hasWithdrawnToShow {
        EmptyScheduleView(
          title: strings.noPicksTitle,
          message: strings.noPicksWatchMessage
        )
      } else {
        NoPicksOptionsView(
          convention: convention,
          schedule: schedule,
          options: options,
          isUsingSavedSchedule: isUsingSavedSchedule,
          snapshotDate: snapshotDate,
          strings: strings
        )
      }
    case .next, .currentOnly, .finished:
      ScheduleHomeView(
        schedule: schedule,
        isUsingSavedSchedule: isUsingSavedSchedule,
        snapshotDate: snapshotDate,
        strings: strings
      )
    }
  }
}
