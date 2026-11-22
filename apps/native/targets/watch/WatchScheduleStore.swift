import Combine
import Foundation
import WatchConnectivity
import WidgetKit

final class WatchScheduleStore: NSObject, ObservableObject {
  /// The one store, and so the one WatchConnectivity delegate. The app makes
  /// it at launch, including a background launch for a delivery, and the
  /// scene's `.backgroundTask(.watchConnectivity)` handler reaches it here.
  static let shared = WatchScheduleStore()

  private let receiveQueue = DispatchQueue(label: "com.mrdemonwolf.conpaws.watch-receive")
  @Published private(set) var snapshot = ConPawsSnapshotStore.load()

  /// Saves and removes sent to the phone that no snapshot has shown yet,
  /// keyed by event id and kept across launches; see
  /// `ConPawsPendingCommands`. Main thread only.
  @Published private(set) var pendingCommands: [String: PendingWatchCommand] = [:]

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

  private override init() {
    super.init()
    pendingCommands = ConPawsPendingCommands.load()
    settlePendingCommands(against: snapshot, now: Date())
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Holds a WatchConnectivity background wake open until what it brought is
  /// stored and the complication reloaded.
  ///
  /// watchOS launches or wakes this app in the background for a new
  /// application context or user info, and suspends it again as soon as the
  /// scene's handler returns. Returning before the session has activated and
  /// handed everything over, or before `save` has run on `receiveQueue` and
  /// its main-thread half has reloaded the complication, leaves the
  /// complication on the old schedule until the app is next opened. Ends
  /// early only when the system cancels the task.
  func drainPendingContent() async {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    while !Task.isCancelled,
      session.activationState != .activated || session.hasContentPending
    {
      try? await Task.sleep(for: .milliseconds(100))
    }
    // Everything delivered so far has queued its save on receiveQueue, and
    // each save posts its reload to main: once both have caught up, so has
    // the complication.
    await withCheckedContinuation { continuation in
      receiveQueue.async {
        DispatchQueue.main.async { continuation.resume() }
      }
    }
  }

  // MARK: Commands to the phone

  /// The action waiting on this event, if any. Expired entries read as none,
  /// so a button never stays disabled past the point the phone would apply it.
  func pendingAction(for eventID: String, now: Date = Date()) -> ConPawsWatchCommand.Action? {
    ConPawsPendingCommands.action(for: eventID, in: pendingCommands, at: now)
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
    updatePendingCommands(ConPawsPendingCommands.adding(command, to: pendingCommands))
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
    for command in ConPawsPendingCommands.undelivered(in: pendingCommands, at: Date()) {
      deliver(command)
    }
  }

  private func markDelivered(_ commandID: String) {
    setDelivered(true, commandID: commandID)
  }

  private func setDelivered(_ isDelivered: Bool, commandID: String) {
    updatePendingCommands(
      ConPawsPendingCommands.markingDelivered(isDelivered, commandID: commandID, in: pendingCommands)
    )
  }

  /// Drops what `snapshot` shows as done or lists as handled, and what the
  /// phone would now ignore as too old.
  private func settlePendingCommands(against snapshot: ConPawsSnapshot, now: Date) {
    updatePendingCommands(ConPawsPendingCommands.settled(pendingCommands, by: snapshot, at: now))
  }

  /// Drops what a snapshot too old to show lists as handled; see
  /// `ConPawsPendingCommands.settled(_:byReceiptsIn:)`.
  private func settlePendingCommands(byReceiptsIn snapshot: ConPawsSnapshot) {
    updatePendingCommands(ConPawsPendingCommands.settled(pendingCommands, byReceiptsIn: snapshot))
  }

  /// Publishes and stores `updated`, unless nothing changed.
  private func updatePendingCommands(_ updated: [String: PendingWatchCommand]) {
    guard updated != pendingCommands else { return }
    pendingCommands = updated
    ConPawsPendingCommands.save(updated)
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
    let nowMs = Date().timeIntervalSince1970 * 1_000
    guard
      let data = json.data(using: .utf8),
      let decoded = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      ConPawsSnapshotStore.isAcceptableEnvelope(decoded, nowMs: nowMs)
    else {
      return
    }
    let candidate = decoded.filteringInvalidRecords()
    guard
      // Newer wins, so the backlog of user infos replayed after the newest
      // context never rewinds the schedule, and the second copy of one
      // snapshot is not applied twice. A stored stamp from a phone with a bad
      // clock is the exception; see `shouldReplace`.
      ConPawsSnapshotStore.shouldReplace(
        storedMs: ConPawsSnapshotStore.load().generatedAtMs,
        candidateMs: candidate.generatedAtMs,
        nowMs: nowMs
      )
    else {
      // Never shown, but the taps it lists as handled are still done, and a
      // declined one has no other way to free its button.
      if candidate.handledCommandIds?.isEmpty == false {
        DispatchQueue.main.async { [weak self] in
          self?.settlePendingCommands(byReceiptsIn: candidate)
        }
      }
      return
    }
    guard
      let filteredData = try? JSONEncoder().encode(candidate),
      let filteredJSON = String(data: filteredData, encoding: .utf8),
      // Stored here, on receiveQueue, so the next delivery is measured against
      // this one rather than whatever main has got round to.
      ConPawsSnapshotStore.save(json: filteredJSON)
    else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.snapshot = candidate
      WidgetCenter.shared.reloadTimelines(ofKind: ConPawsWidgetKind.watchComplication)
      self?.settlePendingCommands(against: candidate, now: Date())
    }
  }
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
