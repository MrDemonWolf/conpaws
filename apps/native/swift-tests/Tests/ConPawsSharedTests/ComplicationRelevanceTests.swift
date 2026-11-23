import Foundation
import Testing
@testable import ConPawsShared

/// The Smart Stack clues the complication hands watchOS 11 and later through
/// its provider's `relevance()`. watchOS reads those, not the entries' scores,
/// so these windows decide when ConPaws rises to the top of the stack.
struct ComplicationRelevanceTests {
  private typealias Relevance = ConPawsComplicationRelevance
  private let zone = TimeZone(identifier: "America/Chicago")!

  // MARK: Saved panels

  @Test func aSavedPanelIsRelevantHalfAnHourEitherSideOfItsStart() {
    let value = snapshot([event("art-jam", from: local(21, 14), until: local(21, 15))])
    let windows = Relevance.windows(snapshot: value, now: local(21, 9))
    #expect(windows == [panel(local(21, 13, 30), local(21, 14, 30))])
  }

  /// A clue that is over tells the system nothing; one under way still
  /// holds the card up until it ends. Minutes past midnight: 14:10, 14:29
  /// and 14:30.
  @Test(arguments: [(850, true), (869, true), (870, false)] as [(Int, Bool)])
  func aWindowStaysUntilItEnds(minutesIntoDay: Int, kept: Bool) {
    let value = snapshot([event("art-jam", from: local(21, 14), until: local(21, 15))])
    let now = local(21, 0, minutesIntoDay)
    #expect(Relevance.windows(snapshot: value, now: now).isEmpty == (kept == false))
  }

  @Test func panelsCloseTogetherShareOneWindow() {
    let value = snapshot([
      event("art-jam", from: local(21, 14), until: local(21, 14, 30)),
      event("trivia", from: local(21, 14, 15), until: local(21, 15)),
      // Touching the first two: no gap for the card to drop in.
      event("dance", from: local(21, 15, 15), until: local(21, 16)),
    ])
    #expect(
      Relevance.windows(snapshot: value, now: local(21, 9))
        == [panel(local(21, 13, 30), local(21, 15, 45))]
    )
  }

  @Test func panelsAnHourApartKeepTheirOwnWindows() {
    let value = snapshot([
      event("trivia", from: local(21, 16)),
      event("art-jam", from: local(21, 14)),
    ])
    #expect(
      Relevance.windows(snapshot: value, now: local(21, 9)) == [
        panel(local(21, 13, 30), local(21, 14, 30)),
        panel(local(21, 15, 30), local(21, 16, 30)),
      ]
    )
  }

  /// Apple: the system may use only some of the clues, so they go soonest
  /// first and stop at the cap.
  @Test func theSoonestWindowsComeFirstUpToTheCap() {
    let panels = (0..<30).map { index in
      event("panel-\(index)", from: local(21, 9).addingTimeInterval(Double(29 - index) * 7_200))
    }
    let windows = Relevance.windows(snapshot: snapshot(panels), now: local(21, 8))
    #expect(windows.count == Relevance.maximumWindows)
    #expect(windows.first == panel(local(21, 8, 30), local(21, 9, 30)))
    #expect(windows.map(\.interval.start) == windows.map(\.interval.start).sorted())
  }

  /// Two conventions under way at once: the card follows the one that
  /// started first, so the other one's panels never show on it and must not
  /// raise it.
  @Test func aPanelTheCardDoesNotShowRaisesNothing() {
    let value = snapshot(conventions: [
      convention("first", from: local(20, 0), until: local(24, 0), events: [
        event("first-panel", from: local(21, 10)),
      ]),
      convention("second", from: local(21, 0), until: local(23, 0), events: [
        event("second-panel", from: local(21, 16)),
      ]),
    ])
    #expect(
      Relevance.windows(snapshot: value, now: local(21, 8))
        == [panel(local(21, 9, 30), local(21, 10, 30))]
    )
  }

  @Test func aLaterConventionsPanelsRaiseTheCardOnceTheFirstIsOver() {
    let value = snapshot(conventions: [
      convention("first", from: local(20, 0), until: local(21, 0), events: [
        event("first-panel", from: local(20, 10)),
      ]),
      convention("second", from: local(26, 0), until: local(28, 0), events: [
        event("second-panel", from: local(27, 15)),
      ]),
    ])
    let windows = Relevance.windows(snapshot: value, now: local(20, 12))
    #expect(windows.contains(panel(local(27, 14, 30), local(27, 15, 30))))
    #expect(windows.allSatisfy { $0.interval.end > local(20, 12) })
  }

  // MARK: Convention start

  /// The phone sends the start as the day alone, midnight where the
  /// convention is. The card rises on the first morning instead, the way to
  /// the venue, while it names a saved panel.
  @Test func theFirstMorningRaisesTheCard() {
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: [
        event("opening", from: local(22, 14)),
      ]),
    ])
    #expect(
      Relevance.windows(snapshot: value, now: local(20, 12)) == [
        opening(local(22, 8), local(22, 10)),
        panel(local(22, 13, 30), local(22, 14, 30)),
      ]
    )
  }

  @Test func theConventionsMidnightRaisesNothing() {
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: [
        event("opening", from: local(22, 14)),
      ]),
    ])
    let midnight = DateInterval(start: local(21, 23, 30), end: local(22, 0, 30))
    let windows = Relevance.windows(snapshot: value, now: local(20, 12))
    #expect(windows.allSatisfy { $0.interval.intersects(midnight) == false })
  }

  /// A morning panel's own window wins; the morning keeps what is left
  /// either side of it, so no two clues overlap.
  /// Times are minutes past midnight.
  @Test(arguments: [
    // A panel at 9:00 takes 8:30 to 9:30 out of the middle.
    (540, [(480, 510), (570, 600)]),
    // A panel at 8:15 holds the card from 7:45; the morning goes on after.
    (495, [(525, 600)]),
    // One at 7:00 is over by 7:30 and leaves the whole morning.
    (420, [(480, 600)]),
    // One at 10:30 starts its window as the morning ends.
    (630, [(480, 600)]),
  ] as [(Int, [(Int, Int)])])
  func aMorningPanelTrimsTheFirstMorning(panelMinutes: Int, morning: [(Int, Int)]) {
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: [
        event("early", from: local(22, 0, panelMinutes)),
        event("later", from: local(23, 14)),
      ]),
    ])
    let windows = Relevance.windows(snapshot: value, now: local(20, 12))
    #expect(
      windows.filter { $0.kind == .conventionStart }
        == morning.map { opening(local(22, 0, $0.0), local(22, 0, $0.1)) }
    )
    #expect(windows.contains(panel(
      local(22, 0, panelMinutes - 30),
      local(22, 0, panelMinutes + 30)
    )))
    expectNoOverlap(windows)
  }

  /// Without a saved panel the card says "No panels saved": nothing worth
  /// the top of the stack. Nor when every saved panel is over by then.
  @Test(arguments: [nil, 20] as [Int?])
  func theFirstMorningNeedsAPanelStillToCome(panelDay: Int?) {
    let events = panelDay.map { [event("meet-up", from: local($0, 19), until: local($0, 21))] } ?? []
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: events),
    ])
    let windows = Relevance.windows(snapshot: value, now: local(19, 12))
    #expect(windows.contains { $0.kind == .conventionStart } == false)
  }

  @Test func aMorningUnderWayIsKeptUntilItEnds() {
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: [
        event("opening", from: local(22, 14)),
      ]),
    ])
    #expect(Relevance.windows(snapshot: value, now: local(22, 9)).first == opening(local(22, 8), local(22, 10)))
    #expect(Relevance.windows(snapshot: value, now: local(22, 10)).first?.kind == .panel)
  }

  /// 1 November 2026 is the day Chicago falls back an hour. The morning is
  /// 8 AM on the clock there, not eight hours past midnight.
  @Test func theFirstMorningFollowsTheConventionsClockAcrossADaylightChange() {
    let fallBack = date(2026, 11, 1)
    let value = snapshot(conventions: [
      convention(
        "con",
        from: fallBack(0, 0),
        until: date(2026, 11, 3)(0, 0),
        events: [event("opening", from: fallBack(14, 0))]
      ),
    ])
    let windows = Relevance.windows(snapshot: value, now: date(2026, 10, 30)(12, 0))
    #expect(windows.first == opening(fallBack(8, 0), fallBack(10, 0)))
  }

  // MARK: Refreshing the clues

  @Test func cluesNeverGivenNeedGiving() {
    let value = snapshot([event("art-jam", from: local(21, 14))])
    #expect(Relevance.needsRefresh(given: nil, snapshot: value, now: local(21, 9)))
  }

  @Test func theSameCluesNeedNoRefresh() {
    let value = snapshot([event("art-jam", from: local(21, 14))])
    let given = Relevance.windows(snapshot: value, now: local(21, 9))
    #expect(Relevance.needsRefresh(given: given, snapshot: value, now: local(21, 9)) == false)
  }

  /// A new snapshot that moves no panel, only its stamp or a title, leaves
  /// the clues as they are: nothing to ask the system for again.
  @Test func aNewSnapshotWithTheSamePanelsNeedsNoRefresh() {
    let before = snapshot([event("art-jam", from: local(21, 14))], generatedAt: local(21, 8))
    let after = snapshot([event("art-jam", from: local(21, 14), title: "Art Jam!")], generatedAt: local(21, 9))
    let given = Relevance.windows(snapshot: before, now: local(21, 8))
    #expect(Relevance.needsRefresh(given: given, snapshot: after, now: local(21, 9)) == false)
  }

  @Test(arguments: ["moved", "added", "removed"])
  func aChangedPlanNeedsARefresh(change: String) {
    let before = snapshot([
      event("art-jam", from: local(21, 14)),
      event("trivia", from: local(21, 17)),
    ])
    let after: ConPawsSnapshot = switch change {
    case "moved":
      snapshot([event("art-jam", from: local(21, 15)), event("trivia", from: local(21, 17))])
    case "added":
      snapshot([
        event("art-jam", from: local(21, 14)),
        event("trivia", from: local(21, 17)),
        event("dance", from: local(21, 20)),
      ])
    default:
      snapshot([event("art-jam", from: local(21, 14))])
    }
    let given = Relevance.windows(snapshot: before, now: local(21, 9))
    #expect(Relevance.needsRefresh(given: given, snapshot: after, now: local(21, 9)))
  }

  /// Windows that have ended drop out of both sides: when nothing was left
  /// out, what the system holds is still the whole plan.
  @Test func aPassedWindowAloneNeedsNoRefresh() {
    let value = snapshot([
      event("art-jam", from: local(21, 10)),
      event("trivia", from: local(21, 17)),
    ])
    let given = Relevance.windows(snapshot: value, now: local(21, 9))
    #expect(Relevance.needsRefresh(given: given, snapshot: value, now: local(21, 12)) == false)
  }

  /// When the cap left windows out, a passed one frees a place for the next,
  /// which the system has never been told about.
  @Test func aPassedWindowNeedsARefreshWhenTheCapLeftSomeOut() {
    let panels = (0..<3).map { event("panel-\($0)", from: local(21, 10 + 3 * $0)) }
    let value = snapshot(panels)
    let given = Relevance.windows(snapshot: value, now: local(21, 9), limit: 2)
    #expect(Relevance.needsRefresh(given: given, snapshot: value, now: local(21, 9), limit: 2) == false)
    #expect(Relevance.needsRefresh(given: given, snapshot: value, now: local(21, 11), limit: 2))
  }

  // MARK: Storage

  @Test func givenCluesRoundTrip() throws {
    let suite = "relevance-\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    let value = snapshot(conventions: [
      convention("con", from: local(22, 0), until: local(25, 0), events: [
        event("opening", from: local(22, 9)),
        event("trivia", from: local(23, 14)),
      ]),
    ])
    let windows = Relevance.windows(snapshot: value, now: local(20, 12))
    try #require(Set(windows.map(\.kind)) == [.panel, .conventionStart])

    #expect(Relevance.loadGiven(from: defaults) == nil)
    Relevance.saveGiven(windows, to: defaults)
    #expect(Relevance.loadGiven(from: defaults) == windows)
  }

  @Test func unreadableStoredCluesReadAsNeverGiven() throws {
    let suite = "relevance-\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suite))
    defer { defaults.removePersistentDomain(forName: suite) }
    defaults.set(Data("not json".utf8), forKey: Relevance.givenKey)
    #expect(Relevance.loadGiven(from: defaults) == nil)
  }

  // MARK: Helpers

  private func expectNoOverlap(
    _ windows: [Relevance.Window],
    sourceLocation: SourceLocation = #_sourceLocation
  ) {
    for (earlier, later) in zip(windows, windows.dropFirst()) {
      #expect(earlier.interval.end <= later.interval.start, sourceLocation: sourceLocation)
    }
  }

  private func panel(_ start: Date, _ end: Date) -> Relevance.Window {
    Relevance.Window(interval: DateInterval(start: start, end: end), kind: .panel)
  }

  private func opening(_ start: Date, _ end: Date) -> Relevance.Window {
    Relevance.Window(interval: DateInterval(start: start, end: end), kind: .conventionStart)
  }

  /// November 2026 in Chicago. Minutes past 59 roll into the hours.
  private func local(_ day: Int, _ hour: Int, _ minute: Int = 0) -> Date {
    date(2026, 11, day)(hour, minute)
  }

  private func date(_ year: Int, _ month: Int, _ day: Int) -> (Int, Int) -> Date {
    var gregorian = Calendar(identifier: .gregorian)
    gregorian.timeZone = zone
    let calendar = gregorian
    return { hour, minute in
      calendar.date(
        from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute)
      )!
    }
  }

  private func snapshot(
    _ events: [ConPawsEventSnapshot],
    generatedAt: Date? = nil
  ) -> ConPawsSnapshot {
    snapshot(
      conventions: [convention("con", from: local(20, 0), until: local(24, 0), events: events)],
      generatedAt: generatedAt
    )
  }

  private func snapshot(
    conventions: [ConPawsConventionSnapshot],
    generatedAt: Date? = nil
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: (generatedAt ?? local(19, 12)).timeIntervalSince1970 * 1_000,
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
    title: String? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: title ?? id,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.map { $0.timeIntervalSince1970 * 1_000 },
      location: nil,
      room: nil,
      reminderMinutes: nil,
      ageRating: nil,
      summary: nil
    )
  }
}
