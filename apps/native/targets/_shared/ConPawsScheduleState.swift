import Foundation

enum ConPawsScheduleState {
  case noConvention
  case countdown(ConPawsConventionSnapshot)
  case next(
    ConPawsConventionSnapshot,
    current: ConPawsEventSnapshot?,
    upcoming: ConPawsEventSnapshot
  )
  case currentOnly(ConPawsConventionSnapshot, ConPawsEventSnapshot)
  case finished(ConPawsConventionSnapshot)
  case noPicks(ConPawsConventionSnapshot)
}

enum ConPawsScheduleResolver {
  static func resolve(
    snapshot: ConPawsSnapshot?,
    selectedConventionID: String?,
    skipCountdown: Bool,
    now: Date
  ) -> ConPawsScheduleState {
    guard let snapshot else { return .noConvention }

    let convention: ConPawsConventionSnapshot?
    if let selectedConventionID {
      convention = snapshot.conventions.first { $0.id == selectedConventionID }
    } else {
      let nowMs = now.timeIntervalSince1970 * 1_000
      let activeOrUpcoming = snapshot.conventions.filter { lastActiveMs(of: $0) >= nowMs }
      // Among conventions already underway, one with saved panels outranks
      // one without: two active conventions on the same dates used to
      // resolve to whichever came first, and an empty one then hid the plan
      // behind "No panels picked". Only conventions that have started take
      // part, so a far-off convention with one saved panel never displaces
      // the convention the user is at today.
      let underwayWithPicks = activeOrUpcoming.filter {
        $0.startAtMs <= nowMs && !$0.events.isEmpty
      }
      convention = (underwayWithPicks.isEmpty ? activeOrUpcoming : underwayWithPicks)
        .min { $0.startAtMs < $1.startAtMs }
        ?? snapshot.conventions.max { $0.endAtMs < $1.endAtMs }
    }

    guard let convention else { return .noConvention }
    if !skipCountdown, now < countdownEnd(of: convention) { return .countdown(convention) }
    guard !convention.events.isEmpty else { return .noPicks(convention) }

    let current = convention.events
      .filter { event in
        let start = Date(timeIntervalSince1970: event.startAtMs / 1_000)
        let end = effectiveEnd(of: event)
        return start <= now && now < end
      }
      // If saved events overlap, keep the one that started most recently.
      .max { $0.startAtMs < $1.startAtMs }
    let upcoming = convention.events
      .filter { Date(timeIntervalSince1970: $0.startAtMs / 1_000) > now }
      .min { $0.startAtMs < $1.startAtMs }

    if let upcoming {
      return .next(convention, current: current, upcoming: upcoming)
    }
    if let current {
      return .currentOnly(convention, current)
    }
    return .finished(convention)
  }

  /// The longest a saved panel keeps its convention active, from the panel's
  /// start. A bad end time weeks out would otherwise hide the next
  /// convention's countdown for that long. Mirrored by
  /// `WATCH_LONGEST_COUNTED_PANEL_MS` in src/services/watch-snapshot.ts.
  static let longestCountedPanelMs: Double = 86_400_000

  /// The last moment `resolve` counts a convention as active or upcoming when
  /// it chooses one itself, inclusive: the convention's end, or a saved
  /// panel's end when one runs later. The phone sends the end as the midnight
  /// after the last day, so a closing-night panel often runs past it.
  /// Mirrored by `watchLastActiveMs` in src/services/watch-snapshot.ts.
  static func lastActiveMs(of convention: ConPawsConventionSnapshot) -> Double {
    convention.events.reduce(convention.endAtMs) { latest, event in
      max(latest, min(effectiveEndMs(of: event), event.startAtMs + longestCountedPanelMs))
    }
  }

  /// The moment the pre-convention countdown gives way to the plan: the
  /// convention's start, or earlier when its first saved panel starts first
  /// or that panel's reminder fires first. A meet-up saved for the evening
  /// before day one used to run behind "Starts tomorrow" from its reminder
  /// to its end. The first panel is the one `resolve` puts in Up Next, so its
  /// reminder is the one whose leave countdown takes over; the complication's
  /// timeline plans an entry here too.
  static func countdownEnd(of convention: ConPawsConventionSnapshot) -> Date {
    guard let first = convention.events.min(by: { $0.startAtMs < $1.startAtMs }) else {
      return convention.startDate
    }
    // The same arithmetic as `isInReminderWindow`, so the leave window opens
    // on the very moment the countdown ends.
    let due = first.reminderMinutes.flatMap { minutes in
      minutes > 0 ? first.startDate.addingTimeInterval(-Double(minutes) * 60) : nil
    } ?? first.startDate
    return min(convention.startDate, due)
  }

  static func isInReminderWindow(_ event: ConPawsEventSnapshot, now: Date) -> Bool {
    guard let minutes = event.reminderMinutes, minutes > 0 else { return false }
    let start = Date(timeIntervalSince1970: event.startAtMs / 1_000)
    return now >= start.addingTimeInterval(-Double(minutes) * 60) && now < start
  }

  /// Whether the event's reminder has yet to fire.
  ///
  /// Once it has, "Reminder at 1:45 PM" describes the past, so a glanceable
  /// card drops the line. The boundary matches `isInReminderWindow`: the
  /// minute the window opens is the minute the reminder fired.
  static func isReminderPending(_ event: ConPawsEventSnapshot, now: Date) -> Bool {
    guard let minutes = event.reminderMinutes, minutes >= 0 else { return false }
    let start = Date(timeIntervalSince1970: event.startAtMs / 1_000)
    return now < start.addingTimeInterval(-Double(minutes) * 60)
  }

  static func effectiveEnd(of event: ConPawsEventSnapshot) -> Date {
    Date(timeIntervalSince1970: effectiveEndMs(of: event) / 1_000)
  }

  /// How long a panel with no published end counts as running, for the
  /// resolver and for "Other options this hour" alike. Mirrored by `HOUR_MS`
  /// in `watchLastActiveMs` (src/services/watch-snapshot.ts).
  static let unknownEndDuration: TimeInterval = 3_600

  /// In milliseconds, so convention bounds compare exactly.
  static func effectiveEndMs(of event: ConPawsEventSnapshot) -> Double {
    event.endAtMs ?? event.startAtMs + unknownEndDuration * 1_000
  }
}
