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

  private let receiveQueue = DispatchQueue(label: "com.mrdemonwolf.conpaws.watch-receive")
  @Published private(set) var snapshot = ConPawsSnapshotStore.load()
  @Published private(set) var isReachable = false

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
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

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
    DispatchQueue.main.async { [weak self] in
      self?.isReachable = session.isReachable
    }
    receive(session.receivedApplicationContext)
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { [weak self] in
      self?.isReachable = session.isReachable
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
}
