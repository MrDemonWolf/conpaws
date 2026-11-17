import Combine
import Foundation
import WatchConnectivity
import WidgetKit

final class WatchScheduleStore: NSObject, ObservableObject {
  /// How far behind the stored snapshot a candidate may be stamped before it
  /// reads as a clock correction rather than a delivery that arrived late.
  private static let rewindToleranceMs: Double = 3_600 * 1_000

  /// How far ahead of this watch's clock a snapshot may be stamped.
  ///
  /// `generatedAtMs` is the phone's wall clock, so a phone that boots with a
  /// bad RTC can stamp one years out. Nothing downstream would ever displace
  /// it, so the ceiling belongs here, at the point the value is first trusted.
  private static let futureToleranceMs: Double = 86_400 * 1_000

  /// Commands waiting for the phone, kept across launches: a tap made with
  /// the phone out of reach must still be applied, and still show as waiting,
  /// after watchOS ends the app.
  private static let pendingCommandsKey = "conpaws.watch.pendingCommands.v1"

  private let receiveQueue = DispatchQueue(label: "com.mrdemonwolf.conpaws.watch-receive")
  @Published private(set) var snapshot = ConPawsSnapshotStore.load()

  /// Saves and removes sent to the phone that no snapshot has shown yet,
  /// keyed by event id. Main thread only.
  @Published private(set) var pendingCommands: [String: PendingWatchCommand] = [:]

  var isUsingSavedSchedule: Bool {
    isUsingSavedSchedule(at: .now)
  }

  func isUsingSavedSchedule(at now: Date) -> Bool {
    guard !snapshot.conventions.isEmpty else { return false }
    return ConPawsSnapshotAge.isStale(generatedAtMs: snapshot.generatedAtMs, now: now)
  }

  /// When the snapshot was produced on the phone, for the "Updated…" footer.
  var snapshotDate: Date? {
    snapshot.conventions.isEmpty
      ? nil
      : Date(timeIntervalSince1970: snapshot.generatedAtMs / 1_000)
  }

  override init() {
    super.init()
    pendingCommands = Self.loadPendingCommands()
    settlePendingCommands(against: snapshot, now: Date())
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: Commands to the phone

  /// The action waiting on this event, if any. Expired entries read as none,
  /// so a button never stays disabled past the point the phone would apply it.
  func pendingAction(for eventID: String, now: Date = Date()) -> ConPawsWatchCommand.Action? {
    guard let pending = pendingCommands[eventID], !pending.command.hasExpired(at: now) else {
      return nil
    }
    return pending.command.action
  }

  /// Asks the phone to save or remove an event. The UI shows it as waiting
  /// until a snapshot from the phone shows the change, which is the only
  /// confirmation there is: the phone may also decline it.
  func send(
    _ action: ConPawsWatchCommand.Action,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot
  ) {
    dispatchPrecondition(condition: .onQueue(.main))
    let command = ConPawsWatchCommand(action: action, eventID: event.id, conventionID: convention.id)
    guard command.isValid else { return }
    pendingCommands[event.id] = PendingWatchCommand(command: command, isDelivered: false)
    persistPendingCommands()
    deliver(command)
  }

  /// `sendMessage` while the phone is in reach; `transferUserInfo`
  /// otherwise, which the system queues and delivers in order once it is. A
  /// message that fails falls back to the queue, and a transfer that fails is
  /// sent again when the phone is next in reach. Either may arrive twice; the
  /// phone deduplicates by id and ignores a tap older than the row it would
  /// change.
  ///
  /// A phone app that is running, even suspended, applies the tap at once.
  /// One iOS has terminated is woken only far enough to queue it: JS needs a
  /// scene, so the tap is applied, and confirmed here, when the app is next
  /// opened.
  private func deliver(_ command: ConPawsWatchCommand) {
    guard WCSession.isSupported(), let json = command.jsonString else { return }
    let session = WCSession.default
    // Before activation completes neither call is allowed; the activation
    // callback delivers whatever is still marked undelivered.
    guard session.activationState == .activated else { return }
    let payload = [ConPawsWatchCommand.messageKey: json]
    guard session.isReachable else {
      session.transferUserInfo(payload)
      markDelivered(command.id)
      return
    }
    session.sendMessage(
      payload,
      replyHandler: { [weak self] _ in
        DispatchQueue.main.async { self?.markDelivered(command.id) }
      },
      errorHandler: { [weak self] _ in
        session.transferUserInfo(payload)
        DispatchQueue.main.async { self?.markDelivered(command.id) }
      }
    )
  }

  private func deliverUndelivered() {
    let now = Date()
    for pending in pendingCommands.values
    where !pending.isDelivered && !pending.command.hasExpired(at: now) {
      deliver(pending.command)
    }
  }

  private func markDelivered(_ commandID: String) {
    setDelivered(true, commandID: commandID)
  }

  private func setDelivered(_ isDelivered: Bool, commandID: String) {
    guard
      let entry = pendingCommands.first(where: { $0.value.command.id == commandID }),
      entry.value.isDelivered != isDelivered
    else { return }
    pendingCommands[entry.key]?.isDelivered = isDelivered
    persistPendingCommands()
  }

  /// Drops what `snapshot` shows as done or lists as handled, and what the
  /// phone would now ignore as too old.
  private func settlePendingCommands(against snapshot: ConPawsSnapshot, now: Date) {
    let remaining = pendingCommands.filter { _, pending in
      !pending.command.isSettled(by: snapshot) && !pending.command.hasExpired(at: now)
    }
    guard remaining.count != pendingCommands.count else { return }
    pendingCommands = remaining
    persistPendingCommands()
  }

  private static func loadPendingCommands() -> [String: PendingWatchCommand] {
    guard
      let data = UserDefaults.standard.data(forKey: pendingCommandsKey),
      let stored = try? JSONDecoder().decode([String: PendingWatchCommand].self, from: data)
    else { return [:] }
    return stored.filter { $0.key == $0.value.command.eventId && $0.value.command.isValid }
  }

  private func persistPendingCommands() {
    if pendingCommands.isEmpty {
      UserDefaults.standard.removeObject(forKey: Self.pendingCommandsKey)
    } else if let data = try? JSONEncoder().encode(pendingCommands) {
      UserDefaults.standard.set(data, forKey: Self.pendingCommandsKey)
    }
  }

  // MARK: Snapshots from the phone

  private func receive(_ payload: [String: Any]) {
    let value = payload[ConPawsSnapshotStore.snapshotKey]
    let json = (value as? String) ?? (value as? Data).flatMap { String(data: $0, encoding: .utf8) }

    guard
      let json,
      !json.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
      return
    }

    receiveQueue.async { [weak self] in
      self?.save(json)
    }
  }

  private func save(_ json: String) {
    guard
      let data = json.data(using: .utf8),
      var candidate = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      Self.isValidEnvelope(candidate)
    else {
      return
    }
    candidate = candidate.filteringInvalidRecords()
    guard
      Self.isValid(candidate)
    else {
      return
    }

    let persistedJSON = UserDefaults(
      suiteName: ConPawsSnapshotStore.appGroupIdentifier()
    )?.string(forKey: ConPawsSnapshotStore.snapshotKey)
    let rewindMs = ConPawsSnapshotStore.load().generatedAtMs - candidate.generatedAtMs
    guard
      persistedJSON != json,
      // Newer wins, which is what keeps an out-of-order WatchConnectivity
      // delivery from overwriting a fresher schedule. A candidate stamped far
      // enough behind the stored one is the other case: the phone's clock was
      // wrong and has been corrected, so it wins too. Without that second arm
      // one snapshot from a phone with a bad RTC keeps the watch frozen for
      // good, since nothing here ever lowers the stored timestamp.
      rewindMs <= 0 || rewindMs > Self.rewindToleranceMs,
      ConPawsSnapshotStore.save(json: json)
    else {
      return
    }

    guard
      let filteredData = try? JSONEncoder().encode(candidate),
      let filteredJSON = String(data: filteredData, encoding: .utf8)
    else { return }

    DispatchQueue.main.async { [weak self] in
      self?.snapshot = candidate
      _ = ConPawsSnapshotStore.save(json: filteredJSON)
      WidgetCenter.shared.reloadTimelines(ofKind: ConPawsWidgetKind.watchComplication)
      self?.settlePendingCommands(against: candidate, now: Date())
    }
  }

  private static func isValidEnvelope(_ snapshot: ConPawsSnapshot) -> Bool {
    guard
      ConPawsSnapshotStore.supportedSchemaVersions.contains(snapshot.schemaVersion),
      snapshot.generatedAtMs.isFinite,
      snapshot.generatedAtMs >= 0,
      snapshot.generatedAtMs <= Date().timeIntervalSince1970 * 1_000 + Self.futureToleranceMs
    else {
      return false
    }
    return true
  }

  private static func isValid(_ snapshot: ConPawsSnapshot) -> Bool { isValidEnvelope(snapshot) }
}

extension WatchScheduleStore: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // No reachability is published: nothing on screen showed it, and every
    // change re-rendered the whole tree for nothing. The schedule arrives as
    // application context and user info, which do not need the phone in reach.
    receive(session.receivedApplicationContext)
    guard activationState == .activated else { return }
    DispatchQueue.main.async { [weak self] in
      self?.deliverUndelivered()
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    receive(applicationContext)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receive(userInfo)
  }

  /// A queued command the system could not deliver (the session failed, the
  /// phone app was removed) goes back to undelivered, to be sent again when
  /// the phone is next in reach, instead of waiting out the day.
  func session(
    _ session: WCSession,
    didFinish userInfoTransfer: WCSessionUserInfoTransfer,
    error: Error?
  ) {
    guard
      let error,
      let json = userInfoTransfer.userInfo[ConPawsWatchCommand.messageKey] as? String,
      let command = ConPawsWatchCommand.decode(json)
    else { return }
    NSLog("ConPaws Watch command transfer failed: %@", error.localizedDescription)
    DispatchQueue.main.async { [weak self] in
      self?.setDelivered(false, commandID: command.id)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.activationState == .activated, session.isReachable else { return }
    DispatchQueue.main.async { [weak self] in
      self?.deliverUndelivered()
    }
  }
}

/// A command sent to the phone and not yet shown by a snapshot.
struct PendingWatchCommand: Codable, Hashable {
  let command: ConPawsWatchCommand
  /// False until `sendMessage` was answered or the command was handed to
  /// `transferUserInfo`, which the system then delivers on its own, and false
  /// again if that transfer fails. Anything still false is sent again at the
  /// next activation or when the phone comes back in reach.
  var isDelivered: Bool
}
