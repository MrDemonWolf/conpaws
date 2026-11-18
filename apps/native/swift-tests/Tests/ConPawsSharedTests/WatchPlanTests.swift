import Foundation
import Testing
@testable import ConPawsShared

/// Descriptions, options and commands: what lets the Watch change the plan.
struct WatchPlanTests {
  /// 2026-09-04 15:20 UTC, a Friday afternoon at the convention.
  private let now = Date(timeIntervalSince1970: 1_788_535_200)

  @Test func olderPayloadsDecodeWithoutSummariesOrOptions() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"a","title":"Panel","startAtMs":1}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.conventions[0].options == nil)
    #expect(decoded.conventions[0].events[0].summary == nil)
    #expect(decoded.filteringInvalidRecords().conventions[0].options == nil)
  }

  @Test func summariesAndOptionsSurviveTheWatchsReencode() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"a","title":"Panel","startAtMs":1,"summary":"About it"}],"options":[{"id":"b","title":"Other","startAtMs":1,"endAtMs":2,"summary":"Also about it"}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    // WatchScheduleStore stores the filtered snapshot re-encoded, and the
    // complication and the next launch read that copy.
    let stored = try JSONDecoder().decode(
      ConPawsSnapshot.self,
      from: JSONEncoder().encode(decoded.filteringInvalidRecords())
    )
    #expect(stored.conventions[0].events[0].summary == "About it")
    #expect(stored.conventions[0].options?.map(\.id) == ["b"])
    #expect(stored.conventions[0].options?[0].summary == "Also about it")
  }

  @Test func optionsAreFilteredLikeSavedEvents() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"con","name":"Con","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"saved","title":"Panel","startAtMs":1}],"options":[{"id":"good","title":"Option","startAtMs":1},{"id":"good","title":"Twice","startAtMs":1},{"id":"saved","title":"Already planned","startAtMs":1},{"id":"untitled","title":"  ","startAtMs":1},{"id":"backwards","title":"Broken","startAtMs":3,"endAtMs":2}]}]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    let filtered = decoded.filteringInvalidRecords()
    #expect(filtered.conventions[0].events.map(\.id) == ["saved"])
    #expect(filtered.conventions[0].options?.map(\.id) == ["good"])
  }

  // MARK: Other options this hour

  @Test func optionsThisHourMirrorsThePhonesHourSlot() {
    let convention = convention(options: [
      option("later-this-hour", startMinutes: 30),
      option("running", startMinutes: -50, minutes: 90),
      option("started-earlier-this-hour", startMinutes: -15),
      option("ended-this-hour", startMinutes: -20, minutes: 10),
      option("next-hour", startMinutes: 40),
      option("unknown-end", startMinutes: -19, minutes: nil),
      option("unknown-end-over", startMinutes: -61, minutes: nil),
      option("saved", startMinutes: 0),
    ], saved: ["saved"])
    // 15:00-16:00 UTC is the slot; 16:00 starts the next one.
    #expect(convention.optionsThisHour(at: now).map(\.id) == [
      "running", "unknown-end", "started-earlier-this-hour", "later-this-hour",
    ])
  }

  @Test func optionsThisHourUsesTheConventionsHour() {
    // India is UTC+5:30, so 15:20 UTC is 20:50 local and the slot is
    // 15:00-16:00 local-hour 20, i.e. 14:30-15:30 UTC.
    let convention = convention(
      timeZone: "Asia/Kolkata",
      options: [
        option("in-local-hour", startMinutes: 5),
        option("next-local-hour", startMinutes: 10),
      ]
    )
    #expect(convention.optionsThisHour(at: now).map(\.id) == ["in-local-hour"])
  }

  @Test func optionsThisHourSortsByStartThenTitleAndStopsAtFive() {
    let convention = convention(options: (0..<8).map { index in
      option("option-\(index)", title: "Panel \(7 - index)", startMinutes: index < 4 ? 10 : 5)
    })
    let shown = convention.optionsThisHour(at: now)
    #expect(shown.count == 5)
    #expect(shown.map(\.title) == ["Panel 0", "Panel 1", "Panel 2", "Panel 3", "Panel 4"])
  }

  @Test func optionsThisHourOnlyWhileTheConventionRuns() {
    let options = [option("panel", startMinutes: 10)]
    #expect(convention(startsIn: 3_600, options: options).optionsThisHour(at: now).isEmpty)
    #expect(convention(endsIn: -1, options: options).optionsThisHour(at: now).isEmpty)
    #expect(convention(options: nil).optionsThisHour(at: now).isEmpty)
  }

  // MARK: Commands

  @Test func commandsCarryTheContractFields() throws {
    let command = ConPawsWatchCommand(
      action: .remove, eventID: "evt", conventionID: "con", sentAt: now, id: "cmd"
    )
    let json = try #require(command.jsonString)
    let object = try #require(
      try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
    )
    #expect(Set(object.keys) == ["id", "action", "conventionId", "eventId", "sentAtMs"])
    #expect(object["action"] as? String == "remove")
    #expect((object["sentAtMs"] as? Double) == now.timeIntervalSince1970 * 1_000)
    #expect(ConPawsWatchCommand.decode(json) == command)
    #expect(ConPawsWatchCommand.messageKey == "conpaws.watch.command.v1")
  }

  @Test(arguments: [
    #"{"id":"cmd","action":"toggle","conventionId":"con","eventId":"evt","sentAtMs":1}"#,
    #"{"id":" ","action":"save","conventionId":"con","eventId":"evt","sentAtMs":1}"#,
    #"{"id":"cmd","action":"save","conventionId":"con","eventId":"evt","sentAtMs":"1"}"#,
    #"{"id":"cmd","action":"save","conventionId":"con","sentAtMs":1}"#,
    "not json",
  ])
  func malformedCommandsAreRejected(json: String) {
    #expect(ConPawsWatchCommand.decode(json) == nil)
  }

  @Test func identifiersMustBeShorterThan256() {
    let short = ConPawsWatchCommand(action: .save, eventID: String(repeating: "e", count: 255), conventionID: "con")
    let long = ConPawsWatchCommand(action: .save, eventID: String(repeating: "e", count: 256), conventionID: "con")
    #expect(short.jsonString != nil)
    #expect(long.jsonString == nil)
  }

  @Test func aSnapshotSettlesACommandOnlyByShowingItsEffect() {
    let saved = snapshot(saved: ["evt"])
    let unsaved = snapshot(saved: [])
    let save = ConPawsWatchCommand(action: .save, eventID: "evt", conventionID: "con")
    let remove = ConPawsWatchCommand(action: .remove, eventID: "evt", conventionID: "con")
    let elsewhere = ConPawsWatchCommand(action: .save, eventID: "evt", conventionID: "other")
    #expect(save.isSettled(by: saved))
    #expect(!save.isSettled(by: unsaved))
    #expect(remove.isSettled(by: unsaved))
    #expect(!remove.isSettled(by: saved))
    #expect(!elsewhere.isSettled(by: saved))
  }

  @Test func aDeclinedCommandIsSettledByThePhonesHandledList() throws {
    let remove = ConPawsWatchCommand(action: .remove, eventID: "evt", conventionID: "con", id: "declined")
    // The phone kept the panel (the row changed after the tap), so only the
    // list says the tap is done.
    var stillSaved = snapshot(saved: ["evt"])
    #expect(!remove.isSettled(by: stillSaved))
    stillSaved.handledCommandIds = ["other", "declined"]
    #expect(remove.isSettled(by: stillSaved))

    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[],"handledCommandIds":["declined"]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    // Carried through the filtered copy the Watch stores and settles against.
    #expect(decoded.filteringInvalidRecords().handledCommandIds == ["declined"])
    let older = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[]}"#
    #expect(try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(older.utf8)).handledCommandIds == nil)
  }

  @Test func pendingCommandsExpireAfterADay() {
    let command = ConPawsWatchCommand(action: .save, eventID: "evt", conventionID: "con", sentAt: now)
    #expect(!command.hasExpired(at: now.addingTimeInterval(86_400)))
    #expect(command.hasExpired(at: now.addingTimeInterval(86_401)))
  }

  // MARK: Fixtures

  private func option(
    _ id: String,
    title: String? = nil,
    startMinutes: Double,
    minutes: Double? = 60
  ) -> ConPawsEventSnapshot {
    let start = now.addingTimeInterval(startMinutes * 60)
    return ConPawsEventSnapshot(
      id: id,
      title: title ?? id,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: minutes.map { start.addingTimeInterval($0 * 60).timeIntervalSince1970 * 1_000 },
      location: nil,
      room: "Hall A",
      reminderMinutes: nil,
      ageRating: nil,
      summary: nil
    )
  }

  private func convention(
    timeZone: String = "UTC",
    startsIn: TimeInterval = -86_400,
    endsIn: TimeInterval = 86_400,
    options: [ConPawsEventSnapshot]?,
    saved: [String] = []
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: "con",
      name: "Convention",
      startAtMs: now.addingTimeInterval(startsIn).timeIntervalSince1970 * 1_000,
      endAtMs: now.addingTimeInterval(endsIn).timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: timeZone,
      dateRangeLabel: "",
      events: saved.map { option($0, startMinutes: 0) },
      options: options
    )
  }

  private func snapshot(saved: [String]) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [convention(options: nil, saved: saved)]
    )
  }
}
