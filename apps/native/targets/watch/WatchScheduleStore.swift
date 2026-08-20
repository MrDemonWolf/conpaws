import Combine
import Foundation
import WatchConnectivity
import WidgetKit

final class WatchScheduleStore: NSObject, ObservableObject {
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
    guard
      persistedJSON != json,
      candidate.generatedAtMs >= ConPawsSnapshotStore.load().generatedAtMs,
      ConPawsSnapshotStore.save(json: json)
    else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.snapshot = candidate
      WidgetCenter.shared.reloadTimelines(ofKind: "ConPawsWatchWidget")
    }
  }

  private static func isValid(_ snapshot: ConPawsSnapshot) -> Bool {
    guard
      snapshot.schemaVersion == 1,
      snapshot.generatedAtMs.isFinite,
      snapshot.generatedAtMs >= 0,
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
