import SwiftUI

#if DEBUG
/// Snapshots for the canvas, built around the moment the preview renders.
private enum WatchPreviewFixtures {
  static let now = Date()

  private static var calendar: Calendar {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = .autoupdatingCurrent
    return calendar
  }

  /// `hour` o'clock, `days` from today.
  private static func at(days: Int, hour: Int) -> Date {
    let day = calendar.date(byAdding: .day, value: days, to: calendar.startOfDay(for: now)) ?? now
    return calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day) ?? day
  }

  private static func event(
    _ id: String,
    _ title: String,
    from start: Date,
    minutes: Double = 60,
    room: String? = "Studio B",
    reminderMinutes: Int? = nil,
    ageRating: String? = nil,
    summary: String? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: title,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: start.addingTimeInterval(minutes * 60).timeIntervalSince1970 * 1_000,
      location: "ConPaws Convention Center",
      room: room,
      reminderMinutes: reminderMinutes,
      ageRating: ageRating,
      summary: summary
    )
  }

  private static func snapshot(
    _ events: [ConPawsEventSnapshot],
    options: [ConPawsEventSnapshot]? = nil
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "preview-convention",
          name: "ConPaws Preview Con",
          startAtMs: at(days: -1, hour: 0).timeIntervalSince1970 * 1_000,
          endAtMs: at(days: 4, hour: 23).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
          dateRangeLabel: "Preview dates",
          events: events,
          options: options
        ),
      ]
    )
  }

  /// Today's pick is over and three are left. Three, not two: Up Next takes
  /// the first, so only the other two can show under Later.
  static var later: ConPawsSnapshot {
    snapshot([
      event("ended", "Opening Ceremonies", from: now.addingTimeInterval(-7_200), room: "Main Ballroom"),
      event("tomorrow-10", "Tabletop Games 101", from: at(days: 1, hour: 10)),
      event("tomorrow-11", "Music Production Workshop", from: at(days: 1, hour: 11), room: "Hall A"),
      event("later-14", "Maker Skills Roundtable", from: at(days: 3, hour: 14), ageRating: "18+ Adult"),
    ])
  }

  /// A panel running now and the next starting in 20 minutes inside its
  /// 30-minute reminder: the leave window, with a ticking timer.
  static var leaveWindow: ConPawsSnapshot {
    snapshot([
      event("running", "Fursuit Parade Staging", from: now.addingTimeInterval(-1_800), room: "Main Ballroom"),
      event("next", "Fursuit Meetup", from: now.addingTimeInterval(1_200), room: "Hall A", reminderMinutes: 30),
      event("after", "Art Show Tour", from: now.addingTimeInterval(7_200)),
    ])
  }

  /// Saved panels plus two unsaved ones in this hour, with descriptions.
  static var options: ConPawsSnapshot {
    let hour = calendar.dateInterval(of: .hour, for: now)?.start ?? now
    return snapshot(
      [
        event(
          "running",
          "Fursuit Parade Staging",
          from: now.addingTimeInterval(-1_800),
          room: "Main Ballroom",
          summary: "Line up by colour group. Handlers stay with their suiters until the parade leaves."
        ),
        event("after", "Art Show Tour", from: now.addingTimeInterval(7_200)),
      ],
      options: [
        event(
          "option-1",
          "Beginner Fursuit Making",
          from: hour.addingTimeInterval(1_800),
          room: "Hall B",
          summary: "Foam, fleece and patterning basics. Bring nothing; materials are provided."
        ),
        event("option-2", "Writers' Circle", from: hour, room: "Studio C"),
      ]
    )
  }

  /// Nothing saved yet, with the same two options running this hour.
  static var noPicksWithOptions: ConPawsSnapshot {
    snapshot([], options: options.conventions[0].options)
  }

  static var savedPanel: (event: ConPawsEventSnapshot, convention: ConPawsConventionSnapshot) {
    let convention = options.conventions[0]
    return (convention.events[0], convention)
  }
}

#Preview("Home · Later") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.later,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.later.locale)
}

#Preview("Home · Options") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.options,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.options.locale)
}

#Preview("Home · No picks, options") {
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.noPicksWithOptions,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.noPicksWithOptions.locale)
}

#Preview("Detail · Remove") {
  let found = WatchPreviewFixtures.savedPanel
  NavigationStack {
    EventDetailView(
      event: found.event,
      convention: found.convention,
      now: WatchPreviewFixtures.now,
      strings: .english,
      planAction: WatchPlanAction(kind: .remove, isPending: false) {}
    )
  }
}

#Preview("Detail · Pending") {
  let found = WatchPreviewFixtures.savedPanel
  NavigationStack {
    EventDetailView(
      event: found.event,
      convention: found.convention,
      now: WatchPreviewFixtures.now,
      strings: .english,
      planAction: WatchPlanAction(kind: .add, isPending: true) {}
    )
  }
}

#Preview("Home · Always On") {
  // The canvas cannot drop a wrist, so this sets what the system sets: the
  // dimmed display and the privacy redaction. Titles and rooms should turn to
  // bars; the timer, the clock times and the convention name should not.
  NavigationStack {
    WatchRootView(
      snapshot: WatchPreviewFixtures.leaveWindow,
      now: WatchPreviewFixtures.now,
      isUsingSavedSchedule: false,
      snapshotDate: nil
    )
  }
  .environment(\.locale, WatchPreviewFixtures.leaveWindow.locale)
  .environment(\.isLuminanceReduced, true)
  .environment(\.redactionReasons, .privacy)
}
#endif
