import ExpoModulesCore
import Foundation
import WatchConnectivity
import WidgetKit

private final class ConPawsWatchBridge: NSObject, WCSessionDelegate {
  private static let snapshotKey = "conpaws.widget.snapshot.v1"
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
      try session.updateApplicationContext([Self.snapshotKey: latestJSON])
    } catch {
      NSLog("ConPaws Watch snapshot sync failed: %@", error.localizedDescription)
      return
    }

    if shouldTransferLatest {
      guard session.isPaired, session.isWatchAppInstalled else { return }
      session.transferUserInfo([Self.snapshotKey: latestJSON])
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
  private static let supportedSchemaVersions = 1...1

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

      let key = "conpaws.widget.snapshot.v1"

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
