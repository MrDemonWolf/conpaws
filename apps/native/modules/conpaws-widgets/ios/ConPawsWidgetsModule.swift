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

    let shouldTransfer = shouldTransferLatest
    self.latestJSON = nil
    shouldTransferLatest = false

    if shouldTransfer, session.isPaired, session.isWatchAppInstalled {
      session.transferUserInfo([Self.snapshotKey: latestJSON])
    }
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
}

public class ConPawsWidgetsModule: Module {
  private let watchBridge = ConPawsWatchBridge()

  public func definition() -> ModuleDefinition {
    Name("ConPawsWidgets")

    OnCreate {
      self.watchBridge.activate()
    }

    AsyncFunction("publishSnapshot") { (json: String) -> Bool in
      guard
        let data = json.data(using: .utf8),
        let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        object["schemaVersion"] as? Int == 1,
        let bundleIdentifier = Bundle.main.bundleIdentifier,
        let defaults = UserDefaults(suiteName: "group.\(bundleIdentifier)")
      else {
        return false
      }

      let key = "conpaws.widget.snapshot.v1"
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
