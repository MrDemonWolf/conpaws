import Foundation
import Testing
@testable import ConPawsShared

/// The Watch complication's timeline. The Watch reloads it only when a new
/// phone snapshot arrives, so every moment the card reads differently has to
/// be an entry already, whatever the snapshot's age.
struct ComplicationTimelineTests {
  private let zone = TimeZone(identifier: "America/Chicago")!

  // MARK: Midnight

  @Test func aPanelOnAnotherDayGetsAnEntryAtTheConventionsMidnight() {
    // 11 PM on day 1, the snapshot an hour old: "Tomorrow · 10:00 AM" must
    // become "10:00 AM" at midnight, not at 10:00.
    let panel = event("opening", from: local(22, 10), until: local(22, 11))
    let value = snapshot([panel], generatedAt: local(21, 22))
    let dates = plannedDates(value, now: local(21, 23))
    #expect(dates.contains(local(22, 0)))
  }

  @Test func aFreshSnapshotAlsoGetsTheMidnightEntry() {
    let panel = event("opening", from: local(22, 10), until: local(22, 11))
    let value = snapshot([panel], generatedAt: local(21, 23))
    #expect(plannedDates(value, now: local(21, 23)).contains(local(22, 0)))
  }

  // MARK: Fresh snapshots

  @Test func aFreshSnapshotGetsAnEntryWhenTheNextPanelStarts() {
    let value = snapshot(
      [
        event("art-jam", from: local(21, 14), until: local(21, 14, 45)),
        event("trivia", from: local(21, 15, 30), until: local(21, 16, 30)),
      ],
      generatedAt: local(21, 13, 50)
    )
    let dates = plannedDates(value, now: local(21, 13, 50))
    #expect(dates.contains(local(21, 14)))
    #expect(dates.contains(local(21, 14, 45)))
  }

  @Test func aFreshSnapshotGetsAnEntryWhenTheRunningPanelEnds() {
    let value = snapshot(
      [event("running", from: local(21, 13), until: local(21, 14, 10))],
      generatedAt: local(21, 13, 50)
    )
    #expect(plannedDates(value, now: local(21, 13, 50)).contains(local(21, 14, 10)))
  }

  @Test func aLeaveWindowOpeningAfterAFreshSnapshotTicksEveryMinute() {
    let value = snapshot(
      [event("art-jam", from: local(21, 14), until: local(21, 14, 45), reminderMinutes: 10)],
      generatedAt: local(21, 13, 45)
    )
    let dates = plannedDates(value, now: local(21, 13, 45))
    for minute in 50...59 {
      #expect(dates.contains(local(21, 13, minute)), "missing 13:\(minute)")
    }
    #expect(dates.contains(local(21, 14)))
  }

  // MARK: Relevance

  @Test func aPanelWithoutAReminderIsRelevantFromHalfAnHourBefore() throws {
    let value = snapshot(
      [event("art-jam", from: local(21, 14), until: local(21, 14, 45))],
      generatedAt: local(21, 13)
    )
    let plan = ConPawsComplicationTimeline.plan(snapshot: value, now: local(21, 13, 20))
    #expect(plan.first?.relevantUntil == nil)
    let halfHourBefore = try #require(plan.first { $0.date == local(21, 13, 30) })
    #expect(halfHourBefore.relevantUntil == local(21, 14, 30))
    let atStart = try #require(plan.first { $0.date == local(21, 14) })
    #expect(atStart.relevantUntil == local(21, 14, 30))
  }

  @Test func withNothingScheduledTheTimelineStillEnds() {
    let now = local(21, 12)
    let plan = ConPawsComplicationTimeline.plan(snapshot: .empty, now: now)
    #expect(plan.map(\.date) == [now, now.addingTimeInterval(ConPawsComplicationTimeline.idleRefresh)])
    #expect(plan.allSatisfy { $0.relevantUntil == nil })
  }

  // MARK: Completeness

  /// Every minute between two entries reads exactly like the earlier entry:
  /// what the card would show had it been redrawn then.
  @Test(arguments: [0, 13 * 60 + 45, 22 * 60 + 40])
  func noEntryLeavesAStaleCardOnScreen(minutesIntoDay: Int) {
    let events = [
      event("breakfast", from: local(21, 9), until: local(21, 10)),
      event("overlap", from: local(21, 9, 30), until: local(21, 9, 50)),
      event("no-end", from: local(21, 11)),
      event("art-jam", from: local(21, 14), until: local(21, 14, 45), reminderMinutes: 10),
      event("trivia", from: local(21, 15, 30), until: local(21, 16, 30), reminderMinutes: 60),
      event("late-show", from: local(21, 23, 30), until: local(22, 0, 30), reminderMinutes: 45),
      event("opening", from: local(22, 10), until: local(22, 11)),
    ]
    let now = local(21, 0).addingTimeInterval(TimeInterval(minutesIntoDay * 60))
    let value = snapshot(events, generatedAt: now)
    let plan = ConPawsComplicationTimeline.plan(snapshot: value, now: now)
    let dates = plan.map(\.date)
    #expect(dates == dates.sorted())
    #expect(Set(dates).count == dates.count)
    guard let last = dates.last else { return }

    var moment = now
    while moment < last {
      let shown = dates.last { $0 <= moment } ?? now
      #expect(
        frame(value, at: moment) == frame(value, at: shown),
        "stale card at \(moment) from the \(shown) entry"
      )
      moment.addTimeInterval(60)
    }
  }

  // MARK: Fixtures

  private func plannedDates(_ snapshot: ConPawsSnapshot, now: Date) -> [Date] {
    ConPawsComplicationTimeline.plan(snapshot: snapshot, now: now).map(\.date)
  }

  /// Nov 2026 in Chicago, the convention's own clock.
  private func local(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    return calendar.date(
      from: DateComponents(year: 2026, month: 11, day: day, hour: hour, minute: minute)
    )!
  }

  /// What the card says at `date`, in the terms that change its text.
  private func frame(_ snapshot: ConPawsSnapshot, at date: Date) -> String {
    let projection = ConPawsComplicationProjection(snapshot: snapshot, now: date)
    let strings = ConPawsStrings.resolve("en")
    let stale = ConPawsSnapshotAge.isStale(generatedAtMs: snapshot.generatedAtMs, now: date)
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    func day(_ event: ConPawsEventSnapshot) -> Int {
      let start = Date(timeIntervalSince1970: event.startAtMs / 1_000)
      return calendar.dateComponents(
        [.day],
        from: calendar.startOfDay(for: date),
        to: calendar.startOfDay(for: start)
      ).day ?? 0
    }
    let shown: String = switch projection.state {
    case .comingUp(let convention):
      "coming \(convention.id)"
    case .leave(let current, let next, _):
      "leave \(current?.id ?? "-") \(next.id) +\(day(next)) "
        + ConPawsCountdown.leaveLead(
          from: date,
          to: Date(timeIntervalSince1970: next.startAtMs / 1_000),
          timeZone: zone,
          strings: strings
        )
    case .next(let current, let next, _):
      "next \(current?.id ?? "-") \(next.id) +\(day(next))"
    case .current(let event, _):
      "current \(event.id)"
    case .finished:
      "finished"
    case .noPicks:
      "no picks"
    case .noConvention:
      "no convention"
    }
    return "\(shown) stale:\(stale)"
  }

  private func snapshot(_ events: [ConPawsEventSnapshot], generatedAt: Date) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: generatedAt.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "con",
          name: "Convention",
          startAtMs: local(20, 8).timeIntervalSince1970 * 1_000,
          endAtMs: local(23, 18).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: zone.identifier,
          dateRangeLabel: "",
          events: events,
          options: nil
        ),
      ]
    )
  }

  private func event(
    _ id: String,
    from start: Date,
    until end: Date? = nil,
    reminderMinutes: Int? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: id,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.map { $0.timeIntervalSince1970 * 1_000 },
      location: nil,
      room: nil,
      reminderMinutes: reminderMinutes,
      ageRating: nil,
      summary: nil
    )
  }
}
