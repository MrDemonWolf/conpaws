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

  /// The phone sends a convention's start as midnight in its zone, from the
  /// date alone. Raising the card from 23:30 to 00:30 the night before day
  /// one showed nothing but a countdown turning over; saved panels raise it
  /// when it matters.
  @Test func aConventionsMidnightStartDoesNotRaiseTheCard() {
    let value = snapshot(
      conventions: [convention("con", from: local(22, 0), until: local(24, 18))],
      generatedAt: local(21, 22)
    )
    let plan = ConPawsComplicationTimeline.plan(snapshot: value, now: local(21, 23))
    let aroundMidnight = plan.filter { $0.date >= local(21, 23, 30) && $0.date <= local(22, 0, 30) }
    #expect(aroundMidnight.contains { $0.date == local(22, 0) })
    #expect(aroundMidnight.allSatisfy { $0.relevantUntil == nil })
    for moment in [local(21, 23, 30), local(21, 23, 59), local(22, 0), local(22, 0, 20)] {
      #expect(ConPawsComplicationTimeline.relevantUntil(snapshot: value, at: moment) == nil, "raised at \(moment)")
    }
  }

  @Test func withNothingScheduledTheTimelineStillEnds() {
    let now = local(21, 12)
    let plan = ConPawsComplicationTimeline.plan(snapshot: .empty, now: now)
    #expect(plan.map(\.date) == [now, now.addingTimeInterval(ConPawsComplicationTimeline.idleRefresh)])
    #expect(plan.allSatisfy { $0.relevantUntil == nil })
  }

  // MARK: Several conventions

  /// The resolver keeps a convention through its end, inclusive, so the next
  /// one takes over a moment after it. An entry at the end itself still drew
  /// the ended convention, and nothing redrew the card for six hours. The
  /// first convention's last hour-long panel starts this many minutes after
  /// its end (nil: no panels): long before, running until the end, so the
  /// plan stands on the end itself, or running past the end or starting
  /// after it, which keeps the convention until that panel ends.
  @Test(arguments: [nil, -180, -60, -30, 30] as [Int?])
  func theNextConventionTakesOverTheMomentTheFirstOneEnds(panelAfterEnd: Int?) throws {
    let end = local(23, 18)
    let panels = panelAfterEnd.map { minutes in
      let start = end.addingTimeInterval(TimeInterval(minutes * 60))
      return [event("closing", from: start, until: start.addingTimeInterval(3_600))]
    }
    let first = convention("first", from: local(20, 8), until: end, events: panels ?? [])
    let later = convention("later", from: local(27, 8), until: local(29, 18))
    let value = snapshot(conventions: [first, later], generatedAt: local(23, 16, 59))
    let now = local(23, 17)
    let panelEndAfterEnd = max((panelAfterEnd ?? -60) + 60, 0)
    let takeover = end.addingTimeInterval(TimeInterval(panelEndAfterEnd * 60 + 60))
    #expect(frame(value, at: takeover).hasPrefix("coming later"))
    if panelEndAfterEnd > 0 {
      // The panel's last minute still shows it, not the next countdown.
      #expect(frame(value, at: takeover.addingTimeInterval(-120)).hasPrefix("current first closing"))
    }
    let shown = try #require(plannedDates(value, now: now).last { $0 <= takeover })
    #expect(frame(value, at: shown) == frame(value, at: takeover))
    expectNoStaleCard(value, now: now)
  }

  /// A convention with saved panels outranks one without as soon as it
  /// starts, so its start is a change even while the other one is shown.
  @Test func aConventionWithPicksTakesOverFromOneWithoutAtItsStart() throws {
    let empty = convention("empty", from: local(20, 8), until: local(25, 18))
    let picked = convention(
      "picked",
      from: local(22, 9),
      until: local(24, 18),
      events: [event("panel", from: local(22, 14), until: local(22, 15))]
    )
    let value = snapshot(conventions: [empty, picked], generatedAt: local(22, 8))
    let now = local(22, 8)
    let plan = ConPawsComplicationTimeline.plan(snapshot: value, now: now)
    let dates = plan.map(\.date)
    for moment in [local(22, 9), local(22, 13, 45), local(22, 14, 10)] {
      #expect(frame(value, at: moment).contains("picked"))
      let shown = try #require(dates.last { $0 <= moment })
      #expect(frame(value, at: shown) == frame(value, at: moment), "stale card at \(moment)")
    }
    // The later convention's panel lifts the card in the Smart Stack too.
    let halfHourBefore = try #require(plan.first { $0.date == local(22, 13, 30) })
    #expect(halfHourBefore.relevantUntil == local(22, 14, 30))
    expectNoStaleCard(value, now: now)
  }

  // MARK: After the convention

  /// Once every saved convention has ended, the card says so. It used to
  /// read "No more panels today" every day for weeks after the convention,
  /// or "Add panels on iPhone" for one that was over.
  @Test(arguments: [true, false])
  func aConventionThatHasEndedSaysNothingIsUpcoming(withPanels: Bool) throws {
    let panels = withPanels ? [event("closing", from: local(23, 15), until: local(23, 16))] : []
    let value = snapshot(
      conventions: [convention("con", from: local(20, 8), until: local(23, 18), events: panels)],
      generatedAt: local(23, 12)
    )
    let english = ConPawsStrings.resolve("en")
    let nothingUpcoming = ConPawsComplicationProjection.Status(
      title: "Nothing upcoming",
      detail: "Your saved conventions have ended."
    )
    for dayAfter in [local(23, 18, 1), local(24, 10), local(30, 23)] {
      let projection = ConPawsComplicationProjection(snapshot: value, now: dayAfter)
      #expect(projection.status(strings: english) == nothingUpcoming, "at \(dayAfter)")
    }

    // The entry the timeline plans at the end already reads that way.
    let afterEnd = local(23, 18, 1)
    let shown = try #require(plannedDates(value, now: local(23, 17)).last { $0 <= afterEnd })
    #expect(frame(value, at: shown) == frame(value, at: afterEnd))
    expectNoStaleCard(value, now: local(23, 17))
  }

  /// While the convention runs, its own wording stays.
  @Test func aRunningConventionKeepsItsOwnStatus() {
    let english = ConPawsStrings.resolve("en")
    let finished = snapshot(
      [event("closing", from: local(23, 9), until: local(23, 10))],
      generatedAt: local(23, 12)
    )
    #expect(
      ConPawsComplicationProjection(snapshot: finished, now: local(23, 12)).status(strings: english)
        == .init(title: "No more panels today", detail: "All the panels you picked have ended")
    )
    let empty = snapshot([], generatedAt: local(23, 12))
    #expect(
      ConPawsComplicationProjection(snapshot: empty, now: local(23, 12)).status(strings: english)
        == .init(title: "Add panels on iPhone", detail: "No panels picked")
    )
  }

  /// A saved panel that starts after the convention's end keeps the
  /// convention current until that start, as the resolver does.
  @Test func aPanelAfterTheEndHoldsOffTheEndedCard() {
    let english = ConPawsStrings.resolve("en")
    let value = snapshot(
      conventions: [
        convention(
          "con",
          from: local(20, 8),
          until: local(23, 18),
          events: [event("afterparty", from: local(23, 20), until: local(23, 22))]
        ),
      ],
      generatedAt: local(23, 12)
    )
    #expect(ConPawsComplicationProjection(snapshot: value, now: local(23, 21)).status(strings: english) == nil)
    #expect(
      ConPawsComplicationProjection(snapshot: value, now: local(23, 22, 30)).status(strings: english)?.title
        == "Nothing upcoming"
    )
  }

  // MARK: Staleness

  /// The timeline places the stale entry where the shared rule says the plan
  /// turns stale, and the entry drawn there reads stale by the same rule. A
  /// phone stamp with a fraction of a second must not split the two.
  @Test(arguments: [0.0, 0.123, 0.999])
  func timelineStaleBoundaryMatchesTheEntryStaleFlag(fraction: TimeInterval) throws {
    let generatedAt = local(21, 13, 50).addingTimeInterval(fraction)
    let value = snapshot(
      [event("trivia", from: local(21, 15, 30), until: local(21, 16, 30))],
      generatedAt: generatedAt
    )
    let dates = plannedDates(value, now: generatedAt)
    let boundary = try #require(ConPawsSnapshotAge.staleDate(of: value))
    #expect(abs(boundary.timeIntervalSince(local(21, 14, 20)) - fraction) < 0.001)
    let index = try #require(dates.firstIndex(of: boundary))
    #expect(index > 0)
    #expect(ConPawsSnapshotAge.isStale(value, now: dates[index - 1]) == false)
    #expect(ConPawsSnapshotAge.isStale(value, now: dates[index]))
    expectNoStaleCard(value, now: generatedAt)
  }

  /// With no convention there is nothing to go stale, so no stale entry.
  @Test func anEmptySnapshotGetsNoStaleEntry() {
    let now = local(21, 12)
    let empty = ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.addingTimeInterval(-60).timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: []
    )
    #expect(plannedDates(empty, now: now) == [now, now.addingTimeInterval(ConPawsComplicationTimeline.idleRefresh)])
  }

  // MARK: Coming up

  /// The pre-convention card steps down at the convention's midnight, then
  /// hourly, then reads "Starting soon". Each step needs an entry, or the
  /// card keeps the old wording until the next phone snapshot. Starts 90
  /// minutes, 5 hours, 30 hours and 3 days out.
  @Test(arguments: [90, 300, 1_800, 4_320])
  func comingUpCountdownNeverShowsAStaleLabel(minutesUntilStart: Int) {
    let now = local(20, 7, 13)
    let start = now.addingTimeInterval(TimeInterval(minutesUntilStart * 60))
    let value = snapshot(
      conventions: [convention("con", from: start, until: start.addingTimeInterval(2 * 86_400))],
      generatedAt: now
    )
    expectNoStaleCard(value, now: now)
  }

  // MARK: Completeness

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
    expectNoStaleCard(snapshot(events, generatedAt: now), now: now)
  }

  // MARK: Fixtures

  private func plannedDates(_ snapshot: ConPawsSnapshot, now: Date) -> [Date] {
    ConPawsComplicationTimeline.plan(snapshot: snapshot, now: now).map(\.date)
  }

  /// Every minute between two entries reads exactly like the earlier entry:
  /// what the card would show had it been redrawn then. So does the last
  /// second before each next entry, which a minute's step can miss.
  private func expectNoStaleCard(
    _ snapshot: ConPawsSnapshot,
    now: Date,
    sourceLocation: SourceLocation = #_sourceLocation
  ) {
    let dates = plannedDates(snapshot, now: now)
    #expect(dates == dates.sorted(), sourceLocation: sourceLocation)
    #expect(Set(dates).count == dates.count, sourceLocation: sourceLocation)
    guard let last = dates.last else { return }

    var moment = now
    while moment < last {
      let shown = dates.last { $0 <= moment } ?? now
      #expect(
        frame(snapshot, at: moment) == frame(snapshot, at: shown),
        "stale card at \(moment) from the \(shown) entry",
        sourceLocation: sourceLocation
      )
      moment.addTimeInterval(60)
    }
    for (entry, next) in zip(dates, dates.dropFirst()) where next.timeIntervalSince(entry) > 1 {
      #expect(
        frame(snapshot, at: next.addingTimeInterval(-1)) == frame(snapshot, at: entry),
        "stale card just before \(next) from the \(entry) entry",
        sourceLocation: sourceLocation
      )
    }
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
    let stale = ConPawsSnapshotAge.isStale(snapshot, now: date)
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
    // The spoken countdown is part of the frame: WidgetKit keeps an entry's
    // VoiceOver label as long as its pixels.
    let shown: String = switch projection.state {
    case .comingUp(let convention):
      "coming \(convention.id) "
        + ConPawsCountdown.label(
          from: date,
          to: Date(timeIntervalSince1970: convention.startAtMs / 1_000),
          timeZone: zone,
          strings: strings
        )
        + " / " + ConPawsComplicationSpeech.comingUp(convention, now: date, strings: strings)
    case .leave(let current, let next, let convention):
      "leave \(convention.id) \(current?.id ?? "-") \(next.id) +\(day(next)) "
        + ConPawsCountdown.leaveLead(
          from: date,
          to: Date(timeIntervalSince1970: next.startAtMs / 1_000),
          timeZone: zone,
          strings: strings
        ).text
        + " / " + ConPawsComplicationSpeech.leaveCountdown(from: date, to: next.startDate, strings: strings)
    case .next(let current, let next, let convention):
      "next \(convention.id) \(current?.id ?? "-") \(next.id) +\(day(next))"
    case .current(let event, let convention):
      "current \(convention.id) \(event.id)"
    case .finished(let convention):
      "finished \(convention.id)"
    case .noPicks(let convention):
      "no picks \(convention.id)"
    case .ended(let convention):
      "ended \(convention.id)"
    case .noConvention:
      "no convention"
    }
    return "\(shown) stale:\(stale)"
  }

  private func snapshot(_ events: [ConPawsEventSnapshot], generatedAt: Date) -> ConPawsSnapshot {
    snapshot(
      conventions: [convention("con", from: local(20, 8), until: local(23, 18), events: events)],
      generatedAt: generatedAt
    )
  }

  private func snapshot(
    conventions: [ConPawsConventionSnapshot],
    generatedAt: Date
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: generatedAt.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: conventions
    )
  }

  private func convention(
    _ id: String,
    from start: Date,
    until end: Date,
    events: [ConPawsEventSnapshot] = []
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: id,
      name: id,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: zone.identifier,
      dateRangeLabel: "",
      events: events,
      options: nil
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
