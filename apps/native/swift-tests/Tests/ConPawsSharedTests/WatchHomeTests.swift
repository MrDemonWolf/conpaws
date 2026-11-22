import Foundation
import Testing
@testable import ConPawsShared

/// Which panels the Watch app's Home and Today screens pick, and which pushed
/// screens survive a new snapshot. The convention is in Los Angeles, so a
/// projection that counts days on the watch's own calendar files late panels
/// under the wrong day. Instants are seconds since 1970, with their Los
/// Angeles wall-clock time beside them.
struct WatchHomeTests {
  private func at(_ seconds: TimeInterval) -> Date {
    Date(timeIntervalSince1970: seconds)
  }

  private func event(
    _ id: String,
    from start: TimeInterval,
    until end: TimeInterval? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: id,
      startAtMs: start * 1_000,
      endAtMs: (end ?? start + 3_600) * 1_000,
      location: nil,
      room: nil,
      reminderMinutes: nil,
      ageRating: nil,
      summary: nil
    )
  }

  private func convention(
    _ events: [ConPawsEventSnapshot],
    id: String = "con",
    options: [ConPawsEventSnapshot]? = nil
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: id,
      name: "Convention",
      startAtMs: 1_795_194_000_000, // Fri 20 Nov 2026, 09:00
      endAtMs: 1_795_485_600_000, // Mon 23 Nov, 18:00
      timeZoneIdentifier: "America/Los_Angeles",
      dateRangeLabel: "",
      events: events,
      options: options
    )
  }

  private func snapshot(_ conventions: ConPawsConventionSnapshot...) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: 1_795_291_200_000,
      localeIdentifier: "en",
      conventions: conventions
    )
  }

  // MARK: Home

  /// Up Next has its own card, so Later starts after it and holds two.
  @Test func laterSkipsUpNextAndStopsAtTwo() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([
        event("running", from: 1_795_291_200), // Sat 12:00-13:00
        event("next", from: 1_795_294_800), // 13:00
        event("then", from: 1_795_298_400), // 14:00
        event("after", from: 1_795_302_000), // 15:00
        event("last", from: 1_795_305_600), // 16:00
      ])),
      now: at(1_795_293_000) // Sat 12:30
    )
    #expect(schedule.activeEvent?.id == "running")
    #expect(schedule.nextEvent?.id == "next")
    #expect(schedule.laterEvents.map(\.id) == ["then", "after"])
  }

  @Test func laterIsEmptyWhenOnlyUpNextRemains() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([
        event("over", from: 1_795_276_800), // Sat 08:00-09:00
        event("next", from: 1_795_294_800), // 13:00
      ])),
      now: at(1_795_293_000) // Sat 12:30
    )
    #expect(schedule.nextEvent?.id == "next")
    #expect(schedule.laterEvents.isEmpty)
  }

  /// Later is in start order whatever order the phone sent.
  @Test func laterIsSoonestFirst() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([
        event("after", from: 1_795_302_000), // 15:00
        event("next", from: 1_795_294_800), // 13:00
        event("then", from: 1_795_298_400), // 14:00
      ])),
      now: at(1_795_293_000) // Sat 12:30
    )
    #expect(schedule.laterEvents.map(\.id) == ["then", "after"])
  }

  // MARK: Over

  /// Nothing picked at a convention that is over: the home screen says it is
  /// over instead of asking for panels to be picked, indefinitely.
  @Test func aConventionOverWithNothingPickedIsOver() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([])),
      now: at(1_795_550_400) // Tue 24 Nov, 12:00, the day after it ended
    )
    #expect(schedule.isOverWithoutPicks)
  }

  /// The resolver falls back to the convention that ended last, which here
  /// is the one with nothing picked.
  @Test func theLastConventionToEndDecidesWhenAllAreOver() {
    let picked = ConPawsConventionSnapshot(
      id: "earlier",
      name: "Earlier",
      startAtMs: 1_794_589_200_000, // Fri 13 Nov 2026, 09:00
      endAtMs: 1_794_880_800_000, // Mon 16 Nov, 18:00
      timeZoneIdentifier: "America/Los_Angeles",
      dateRangeLabel: "",
      events: [event("old", from: 1_794_675_600)], // Sat 14 Nov, 09:00
      options: nil
    )
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(picked, convention([])),
      now: at(1_795_550_400) // Tue 24 Nov, 12:00
    )
    #expect(schedule.convention?.id == "con")
    #expect(schedule.isOverWithoutPicks)
  }

  /// While it runs, an empty plan still asks for panels.
  @Test func aRunningConventionWithNothingPickedIsNotOver() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([])),
      now: at(1_795_293_000) // Sat 12:30
    )
    #expect(schedule.isOverWithoutPicks == false)
  }

  /// Panels picked and all over is the finished state's to word.
  @Test func aConventionOverWithPanelsPickedIsNotOverWithoutPicks() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([event("old", from: 1_795_276_800)])),
      now: at(1_795_550_400) // Tue 24 Nov, 12:00
    )
    #expect(schedule.isOverWithoutPicks == false)
  }

  // MARK: Today

  /// 23:30 on Saturday is Saturday at the convention, though it is Sunday in
  /// UTC and in Chicago; 00:30 on Sunday is Sunday at the convention, though
  /// it is the same UTC day as now.
  @Test func todayUsesTheConventionsDayNotTheWatchs() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([
        event("late", from: 1_795_332_600), // Sat 23:30
        event("after-midnight", from: 1_795_336_200), // Sun 00:30
      ])),
      now: at(1_795_309_200) // Sat 17:00, Sun 01:00 UTC
    )
    #expect(schedule.todayEvents.map(\.id) == ["late"])
  }

  /// Today is the whole day, the panels already over included, in start
  /// order, and nothing from tomorrow.
  @Test func todayListsTheWholeDayAndNotTomorrow() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention([
        event("tomorrow", from: 1_795_370_400), // Sun 10:00
        event("afternoon", from: 1_795_298_400), // Sat 14:00
        event("morning", from: 1_795_276_800), // Sat 08:00, over
      ])),
      now: at(1_795_293_000) // Sat 12:30
    )
    #expect(schedule.todayEvents.map(\.id) == ["morning", "afternoon"])
  }

  /// No convention, no panels: nothing for either screen to list.
  @Test func anEmptySnapshotListsNothing() {
    let schedule = WatchScheduleProjection(
      snapshot: .empty(localeIdentifier: "en"),
      now: at(1_795_293_000)
    )
    #expect(schedule.convention == nil)
    #expect(schedule.laterEvents.isEmpty)
    #expect(schedule.todayEvents.isEmpty)
  }

  // MARK: What a state names

  @Test func aStateNamesItsConventionAndPanels() {
    let con = convention([])
    let running = event("running", from: 1_795_291_200)
    let next = event("next", from: 1_795_294_800)

    let both = ConPawsScheduleState.next(con, current: running, upcoming: next)
    #expect(both.convention?.id == "con")
    #expect(both.activeEvent?.id == "running")
    #expect(both.nextEvent?.id == "next")

    let currentOnly = ConPawsScheduleState.currentOnly(con, running)
    #expect(currentOnly.activeEvent?.id == "running")
    #expect(currentOnly.nextEvent == nil)

    for state in [ConPawsScheduleState.countdown(con), .finished(con), .noPicks(con)] {
      #expect(state.convention?.id == "con")
      #expect(state.activeEvent == nil)
      #expect(state.nextEvent == nil)
    }
    #expect(ConPawsScheduleState.noConvention.convention == nil)
  }

  // MARK: Routes

  @Test func anEventRouteResolvesOnlyInItsConvention() {
    let value = snapshot(
      convention([event("panel", from: 1_795_294_800)]),
      convention([], id: "other")
    )
    #expect(value.event(id: "panel", in: "con")?.event.id == "panel")
    #expect(value.event(id: "panel", in: "con")?.convention.id == "con")
    #expect(value.event(id: "panel", in: "other") == nil)
    #expect(value.event(id: "missing", in: "con") == nil)
  }

  /// From every option the phone sent, not only this hour's, so a detail
  /// screen outlives the hour that listed it.
  @Test func anOptionRouteResolvesFromTheWholeWindow() {
    let value = snapshot(convention(
      [event("saved", from: 1_795_294_800)],
      options: [event("later-option", from: 1_795_305_600)] // Sat 16:00
    ))
    #expect(value.option(id: "later-option", in: "con")?.event.id == "later-option")
    // A saved panel is never also an option.
    #expect(value.option(id: "saved", in: "con") == nil)
    #expect(value.option(id: "later-option", in: "other") == nil)
  }

  @Test func aPrunedPathDropsAnEventRouteWhoseEventIsGone() {
    let path: [WatchRoute] = [
      .today,
      .event(conventionID: "con", eventID: "kept"),
      .event(conventionID: "con", eventID: "removed"),
    ]
    let value = snapshot(convention([event("kept", from: 1_795_294_800)]))
    #expect(
      WatchRoute.pruned(path, against: value)
        == [.today, .event(conventionID: "con", eventID: "kept")]
    )
  }

  /// Adding from an option's screen keeps the screen: it then shows the
  /// panel as saved instead of popping at the moment the phone confirms.
  @Test func aPrunedPathKeepsAnOptionRouteOnceItIsSaved() {
    let route = WatchRoute.option(conventionID: "con", eventID: "added")
    let value = snapshot(convention([event("added", from: 1_795_294_800)]))
    #expect(WatchRoute.pruned([route], against: value) == [route])
  }

  @Test func aPrunedPathKeepsAnOptionRouteWhileItIsStillOffered() {
    let route = WatchRoute.option(conventionID: "con", eventID: "offered")
    let value = snapshot(convention([], options: [event("offered", from: 1_795_294_800)]))
    #expect(WatchRoute.pruned([route], against: value) == [route])
  }

  @Test func aPrunedPathDropsAnOptionRouteNoLongerSavedOrOffered() {
    let route = WatchRoute.option(conventionID: "con", eventID: "gone")
    let value = snapshot(convention([event("other", from: 1_795_294_800)]))
    #expect(WatchRoute.pruned([.today, route], against: value) == [.today])
  }

  @Test func aComplicationLinkOpensItsPanelOverHome() {
    let value = snapshot(convention([event("panel", from: 1_795_294_800)]))
    #expect(WatchRoute.path(opening: .home, in: value).isEmpty)
    #expect(
      WatchRoute.path(opening: .event(conventionID: "con", eventID: "panel"), in: value)
        == [.event(conventionID: "con", eventID: "panel")]
    )
    // A newer snapshot reached the app first and dropped the panel.
    #expect(
      WatchRoute.path(opening: .event(conventionID: "con", eventID: "gone"), in: value).isEmpty
    )
  }
}
