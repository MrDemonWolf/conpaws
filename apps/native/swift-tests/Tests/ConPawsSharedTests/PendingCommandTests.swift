import Foundation
import Testing
@testable import ConPawsShared

/// The Watch's saves and removes waiting on the phone: what shows a button as
/// waiting, what is sent again, what a snapshot ends, and what survives the
/// app being relaunched.
struct PendingCommandTests {
  /// 2026-09-04 15:20 UTC, a Friday afternoon at the convention.
  private let now = Date(timeIntervalSince1970: 1_788_535_200)

  // MARK: Waiting

  @Test func aNewTapReplacesTheOneWaitingOnTheSameEvent() {
    let first = command(.save, event: "evt", id: "first")
    let second = command(.remove, event: "evt", id: "second")
    var pending = ConPawsPendingCommands.adding(first, to: [:])
    pending = ConPawsPendingCommands.markingDelivered(true, commandID: "first", in: pending)
    pending = ConPawsPendingCommands.adding(second, to: pending)
    #expect(pending == ["evt": PendingWatchCommand(command: second, isDelivered: false)])
  }

  @Test func pendingActionIsNilOnceTheCommandExpires() {
    let pending = ConPawsPendingCommands.adding(command(.remove, event: "evt"), to: [:])
    #expect(ConPawsPendingCommands.action(for: "evt", in: pending, at: now) == .remove)
    #expect(ConPawsPendingCommands.action(for: "evt", in: pending, at: now.addingTimeInterval(86_400)) == .remove)
    #expect(ConPawsPendingCommands.action(for: "evt", in: pending, at: now.addingTimeInterval(86_401)) == nil)
    #expect(ConPawsPendingCommands.action(for: "other", in: pending, at: now) == nil)
  }

  // MARK: Settling

  @Test func settlingDropsHandledConfirmedAndExpiredCommands() {
    let confirmed = command(.save, event: "saved", id: "confirmed")
    let handled = command(.remove, event: "kept", id: "handled")
    let expired = command(.save, event: "late", id: "expired", sentAt: now.addingTimeInterval(-86_401))
    let waiting = command(.save, event: "unsaved", id: "waiting")
    let pending = table(confirmed, handled, expired, waiting)
    // "kept" is still saved, so only the handled list ends the remove.
    var snapshot = snapshot(saved: ["saved", "kept"])
    snapshot.handledCommandIds = ["handled"]

    let settled = ConPawsPendingCommands.settled(pending, by: snapshot, at: now)
    #expect(Set(settled.keys) == ["unsaved"])
  }

  @Test func settlingLeavesEverythingWhenNothingIsDone() {
    let pending = ConPawsPendingCommands.adding(command(.save, event: "evt"), to: [:])
    #expect(ConPawsPendingCommands.settled(pending, by: snapshot(saved: []), at: now) == pending)
  }

  @Test func anOlderSnapshotSettlesTheCommandsItListsAsHandled() {
    // The phone declined c1 and listed it in S1, then a restart published S2
    // without it. S1 arrives second and is never shown, but its receipt holds.
    let declined = command(.save, event: "evt", id: "c1")
    let waiting = command(.save, event: "other", id: "c2")
    var older = snapshot(saved: [])
    older.handledCommandIds = ["c1"]

    let settled = ConPawsPendingCommands.settled(table(declined, waiting), byReceiptsIn: older)
    #expect(settled == table(waiting))
  }

  @Test func anOlderSnapshotNeverSettlesACommandByItsEffect() {
    // An older schedule can show a state from before a newer tap.
    let pending = table(command(.save, event: "evt", id: "c1"), command(.remove, event: "gone", id: "c2"))
    let older = snapshot(saved: ["evt"])
    #expect(ConPawsPendingCommands.settled(pending, byReceiptsIn: older) == pending)
  }

  // MARK: Delivery

  @Test func undeliveredSkipsDeliveredAndExpiredCommands() {
    let delivered = command(.save, event: "a", id: "delivered")
    let expired = command(.save, event: "b", id: "expired", sentAt: now.addingTimeInterval(-86_401))
    let waiting = command(.remove, event: "c", id: "waiting")
    var pending = table(delivered, expired, waiting)
    pending = ConPawsPendingCommands.markingDelivered(true, commandID: "delivered", in: pending)

    #expect(ConPawsPendingCommands.undelivered(in: pending, at: now) == [waiting])
  }

  @Test func aFailedTransferMarksTheCommandUndeliveredAgain() {
    let sent = command(.save, event: "evt", id: "sent")
    var pending = ConPawsPendingCommands.adding(sent, to: [:])
    pending = ConPawsPendingCommands.markingDelivered(true, commandID: "sent", in: pending)
    #expect(ConPawsPendingCommands.undelivered(in: pending, at: now).isEmpty)

    pending = ConPawsPendingCommands.markingDelivered(false, commandID: "sent", in: pending)
    #expect(pending["evt"]?.isDelivered == false)
    #expect(ConPawsPendingCommands.undelivered(in: pending, at: now) == [sent])
  }

  @Test func markingACommandNoLongerWaitingChangesNothing() {
    // A reply that lands after a snapshot already settled the tap.
    let pending = ConPawsPendingCommands.adding(command(.save, event: "evt", id: "current"), to: [:])
    #expect(ConPawsPendingCommands.markingDelivered(true, commandID: "settled", in: pending) == pending)
  }

  // MARK: Storage

  @Test func pendingCommandsRoundTripThroughStoredData() throws {
    var pending = table(command(.save, event: "a", id: "first"), command(.remove, event: "b", id: "second"))
    pending = ConPawsPendingCommands.markingDelivered(true, commandID: "second", in: pending)

    let data = try #require(ConPawsPendingCommands.encoded(pending))
    #expect(ConPawsPendingCommands.decoded(from: data) == pending)
  }

  @Test func storedDataKeepsTheFormatEarlierBuildsWrote() throws {
    // Taps waiting across an app update are read back from this exact shape:
    // a JSON object of pending commands keyed by event id.
    #expect(ConPawsPendingCommands.storageKey == "conpaws.watch.pendingCommands.v1")
    let json = #"{"evt":{"command":{"id":"cmd","action":"save","conventionId":"con","eventId":"evt","sentAtMs":1788535200000},"isDelivered":true}}"#
    let expected = command(.save, event: "evt", id: "cmd")
    #expect(
      ConPawsPendingCommands.decoded(from: Data(json.utf8))
        == ["evt": PendingWatchCommand(command: expected, isDelivered: true)]
    )
    let encoded = try #require(ConPawsPendingCommands.encoded(["evt": PendingWatchCommand(command: expected, isDelivered: true)]))
    let object = try #require(try JSONSerialization.jsonObject(with: encoded) as? [String: [String: Any]])
    #expect(Set(object.keys) == ["evt"])
    let entry = try #require(object["evt"])
    #expect(Set(entry.keys) == ["command", "isDelivered"])
  }

  @Test func storedCommandsKeyedByAnotherEventOrInvalidAreDropped() throws {
    let good = PendingWatchCommand(command: command(.save, event: "good", id: "good"), isDelivered: false)
    let misfiled = PendingWatchCommand(command: command(.save, event: "elsewhere", id: "misfiled"), isDelivered: false)
    let blankID = PendingWatchCommand(command: command(.save, event: "blank", id: " "), isDelivered: true)
    let stored: [String: PendingWatchCommand] = ["good": good, "other": misfiled, "blank": blankID]
    let data = try JSONEncoder().encode(stored)

    #expect(ConPawsPendingCommands.decoded(from: data) == ["good": good])
  }

  @Test(arguments: ["", "not json", #"["evt"]"#, #"{"evt":{"isDelivered":true}}"#])
  func unreadableStoredDataReadsAsNothingWaiting(json: String) {
    #expect(ConPawsPendingCommands.decoded(from: Data(json.utf8)).isEmpty)
  }

  @Test func savingStoresTheTableAndAnEmptyOneClearsTheKey() throws {
    let suiteName = "PendingCommandTests.\(UUID().uuidString)"
    let defaults = try #require(UserDefaults(suiteName: suiteName))
    defer { defaults.removePersistentDomain(forName: suiteName) }
    let pending = ConPawsPendingCommands.adding(command(.save, event: "evt"), to: [:])

    ConPawsPendingCommands.save(pending, to: defaults)
    #expect(ConPawsPendingCommands.load(from: defaults) == pending)

    ConPawsPendingCommands.save([:], to: defaults)
    #expect(defaults.object(forKey: ConPawsPendingCommands.storageKey) == nil)
    #expect(ConPawsPendingCommands.load(from: defaults).isEmpty)
  }

  // MARK: Fixtures

  private func command(
    _ action: ConPawsWatchCommand.Action,
    event: String,
    id: String = UUID().uuidString,
    sentAt: Date? = nil
  ) -> ConPawsWatchCommand {
    ConPawsWatchCommand(action: action, eventID: event, conventionID: "con", sentAt: sentAt ?? now, id: id)
  }

  private func table(_ commands: ConPawsWatchCommand...) -> [String: PendingWatchCommand] {
    commands.reduce(into: [:]) { table, command in
      table = ConPawsPendingCommands.adding(command, to: table)
    }
  }

  private func snapshot(saved: [String]) -> ConPawsSnapshot {
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
          events: saved.map { id in
            ConPawsEventSnapshot(
              id: id, title: id, startAtMs: now.timeIntervalSince1970 * 1_000, endAtMs: nil,
              location: nil, room: nil, reminderMinutes: nil, ageRating: nil, summary: nil
            )
          },
          options: nil
        ),
      ]
    )
  }
}
