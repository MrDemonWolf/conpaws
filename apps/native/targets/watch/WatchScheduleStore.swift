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
    !isReachable && !snapshot.conventions.isEmpty
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
      let candidate = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
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

    DispatchQueue.main.async { [weak self] in
      self?.snapshot = candidate
      WidgetCenter.shared.reloadTimelines(ofKind: ConPawsWidgetKind.watchComplication)
    }
  }

  private static func isValid(_ snapshot: ConPawsSnapshot) -> Bool {
    guard
      snapshot.schemaVersion == 1,
      snapshot.generatedAtMs.isFinite,
      snapshot.generatedAtMs >= 0,
      snapshot.generatedAtMs <= Date().timeIntervalSince1970 * 1_000 + Self.futureToleranceMs,
      Set(snapshot.conventions.map(\.id)).count == snapshot.conventions.count
    else {
      return false
    }

    return snapshot.conventions.allSatisfy { convention in
      let eventIDs = convention.events.map(\.id)
      return !convention.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && !convention.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        && convention.startAtMs.isFinite
        && convention.endAtMs.isFinite
        && convention.endAtMs >= convention.startAtMs
        && TimeZone(identifier: convention.timeZoneIdentifier) != nil
        && Set(eventIDs).count == eventIDs.count
        && convention.events.allSatisfy { event in
          !event.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !event.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && event.startAtMs.isFinite
            && (event.endAtMs.map { $0.isFinite && $0 >= event.startAtMs } ?? true)
            && (event.reminderMinutes.map { $0 >= 0 } ?? true)
        }
    }
  }
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
