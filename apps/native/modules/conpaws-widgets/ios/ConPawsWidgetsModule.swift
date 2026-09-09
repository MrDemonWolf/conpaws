import ActivityKit
import ExpoModulesCore
import Foundation
import WatchConnectivity
import WidgetKit

/// The App Group slot the widget, the complication and the watch app all read.
///
/// Named once for the same reason the widget kinds are: this string is a
/// contract with code in another target that no compiler checks, so a rename
/// that misses one spelling fails silently rather than failing to build.
private let conPawsSnapshotKey = "conpaws.widget.snapshot.v1"

enum ConPawsActivityPhase: String, Codable, Hashable, Sendable {
  case upcoming
  case current
  case leave
  case finished
}

struct ConPawsActivityAttributes: ActivityAttributes, Sendable {
  struct ContentState: Codable, Hashable, Sendable {
    var phase: ConPawsActivityPhase
    let localeIdentifier: String
    let timeZoneIdentifier: String
    let conventionName: String
    let eventId: String
    let eventTitle: String
    let room: String?
    let publishedStartAtMs: Double
    let publishedEndAtMs: Double?
    let attendanceStartAtMs: Double
    let attendanceEndAtMs: Double?
    let attendanceNeedsReview: Bool
    let hasPersonalStart: Bool
    let hasPersonalEnd: Bool
    let nextEventTitle: String?
    let nextRoom: String?
    let nextAttendanceStartAtMs: Double?
  }

  let conventionId: String
}

private struct ConPawsActivityPayload: Decodable, Sendable {
  let conventionId: String
  let staleAtMs: Double?
  let content: ConPawsActivityAttributes.ContentState

  var activityContent: ActivityContent<ConPawsActivityAttributes.ContentState> {
    ActivityContent(
      state: content,
      staleDate: staleAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) }
    )
  }

  var isValid: Bool {
    guard
      conPawsSafeText(conventionId),
      conPawsSafeText(content.localeIdentifier),
      conPawsSafeText(content.timeZoneIdentifier),
      conPawsSafeText(content.conventionName),
      conPawsSafeText(content.eventId),
      conPawsSafeText(content.eventTitle),
      content.room.map { conPawsSafeText($0, allowsEmpty: true) } ?? true,
      content.nextEventTitle.map { conPawsSafeText($0) } ?? true,
      content.nextRoom.map { conPawsSafeText($0, allowsEmpty: true) } ?? true,
      content.publishedStartAtMs.isFinite,
      content.attendanceStartAtMs.isFinite,
      content.publishedEndAtMs.map { $0.isFinite && $0 > content.publishedStartAtMs } ?? true,
      content.attendanceEndAtMs.map { $0.isFinite && $0 > content.attendanceStartAtMs } ?? true,
      content.nextAttendanceStartAtMs.map { $0.isFinite } ?? true,
      staleAtMs.map { $0.isFinite } ?? true,
      (content.nextEventTitle == nil) == (content.nextAttendanceStartAtMs == nil)
    else {
      return false
    }
    return true
  }
}

private func conPawsSafeText(_ value: String, allowsEmpty: Bool = false) -> Bool {
  value.utf8.count <= 512 &&
    (allowsEmpty || !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
}

private func conPawsActivityStatus(
  availability: String = "available",
  reason: String? = nil
) -> [String: Any] {
  let activity = Activity<ConPawsActivityAttributes>.activities.first
  var status: [String: Any] = [
    "availability": availability,
    "active": activity != nil,
  ]
  if let activity {
    status["activityId"] = activity.id
    status["phase"] = activity.content.state.phase.rawValue
  }
  if let reason {
    status["reason"] = reason
  }
  return status
}

private func decodeConPawsActivity(_ json: String) -> ConPawsActivityPayload? {
  guard
    let data = json.data(using: .utf8),
    data.count <= 4_096,
    let payload = try? JSONDecoder().decode(ConPawsActivityPayload.self, from: data),
    payload.isValid
  else {
    return nil
  }
  return payload
}

private final class ConPawsWatchBridge: NSObject, WCSessionDelegate {
  private let queue = DispatchQueue(label: "com.mrdemonwolf.conpaws.watch-sync")
  private var latestJSON: String?
  private var shouldTransferLatest = false

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func publish(_ json: String, changed: Bool) {
    guard WCSession.isSupported() else { return }
    queue.async {
      self.latestJSON = json
      self.shouldTransferLatest = self.shouldTransferLatest || changed
      self.flushIfActivated(WCSession.default)
    }
  }

  private func flushIfActivated(_ session: WCSession) {
    guard session.activationState == .activated, let latestJSON else { return }

    do {
      try session.updateApplicationContext([conPawsSnapshotKey: latestJSON])
    } catch {
      NSLog("ConPaws Watch snapshot sync failed: %@", error.localizedDescription)
      return
    }

    if shouldTransferLatest {
      guard session.isPaired, session.isWatchAppInstalled else { return }
      session.transferUserInfo([conPawsSnapshotKey: latestJSON])
      shouldTransferLatest = false
    }
    self.latestJSON = nil
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated else {
      if let error {
        NSLog("ConPaws Watch session activation failed: %@", error.localizedDescription)
      }
      return
    }
    queue.async {
      self.flushIfActivated(session)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    queue.async {
      self.flushIfActivated(session)
    }
  }
}

public class ConPawsWidgetsModule: Module {
  /// Snapshot schemas this binary knows how to render.
  ///
  /// The widget and complication read the App Group directly, so they can only
  /// ever be as new as the installed binary -- while the JS that writes the
  /// snapshot can be replaced under it by an update. Anything outside this
  /// range has to clear the slot rather than be stored or silently ignored:
  /// leaving the old payload in place freezes both surfaces on a schedule
  /// weeks out of date, with no empty state to say so.
  ///
  /// Duplicated from `ConPawsSnapshotStore.supportedSchemaVersions` because
  /// this module compiles as a pod, on the other side of a target boundary
  /// from `_shared`. Keep the two in step.
  private static let supportedSchemaVersions = 1...3

  private let watchBridge = ConPawsWatchBridge()

  public func definition() -> ModuleDefinition {
    Name("ConPawsWidgets")

    OnCreate {
      self.watchBridge.activate()
    }

    Function("consumePendingQuickAction") { () -> String? in
      let key = "conpaws.pending-quick-action"
      let route = UserDefaults.standard.string(forKey: key)
      UserDefaults.standard.removeObject(forKey: key)
      return route
    }

    Function("getSupportedSnapshotSchemaVersion") {
      Self.supportedSchemaVersions.upperBound
    }

    Function("getLiveActivityStatus") {
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        return ["availability": "disabled", "active": false] as [String: Any]
      }
      return conPawsActivityStatus()
    }

    AsyncFunction("startOrUpdateLiveActivity") { (json: String, promise: Promise) in
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        promise.resolve(["availability": "disabled", "active": false] as [String: Any])
        return
      }
      guard let payload = decodeConPawsActivity(json) else {
        promise.resolve(conPawsActivityStatus(reason: "invalid-payload"))
        return
      }

      Task { @MainActor in
        do {
          let activities = Activity<ConPawsActivityAttributes>.activities
          var activity = activities.first
          for duplicate in activities.dropFirst() {
            await duplicate.end(nil, dismissalPolicy: .immediate)
          }
          if let current = activity,
            current.attributes.conventionId != payload.conventionId
          {
            await current.end(nil, dismissalPolicy: .immediate)
            activity = nil
          }

          if let activity {
            await activity.update(payload.activityContent)
            promise.resolve(conPawsActivityStatus())
          } else {
            let activity = try Activity<ConPawsActivityAttributes>.request(
              attributes: ConPawsActivityAttributes(conventionId: payload.conventionId),
              content: payload.activityContent,
              pushType: nil
            )
            promise.resolve([
              "availability": "available",
              "active": true,
              "activityId": activity.id,
              "phase": payload.content.phase.rawValue,
            ] as [String: Any])
          }
        } catch {
          promise.reject(error)
        }
      }
    }

    AsyncFunction("endLiveActivity") { (showFinishedState: Bool, promise: Promise) in
      Task { @MainActor in
        for activity in Activity<ConPawsActivityAttributes>.activities {
          if showFinishedState {
            var state = activity.content.state
            state.phase = .finished
            await activity.end(
              ActivityContent(state: state, staleDate: nil),
              dismissalPolicy: .after(Date().addingTimeInterval(60))
            )
          } else {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
        var status: [String: Any] = [
          "availability": "available",
          "active": false,
        ]
        if showFinishedState {
          status["phase"] = ConPawsActivityPhase.finished.rawValue
        }
        promise.resolve(status)
      }
    }

    AsyncFunction("publishSnapshot") { (json: String) -> Bool in
      guard
        let data = json.data(using: .utf8),
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let schemaVersion = object["schemaVersion"] as? Int,
        let bundleIdentifier = Bundle.main.bundleIdentifier,
        let defaults = UserDefaults(suiteName: "group.\(bundleIdentifier)")
      else {
        return false
      }

      let key = conPawsSnapshotKey

      guard Self.supportedSchemaVersions.contains(schemaVersion) else {
        defaults.removeObject(forKey: key)
        WidgetCenter.shared.reloadAllTimelines()
        return false
      }

      let changed = defaults.string(forKey: key) != json
      defaults.set(json, forKey: key)
      if changed {
        WidgetCenter.shared.reloadAllTimelines()
      }
      self.watchBridge.publish(json, changed: changed)
      return true
    }
  }
}
