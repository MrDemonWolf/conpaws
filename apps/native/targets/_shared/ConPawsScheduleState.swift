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
      let activeOrUpcoming = snapshot.conventions.filter {
        $0.endAtMs >= nowMs || $0.events.contains { $0.startAtMs >= nowMs }
      }
      convention = activeOrUpcoming.min { $0.startAtMs < $1.startAtMs }
        ?? snapshot.conventions.max { $0.endAtMs < $1.endAtMs }
    }

    guard let convention else { return .noConvention }
    let conventionStart = Date(timeIntervalSince1970: convention.startAtMs / 1_000)
    if !skipCountdown, now < conventionStart { return .countdown(convention) }
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

  static func isInReminderWindow(_ event: ConPawsEventSnapshot, now: Date) -> Bool {
    guard let minutes = event.reminderMinutes, minutes > 0 else { return false }
    let start = Date(timeIntervalSince1970: event.startAtMs / 1_000)
    return now >= start.addingTimeInterval(-Double(minutes) * 60) && now < start
  }

  static func effectiveEnd(of event: ConPawsEventSnapshot) -> Date {
    Date(timeIntervalSince1970: (event.endAtMs ?? event.startAtMs + 3_600_000) / 1_000)
  }
}

enum ConPawsSnapshotAge {
  static let staleAfter: TimeInterval = 30 * 60

  static func isStale(generatedAtMs: Double, now: Date) -> Bool {
    now.timeIntervalSince1970 * 1_000 - generatedAtMs >= staleAfter * 1_000
  }
}
