import Foundation
import Testing
@testable import ConPawsShared

/// Saved panels the convention's feed cancelled or stopped listing. The phone
/// sends them in a list of their own, so the Watch can show them struck
/// through on Today and in detail while Up Next, Happening Now and the
/// complication go on reading only the live `events`.
///
/// The convention is in Chicago. Instants are seconds since 1970, with their
/// Chicago wall-clock time beside them.
struct WithdrawnPanelTests {
  /// Sat 21 Nov 2026, 12:30 in Chicago.
  private let now = Date(timeIntervalSince1970: 1_795_285_800)

  // MARK: Decoding

  @Test func olderPayloadsDecodeWithoutTheList() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"a","title":"Panel","startAtMs":1}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.conventions[0].withdrawn == nil)
    #expect(decoded.filteringInvalidRecords().conventions[0].withdrawn == nil)
  }

  @Test func theListSurvivesTheWatchsReencode() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[],"withdrawn":[{"id":"art","title":"Art Jam","startAtMs":1,"endAtMs":2,"location":"Center","room":"Hall B","reminderMinutes":null,"ageRating":"18+ Adult","status":"cancelled"},{"id":"meet","title":"Meetup","startAtMs":1,"endAtMs":null,"location":null,"room":null,"reminderMinutes":null,"ageRating":null,"status":"removed"}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    // WatchScheduleStore stores the filtered snapshot re-encoded, and the
    // complication and the next launch read that copy.
    let encoded = try JSONEncoder().encode(decoded.filteringInvalidRecords())
    let stored = try JSONDecoder().decode(ConPawsSnapshot.self, from: encoded)
    let withdrawn = try #require(stored.conventions[0].withdrawn)
    #expect(withdrawn.map(\.id) == ["art", "meet"])
    #expect(withdrawn.map(\.status) == [.cancelled, .removed])
    #expect(withdrawn[0].event.title == "Art Jam")
    #expect(withdrawn[0].event.room == "Hall B")
    #expect(withdrawn[0].event.ageRating == "18+ Adult")
    #expect(withdrawn[1].event.endAtMs == nil)

    // Flat, as the phone sends it: the status beside the event's fields.
    let object = try #require(
      try JSONSerialization.jsonObject(with: encoded) as? [String: Any]
    )
    let conventions = try #require(object["conventions"] as? [[String: Any]])
    let row = try #require((conventions[0]["withdrawn"] as? [[String: Any]])?.first)
    #expect(row["status"] as? String == "cancelled")
    #expect(row["title"] as? String == "Art Jam")
  }

  @Test func rowsAreFilteredLikeSavedEvents() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"saved","title":"Panel","startAtMs":1}],"withdrawn":[{"id":"good","title":"Cancelled","startAtMs":1,"status":"cancelled"},{"id":"good","title":"Twice","startAtMs":1,"status":"cancelled"},{"id":"saved","title":"Still live","startAtMs":1,"status":"cancelled"},{"id":"untitled","title":" ","startAtMs":1,"status":"cancelled"},{"id":"backwards","title":"Broken","startAtMs":3,"endAtMs":2,"status":"removed"},{"id":"moved","title":"Unknown status","startAtMs":1,"status":"moved"},{"id":"unmarked","title":"No status","startAtMs":1}],"options":[{"id":"good","title":"Offered again","startAtMs":1},{"id":"moved","title":"Offered again","startAtMs":1},{"id":"other","title":"Option","startAtMs":1}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    let filtered = decoded.filteringInvalidRecords().conventions[0]
    #expect(filtered.events.map(\.id) == ["saved"])
    // A status this build does not know is dropped rather than guessed at.
    #expect(filtered.withdrawn?.map(\.id) == ["good"])
    // A withdrawn panel is still saved: never offered to add.
    #expect(filtered.options?.map(\.id) == ["other"])
  }

  /// A list this build cannot read costs the marks, never the schedule.
  @Test func anUnreadableListKeepsTheSchedule() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"saved","title":"Panel","startAtMs":1}],"withdrawn":[{"id":"art","status":"cancelled"}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.conventions[0].events.map(\.id) == ["saved"])
    #expect(decoded.conventions[0].withdrawn == nil)

    let notAList = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[],"withdrawn":"soon"}]}"#
    let alsoDecoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(notAList.utf8))
    #expect(alsoDecoded.conventions[0].withdrawn == nil)
  }

  // MARK: Never live

  @Test func aConventionWhoseOnlyPickWasWithdrawnHasNoPicks() {
    let state = resolve(convention(saved: [], withdrawn: [withdrawn("art", from: 1_795_287_600)]))
    guard case .noPicks = state else {
      Issue.record("expected noPicks, got \(state)")
      return
    }
  }

  @Test func upNextAndHappeningNowSkipWithdrawnPanels() {
    let state = resolve(convention(
      saved: [
        event("running", from: 1_795_284_000), // 12:00
        event("later", from: 1_795_294_800), // 15:00
      ],
      withdrawn: [
        withdrawn("cancelled-now", from: 1_795_285_200), // 12:20
        withdrawn("cancelled-next", from: 1_795_287_600), // 13:00
      ]
    ))
    #expect(state.activeEvent?.id == "running")
    #expect(state.nextEvent?.id == "later")
  }

  @Test func theComplicationPlansAsIfTheyWereNotThere() {
    let saved = [event("later", from: 1_795_294_800)] // 15:00
    let withdrawnPanels = [
      withdrawn("cancelled-now", from: 1_795_285_200), // 12:20
      withdrawn("cancelled-next", from: 1_795_287_600), // 13:00
    ]
    let with = snapshot(convention(saved: saved, withdrawn: withdrawnPanels))
    let without = snapshot(convention(saved: saved, withdrawn: nil))
    #expect(
      ConPawsComplicationTimeline.plan(snapshot: with, now: now)
        == ConPawsComplicationTimeline.plan(snapshot: without, now: now)
    )
  }

  @Test func aLiveLookupNeverFindsAWithdrawnPanel() {
    let value = snapshot(convention(saved: [], withdrawn: [withdrawn("art", from: 1_795_287_600)]))
    #expect(value.event(id: "art", in: "con") == nil)
    #expect(value.option(id: "art", in: "con") == nil)
    #expect(value.withdrawnEvent(id: "art", in: "con")?.withdrawn.status == .cancelled)
    #expect(value.withdrawnEvent(id: "art", in: "other") == nil)
    #expect(value.withdrawnEvent(id: "missing", in: "con") == nil)
  }

  // MARK: Removing one from the wrist

  /// A withdrawn panel is still in the plan, so a remove waits for the
  /// snapshot that drops it, as a live panel's does.
  @Test func aRemoveWaitsUntilThePanelLeavesTheList() {
    let remove = ConPawsWatchCommand(action: .remove, eventID: "art", conventionID: "con")
    let save = ConPawsWatchCommand(action: .save, eventID: "art", conventionID: "con")
    let listed = snapshot(convention(saved: [], withdrawn: [withdrawn("art", from: 1_795_287_600)]))
    let gone = snapshot(convention(saved: [], withdrawn: []))
    #expect(!remove.isSettled(by: listed))
    #expect(remove.isSettled(by: gone))
    #expect(save.isSettled(by: listed))
  }

  // MARK: Today

  @Test func todayAddsTheDaysWithdrawnPanelsInStartOrder() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(
        saved: [
          event("opening", from: 1_795_276_800), // 10:00
          event("trivia", from: 1_795_294_800), // 15:00
        ],
        withdrawn: [
          withdrawn("late-show", from: 1_795_316_400), // 21:00
          withdrawn("art-jam", from: 1_795_287_600), // 13:00
          withdrawn("same-time", from: 1_795_294_800, status: .removed), // 15:00
          withdrawn("tomorrow", from: 1_795_366_800), // Sun 11:00
          withdrawn("yesterday", from: 1_795_208_400), // Fri 15:00
        ]
      )),
      now: now
    )
    let rows = schedule.todayRows
    #expect(rows.map(\.id) == ["opening", "art-jam", "trivia", "same-time", "late-show"])
    #expect(rows.map(\.status) == [nil, .cancelled, nil, .removed, .cancelled])
  }

  @Test func todayUsesTheConventionsDay() {
    // 23:30 Saturday in Chicago is already Sunday in UTC.
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(
        saved: [event("opening", from: 1_795_276_800)],
        withdrawn: [withdrawn("late", from: 1_795_325_400)]
      )),
      now: now
    )
    #expect(schedule.todayRows.map(\.id) == ["opening", "late"])
  }

  @Test func todayListsWithdrawnPanelsWhenNothingLiveIsLeftToday() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(
        saved: [event("tomorrow", from: 1_795_366_800)],
        withdrawn: [withdrawn("art-jam", from: 1_795_287_600)]
      )),
      now: now
    )
    #expect(schedule.todayEvents.isEmpty)
    #expect(schedule.todayRows.map(\.id) == ["art-jam"])
  }

  // MARK: Home notice

  @Test func theNoticeCountsWithdrawnPanelsStillToCome() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(
        saved: [event("trivia", from: 1_795_294_800)],
        withdrawn: [
          withdrawn("over", from: 1_795_276_800), // 10:00-11:00
          withdrawn("running", from: 1_795_284_000), // 12:00-13:00
          withdrawn("next", from: 1_795_287_600), // 13:00
          withdrawn("tomorrow", from: 1_795_366_800, status: .removed),
        ]
      )),
      now: now
    )
    #expect(schedule.upcomingWithdrawn.map(\.id) == ["running", "next", "tomorrow"])
  }

  @Test func theNoticeIsEmptyWithoutWithdrawnPanels() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(saved: [event("trivia", from: 1_795_294_800)], withdrawn: nil)),
      now: now
    )
    #expect(schedule.upcomingWithdrawn.isEmpty)
    #expect(WatchScheduleProjection(snapshot: .empty(localeIdentifier: "en"), now: now).upcomingWithdrawn.isEmpty)
  }

  /// The notice opens the soonest panel it counts: the only one when there
  /// is one, and otherwise the one that matters first.
  @Test func theNoticeOpensTheSoonestPanelItCounts() {
    let schedule = WatchScheduleProjection(
      snapshot: snapshot(convention(
        saved: [event("trivia", from: 1_795_294_800)],
        withdrawn: [
          withdrawn("over", from: 1_795_276_800),
          withdrawn("tomorrow", from: 1_795_366_800),
          withdrawn("next", from: 1_795_287_600),
        ]
      )),
      now: now
    )
    #expect(schedule.withdrawnNoticeRoute == .event(conventionID: "con", eventID: "next"))
    let none = WatchScheduleProjection(
      snapshot: snapshot(convention(saved: [event("trivia", from: 1_795_294_800)], withdrawn: [])),
      now: now
    )
    #expect(none.withdrawnNoticeRoute == nil)
  }

  // MARK: Screens

  /// A detail screen whose panel the convention withdraws stays, and shows it
  /// struck through, rather than popping out from under the reader.
  @Test func aDetailScreenStaysWhenItsPanelIsWithdrawn() {
    let value = snapshot(convention(saved: [], withdrawn: [withdrawn("art", from: 1_795_287_600)]))
    let path: [WatchRoute] = [.today, .event(conventionID: "con", eventID: "art")]
    #expect(WatchRoute.pruned(path, against: value) == path)
    // Added from an option, then withdrawn: still the reader's screen.
    let option: [WatchRoute] = [.option(conventionID: "con", eventID: "art")]
    #expect(WatchRoute.pruned(option, against: value) == option)
  }

  @Test func aDetailScreenGoesOnceTheWithdrawnPanelIsRemoved() {
    let value = snapshot(convention(saved: [], withdrawn: []))
    let path: [WatchRoute] = [.today, .event(conventionID: "con", eventID: "art")]
    #expect(WatchRoute.pruned(path, against: value) == [.today])
  }

  /// The complication draws only live panels, but the app may hold a newer
  /// snapshot by the time a tap opens it.
  @Test func aComplicationLinkOpensAPanelWithdrawnSinceItWasDrawn() {
    let value = snapshot(convention(saved: [], withdrawn: [withdrawn("art", from: 1_795_287_600)]))
    #expect(
      WatchRoute.path(opening: .event(conventionID: "con", eventID: "art"), in: value)
        == [.event(conventionID: "con", eventID: "art")]
    )
  }

  // MARK: Fixtures

  private func event(_ id: String, from start: TimeInterval) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: id,
      startAtMs: start * 1_000,
      endAtMs: (start + 3_600) * 1_000,
      location: "Convention Center",
      room: "Hall B",
      reminderMinutes: nil,
      ageRating: nil,
      summary: nil
    )
  }

  private func withdrawn(
    _ id: String,
    from start: TimeInterval,
    status: ConPawsWithdrawnEvent.Status = .cancelled
  ) -> ConPawsWithdrawnEvent {
    ConPawsWithdrawnEvent(event: event(id, from: start), status: status)
  }

  private func convention(
    saved: [ConPawsEventSnapshot],
    withdrawn: [ConPawsWithdrawnEvent]?
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: "con",
      name: "Convention",
      startAtMs: 1_795_190_400_000, // Fri 20 Nov 2026, 10:00
      endAtMs: 1_795_485_600_000, // Mon 23 Nov, 20:00
      timeZoneIdentifier: "America/Chicago",
      dateRangeLabel: "",
      events: saved,
      options: nil,
      withdrawn: withdrawn
    )
  }

  private func snapshot(_ convention: ConPawsConventionSnapshot) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [convention]
    )
  }

  private func resolve(_ convention: ConPawsConventionSnapshot) -> ConPawsScheduleState {
    ConPawsScheduleResolver.resolve(
      snapshot: snapshot(convention),
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
  }
}
