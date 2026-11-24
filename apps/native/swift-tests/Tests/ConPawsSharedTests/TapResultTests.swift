import Foundation
import Testing
@testable import ConPawsShared

/// What the Watch makes of a tap once the phone has answered: the outcome the
/// phone reports beside each handled id, the result a snapshot gives a waiting
/// tap, and how long the reason stays under the button.
struct TapResultTests {
  /// 2026-09-04 15:20 UTC, a Friday afternoon at the convention.
  private let now = Date(timeIntervalSince1970: 1_788_535_200)

  // MARK: The phone's outcomes

  @Test func outcomesDecodeAndSurviveTheWatchsReencode() throws {
    let json = payload(outcomes: #"{"a":"superseded","b":"not-allowed","c":"teleported"}"#)
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.commandOutcomes?[commandID: "a"] == .superseded)
    #expect(decoded.commandOutcomes?[commandID: "b"] == .notAllowed)
    // A value from a newer phone app reads as no outcome, not as a failure.
    #expect(decoded.commandOutcomes?[commandID: "c"] == nil)

    let filtered = decoded.filteringInvalidRecords()
    let stored = try JSONEncoder().encode(filtered)
    let reread = try JSONDecoder().decode(ConPawsSnapshot.self, from: stored)
    #expect(reread.commandOutcomes == ConPawsCommandOutcomes(["a": .superseded, "b": .notAllowed]))
    #expect(reread.handledCommandIds == ["a", "b", "c"])
  }

  @Test(arguments: [#""nonsense""#, "[1,2]", #"{"a":3}"#, "42"])
  func aMalformedOutcomeListNeverCostsTheSchedule(outcomes: String) throws {
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(payload(outcomes: outcomes).utf8))
    #expect(decoded.conventions.count == 1)
    #expect(decoded.handledCommandIds == ["a", "b", "c"])
    #expect(decoded.commandOutcomes?[commandID: "a"] == nil)
  }

  @Test func olderPayloadsHaveNoOutcomes() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":0,"localeIdentifier":"en","conventions":[],"handledCommandIds":["a"]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.commandOutcomes == nil)
  }

  // MARK: What a snapshot makes of a waiting tap

  @Test(arguments: [
    (ConPawsWatchCommandOutcome.superseded, ConPawsWatchTapDecline.changedOnIphone),
    (.applied, .changedOnIphone),
    (.unchanged, .changedOnIphone),
    (.cancelled, .cancelled),
    (.removed, .offSchedule),
    (.missing, .offSchedule),
    (.notAllowed, .addOnIphone),
    (.expired, .tooOld),
    (.failed, .failed),
  ])
  func aDeclinedTapSaysWhy(outcome: ConPawsWatchCommandOutcome, decline: ConPawsWatchTapDecline) {
    let tap = command(.save, event: "option", id: "c1")
    let snapshot = snapshot(saved: [], handled: ["c1": outcome])
    #expect(tap.result(shown: snapshot, receipts: snapshot) == .declined(decline))
  }

  @Test func aTapListedWithoutAnOutcomeIsDeclinedForNoGivenReason() {
    // An iPhone app from before outcomes were sent.
    let tap = command(.remove, event: "saved", id: "c1")
    var snapshot = snapshot(saved: ["saved"], handled: [:])
    snapshot.handledCommandIds = ["c1"]
    #expect(tap.result(shown: snapshot, receipts: snapshot) == .declined(.unknown))
  }

  @Test(arguments: [ConPawsWatchCommandOutcome.applied, .superseded, .failed])
  func aSnapshotThatShowsTheChangeIsALanding(outcome: ConPawsWatchCommandOutcome) {
    // Whatever the phone reported, the plan now holds what the tap asked
    // for: the phone made the change, or the wearer made it there first.
    let save = command(.save, event: "panel", id: "c1")
    let remove = command(.remove, event: "gone", id: "c2")
    let snapshot = snapshot(saved: ["panel"], handled: ["c1": outcome, "c2": outcome])
    #expect(save.result(shown: snapshot, receipts: snapshot) == .landed)
    #expect(remove.result(shown: snapshot, receipts: snapshot) == .landed)
  }

  @Test func aTapTheSnapshotNeitherShowsNorListsIsStillWaiting() {
    let tap = command(.save, event: "option", id: "c1")
    let snapshot = snapshot(saved: [], handled: ["other": .applied])
    #expect(tap.result(shown: snapshot, receipts: snapshot) == nil)
  }

  @Test func aRemoveOnAWithdrawnPanelLandsOnlyOnceItLeavesTheList() {
    let tap = command(.remove, event: "cancelled", id: "c1")
    var snapshot = snapshot(saved: [], handled: [:])
    snapshot = withWithdrawn(snapshot, "cancelled")
    #expect(tap.result(shown: snapshot, receipts: snapshot) == nil)
    #expect(tap.result(shown: self.snapshot(saved: [], handled: [:]), receipts: snapshot) == .landed)
  }

  // MARK: Settling the pending table

  @Test func settlingSaysWhatBecameOfEachTap() {
    let landed = command(.save, event: "saved", id: "landed")
    let declined = command(.remove, event: "kept", id: "declined")
    let expired = command(.save, event: "late", id: "expired", sentAt: now.addingTimeInterval(-86_401))
    let waiting = command(.save, event: "unsaved", id: "waiting")
    let pending = table(landed, declined, expired, waiting)
    let snapshot = snapshot(saved: ["saved", "kept"], handled: ["declined": .superseded])

    let settlement = ConPawsPendingCommands.settling(pending, by: snapshot, at: now)
    #expect(Set(settlement.pending.keys) == ["unsaved"])
    #expect(
      settlement.results == [
        "saved": .landed,
        "kept": .declined(.changedOnIphone),
        "late": .declined(.tooOld),
      ]
    )
    #expect(settlement.pending == ConPawsPendingCommands.settled(pending, by: snapshot, at: now))
  }

  @Test func anOlderSnapshotsReceiptIsJudgedAgainstTheShownSchedule() {
    // The phone declined c1 and listed it in S1; S2, newer and shown, does
    // not list it. S1 arrives late: its outcome is the reason, and S2 says
    // whether the plan has the change anyway.
    let declined = command(.save, event: "evt", id: "c1")
    let landed = command(.save, event: "kept", id: "c2")
    let waiting = command(.save, event: "other", id: "c3")
    let older = snapshot(saved: [], handled: ["c1": .cancelled, "c2": .applied])
    let shown = snapshot(saved: ["kept"], handled: [:])

    let settlement = ConPawsPendingCommands.settling(
      table(declined, landed, waiting), byReceiptsIn: older, shown: shown
    )
    #expect(settlement.pending == table(waiting))
    #expect(settlement.results == ["evt": .declined(.cancelled), "kept": .landed])
  }

  // MARK: What stays under the button

  @Test func aDeclineShowsUnderItsButtonForTenMinutes() {
    let log = ConPawsWatchTapLog.recording(
      ["evt": .declined(.changedOnIphone), "saved": .landed], at: now, in: [:]
    )
    #expect(ConPawsWatchTapLog.decline(for: "evt", in: log, at: now) == .changedOnIphone)
    #expect(
      ConPawsWatchTapLog.decline(for: "evt", in: log, at: now.addingTimeInterval(ConPawsWatchTapLog.shownFor - 1))
        == .changedOnIphone
    )
    #expect(ConPawsWatchTapLog.decline(for: "evt", in: log, at: now.addingTimeInterval(ConPawsWatchTapLog.shownFor)) == nil)
    // A tap that landed shows its change, not a line.
    #expect(ConPawsWatchTapLog.decline(for: "saved", in: log, at: now) == nil)
    #expect(ConPawsWatchTapLog.decline(for: "other", in: log, at: now) == nil)
  }

  @Test func aNewTapOrANewerResultReplacesTheReason() {
    var log = ConPawsWatchTapLog.recording(["evt": .declined(.failed)], at: now, in: [:])
    #expect(ConPawsWatchTapLog.forgetting("evt", in: log).isEmpty)

    log = ConPawsWatchTapLog.recording(["evt": .landed], at: now.addingTimeInterval(5), in: log)
    #expect(ConPawsWatchTapLog.decline(for: "evt", in: log, at: now.addingTimeInterval(5)) == nil)
  }

  @Test func recordingDropsReasonsNoLongerShown() {
    let old = ConPawsWatchTapLog.recording(["old": .declined(.tooOld)], at: now, in: [:])
    let log = ConPawsWatchTapLog.recording(
      ["new": .declined(.failed)], at: now.addingTimeInterval(ConPawsWatchTapLog.shownFor), in: old
    )
    #expect(Set(log.keys) == ["new"])
  }

  @Test(arguments: [
    ([ConPawsWatchTapResult](), ConPawsWatchTapLog.Haptic?.none),
    ([.landed], .success),
    ([.landed, .landed], .success),
    ([.declined(.cancelled)], .failure),
    ([.landed, .declined(.unknown)], .failure),
    // A day-old tap is no longer one the wearer is waiting on: its reason
    // shows under the button, but a buzz hours later would say nothing.
    ([.declined(.tooOld)], nil),
    ([.declined(.tooOld), .landed], .success),
  ])
  func oneBuzzPerSnapshotAndADeclineWins(results: [ConPawsWatchTapResult], haptic: ConPawsWatchTapLog.Haptic?) {
    #expect(ConPawsWatchTapLog.haptic(for: results) == haptic)
  }

  @Test func theAnnouncementNamesADeclineInOrderOfEventID() {
    let results: [String: ConPawsWatchTapResult] = [
      "b": .declined(.failed), "a": .declined(.cancelled), "c": .landed,
    ]
    #expect(ConPawsWatchTapLog.announcedDecline(in: results) == .cancelled)
    #expect(ConPawsWatchTapLog.announcedDecline(in: ["c": .landed]) == nil)
    #expect(ConPawsWatchTapLog.announcedDecline(in: ["a": .declined(.tooOld), "b": .declined(.failed)]) == .failed)
    #expect(ConPawsWatchTapLog.announcedDecline(in: ["a": .declined(.tooOld)]) == nil)
  }

  // MARK: Fixtures

  private func command(
    _ action: ConPawsWatchCommand.Action,
    event: String,
    id: String,
    sentAt: Date? = nil
  ) -> ConPawsWatchCommand {
    ConPawsWatchCommand(action: action, eventID: event, conventionID: "con", sentAt: sentAt ?? now, id: id)
  }

  private func table(_ commands: ConPawsWatchCommand...) -> ConPawsPendingCommands.Table {
    commands.reduce(into: [:]) { table, command in
      table = ConPawsPendingCommands.adding(command, to: table)
    }
  }

  private func event(_ id: String) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id, title: id, startAtMs: now.timeIntervalSince1970 * 1_000, endAtMs: nil,
      location: nil, room: nil, reminderMinutes: nil, ageRating: nil, summary: nil
    )
  }

  private func snapshot(
    saved: [String],
    handled: [String: ConPawsWatchCommandOutcome]
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "con",
          name: "Convention",
          startAtMs: now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(86_400).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: "UTC",
          dateRangeLabel: "",
          events: saved.map(event),
          options: nil
        ),
      ],
      handledCommandIds: handled.isEmpty ? nil : handled.keys.sorted(),
      commandOutcomes: handled.isEmpty ? nil : ConPawsCommandOutcomes(handled)
    )
  }

  private func withWithdrawn(_ snapshot: ConPawsSnapshot, _ eventID: String) -> ConPawsSnapshot {
    let convention = snapshot.conventions[0]
    return ConPawsSnapshot(
      schemaVersion: snapshot.schemaVersion,
      generatedAtMs: snapshot.generatedAtMs,
      localeIdentifier: snapshot.localeIdentifier,
      conventions: [
        ConPawsConventionSnapshot(
          id: convention.id, name: convention.name, startAtMs: convention.startAtMs,
          endAtMs: convention.endAtMs, timeZoneIdentifier: convention.timeZoneIdentifier,
          dateRangeLabel: convention.dateRangeLabel, events: convention.events, options: nil,
          withdrawn: [ConPawsWithdrawnEvent(event: event(eventID), status: .cancelled)]
        ),
      ],
      handledCommandIds: snapshot.handledCommandIds,
      commandOutcomes: snapshot.commandOutcomes
    )
  }

  /// One convention, three handled ids and `outcomes` as raw JSON.
  private func payload(outcomes: String) -> String {
    let startMs = Int(now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000)
    let endMs = Int(now.addingTimeInterval(86_400).timeIntervalSince1970 * 1_000)
    return """
    {"schemaVersion":2,"generatedAtMs":0,"localeIdentifier":"en",\
    "conventions":[{"id":"con","name":"Con","startAtMs":\(startMs),"endAtMs":\(endMs),\
    "timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[]}],\
    "handledCommandIds":["a","b","c"],"commandOutcomes":\(outcomes)}
    """
  }
}
