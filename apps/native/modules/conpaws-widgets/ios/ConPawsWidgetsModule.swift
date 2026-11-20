import ExpoModulesCore
import Foundation
import UIKit
import WatchConnectivity
import WidgetKit

/// The raw schedule slot mirrored to the Watch app and complication.
///
/// Named once for the same reason the widget kinds are: this string is a
/// contract with code in another target that no compiler checks, so a rename
/// that misses one spelling fails silently rather than failing to build.
private let conPawsSnapshotKey = "conpaws.widget.snapshot.v1"

/// The Watch's save and remove taps arrive under this key, as a JSON string.
/// Mirrors `ConPawsWatchCommand.messageKey` in targets/_shared, which this pod
/// cannot import; watch-command-contract.test.ts holds the spellings together.
private let conPawsWatchCommandKey = "conpaws.watch.command.v1"

/// Where received commands wait, in the App Group, until JS applies them.
private let conPawsWatchCommandQueueKey = "conpaws.watch.commands.v1"

/// A queue this long means JS has not run for a long while; the oldest go
/// first, and JS would ignore them as more than a day old anyway.
private let conPawsWatchCommandQueueLimit = 50

/// The phone's half of WatchConnectivity: snapshots out, commands in.
///
/// One per process, activated at launch by `ConPawsWatchSubscriber` rather
/// than by the module. Under the scene life cycle React Native, and with it
/// the module, starts only when a scene connects, and a background launch
/// for a Watch message connects none, so a session the module activated would
/// never hear the message.
private final class ConPawsWatchBridge: NSObject, WCSessionDelegate {
  static let shared = ConPawsWatchBridge()

  /// How long a backgrounded app is kept awake for JS to apply a command and
  /// publish the snapshot that confirms it. Well inside the system's budget.
  private static let commandBackgroundTime: TimeInterval = 25

  private let queue = DispatchQueue(label: "com.mrdemonwolf.conpaws.watch-sync")
  private var latestJSON: String?
  private var shouldTransferLatest = false
  /// Read and written on `queue`.
  private var isActivated = false

  /// Main thread only. Set by the module once JS exists, so nil on a launch
  /// with no scene, where nothing could apply a command until the next open.
  var onCommandQueued: (() -> Void)?
  /// Main thread only.
  private var commandTask: UIBackgroundTaskIdentifier = .invalid
  private var commandTaskTimeout: DispatchWorkItem?

  private override init() {
    super.init()
  }

  /// Safe to call more than once; only the first call activates.
  func activate() {
    guard WCSession.isSupported() else { return }
    let isFirst = queue.sync { () -> Bool in
      defer { isActivated = true }
      return !isActivated
    }
    guard isFirst else { return }
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

    // UTF-8 data, not a String. A property-list string with a single
    // non-ASCII character (a summary's ellipsis, a curly quote) is stored as
    // UTF-16, which doubles it past the 48 KB UTF-8 guard in
    // src/services/watch-snapshot.ts and into WatchConnectivity's limit. The
    // Watch reads either form.
    let payload: [String: Any] = [conPawsSnapshotKey: Data(latestJSON.utf8)]
    var isContextSent = true
    do {
      try session.updateApplicationContext(payload)
    } catch {
      // Still queued below: a refused context must not also hold back the
      // transfer, or the Watch hears nothing at all. The context is tried
      // again at the next activation or watch-state change.
      NSLog("ConPaws Watch snapshot sync failed: %@", error.localizedDescription)
      isContextSent = false
    }

    if shouldTransferLatest {
      guard session.isPaired, session.isWatchAppInstalled else { return }
      // Only the newest schedule matters. Older ones still waiting would
      // otherwise each be delivered, decoded and stored in turn after a
      // spell out of range.
      for transfer in session.outstandingUserInfoTransfers
      where !transfer.isTransferring && transfer.userInfo[conPawsSnapshotKey] != nil {
        transfer.cancel()
      }
      // With the complication on the active face, and budget left for the
      // day, this goes at once and wakes the Watch app to store it; a plain
      // user info waits for a moment the system picks. Both arrive as user
      // info on the Watch.
      if session.isComplicationEnabled, session.remainingComplicationUserInfoTransfers > 0 {
        session.transferCurrentComplicationUserInfo(payload)
      } else {
        session.transferUserInfo(payload)
      }
      shouldTransferLatest = false
    }
    if isContextSent {
      self.latestJSON = nil
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

  func sessionWatchStateDidChange(_ session: WCSession) {
    queue.async {
      self.flushIfActivated(session)
    }
  }

  // MARK: Commands from the Watch
  //
  // Native records, JS applies -- the same split as the tracked event's Stop.
  // A command can arrive with JS not running (a background launch has no
  // scene, so no React Native), so it is checked and queued here and nothing
  // else is done with it until JS reads the queue. JS acknowledges what it
  // has finished with only after publishing the snapshot that reflects it,
  // so a process that dies part-way loses nothing.

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receiveCommand(message, reply: nil)
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    receiveCommand(message, reply: replyHandler)
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receiveCommand(userInfo, reply: nil)
  }

  private func receiveCommand(_ payload: [String: Any], reply: (([String: Any]) -> Void)?) {
    guard
      let json = payload[conPawsWatchCommandKey] as? String,
      let command = Self.validatedCommand(json)
    else {
      reply?(["accepted": false])
      return
    }
    queue.async {
      let isNew = Self.enqueue(command)
      // Answered once the command is safely stored: the Watch falls back to
      // transferUserInfo when this never comes, and the id deduplicates that.
      reply?(["accepted": true])
      guard isNew else { return }
      DispatchQueue.main.async {
        guard let onCommandQueued = self.onCommandQueued else { return }
        self.holdBackgroundTimeForCommands()
        onCommandQueued()
      }
    }
  }

  /// Every queued command, oldest first, left in place until acknowledged.
  func peekCommands() -> [String] {
    queue.sync {
      Self.commandDefaults()?.stringArray(forKey: conPawsWatchCommandQueueKey) ?? []
    }
  }

  /// Removes the commands with these ids, and any entry too damaged to have
  /// one. JS calls this after handing the confirming snapshot to
  /// `publishSnapshot`, whose flush is already on `queue` ahead of this, so
  /// an empty queue means the background time has done its job.
  func acknowledgeCommands(_ ids: Set<String>) {
    queue.async {
      guard let defaults = Self.commandDefaults() else { return }
      let remaining = (defaults.stringArray(forKey: conPawsWatchCommandQueueKey) ?? [])
        .filter { json in Self.commandID(json).map { !ids.contains($0) } ?? false }
      if remaining.isEmpty {
        defaults.removeObject(forKey: conPawsWatchCommandQueueKey)
        DispatchQueue.main.async { self.releaseBackgroundTime() }
      } else {
        defaults.set(remaining, forKey: conPawsWatchCommandQueueKey)
      }
    }
  }

  /// A suspended app woken for a command runs only briefly, too briefly to
  /// apply it and send the snapshot the Watch waits on. This asks for a
  /// little longer; a later command extends it.
  private func holdBackgroundTimeForCommands() {
    dispatchPrecondition(condition: .onQueue(.main))
    if commandTask == .invalid {
      commandTask = UIApplication.shared.beginBackgroundTask(
        withName: "ConPaws Watch command"
      ) { [weak self] in
        self?.releaseBackgroundTime()
      }
    }
    commandTaskTimeout?.cancel()
    let timeout = DispatchWorkItem { [weak self] in self?.releaseBackgroundTime() }
    commandTaskTimeout = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.commandBackgroundTime, execute: timeout)
  }

  private func releaseBackgroundTime() {
    dispatchPrecondition(condition: .onQueue(.main))
    commandTaskTimeout?.cancel()
    commandTaskTimeout = nil
    guard commandTask != .invalid else { return }
    UIApplication.shared.endBackgroundTask(commandTask)
    commandTask = .invalid
  }

  private static func commandDefaults() -> UserDefaults? {
    guard let bundleIdentifier = Bundle.main.bundleIdentifier else { return nil }
    return UserDefaults(suiteName: "group.\(bundleIdentifier)")
  }

  /// Appends unless a command with the same id is already waiting. Runs on
  /// `queue` only, so a consume can never interleave with an append.
  private static func enqueue(_ command: (id: String, json: String)) -> Bool {
    guard let defaults = commandDefaults() else { return false }
    var queued = defaults.stringArray(forKey: conPawsWatchCommandQueueKey) ?? []
    guard !queued.contains(where: { commandID($0) == command.id }) else { return false }
    queued.append(command.json)
    defaults.set(Array(queued.suffix(conPawsWatchCommandQueueLimit)), forKey: conPawsWatchCommandQueueKey)
    return true
  }

  private static func commandID(_ json: String) -> String? {
    guard
      let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
    else { return nil }
    return object["id"] as? String
  }

  /// The command re-encoded with only its known fields, or nil unless it is
  /// one. Mirrors `ConPawsWatchCommand.isValid` and `parseWatchCommand` in
  /// src/services/watch-commands.ts: a known action, ids that are non-empty
  /// and shorter than 256 UTF-16 units, and a numeric sentAtMs.
  private static func validatedCommand(_ json: String) -> (id: String, json: String)? {
    guard
      json.utf8.count <= 4_096,
      let object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
      let action = object["action"] as? String,
      ["save", "remove"].contains(action),
      let id = identifier(object["id"]),
      let conventionId = identifier(object["conventionId"]),
      let eventId = identifier(object["eventId"]),
      let sentAt = object["sentAtMs"] as? NSNumber,
      CFGetTypeID(sentAt) != CFBooleanGetTypeID(),
      sentAt.doubleValue.isFinite
    else { return nil }
    let normalized: [String: Any] = [
      "id": id,
      "action": action,
      "conventionId": conventionId,
      "eventId": eventId,
      "sentAtMs": sentAt.doubleValue,
    ]
    guard
      let data = try? JSONSerialization.data(withJSONObject: normalized, options: [.sortedKeys]),
      let encoded = String(data: data, encoding: .utf8)
    else { return nil }
    return (id, encoded)
  }

  private static func identifier(_ value: Any?) -> String? {
    guard
      let value = value as? String,
      !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      (value as NSString).length < 256
    else { return nil }
    return value
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
  private static let supportedSchemaVersions = 1...2

  private var watchBridge: ConPawsWatchBridge { .shared }

  public func definition() -> ModuleDefinition {
    Name("ConPawsWidgets")

    // Sent when a save or remove from the Watch has been queued; JS answers
    // by reading the queue. JS also reads it at start and on every
    // foreground, so an event sent before it listens is not a lost command.
    Events("onWatchCommand")

    OnCreate { [weak self] in
      DispatchQueue.main.async {
        ConPawsWatchBridge.shared.onCommandQueued = { [weak self] in
          self?.sendEvent("onWatchCommand", [:])
        }
      }
      // Normally a no-op: ConPawsWatchSubscriber activated it at launch.
      self?.watchBridge.activate()
    }

    // The queued Watch commands as JSON strings, oldest first. Left queued
    // until acknowledged, so a command is not lost to a process that dies
    // before applying it.
    Function("peekWatchCommands") { () -> [String] in
      self.watchBridge.peekCommands()
    }

    // Takes the commands JS has finished with off the queue, once the
    // snapshot that reflects them has been published.
    Function("acknowledgeWatchCommands") { (ids: [String]) in
      self.watchBridge.acknowledgeCommands(Set(ids))
    }

    Function("consumePendingQuickAction") { () -> String? in
      ConPawsQuickActions.consume()
    }

    // Set natively when the tracked event's Live Activity Stop button is
    // pressed, even with the app closed; JS reads it on its next reconcile.
    Function("consumePendingTrackedEventStop") { () -> Bool in
      ConPawsTrackedEventStop.consumePending()
    }

    Function("getWidgetStrings") { (localeIdentifier: String) -> [String: Any]? in
      let strings = ConPawsStrings.resolve(localeIdentifier)
      guard let data = try? JSONEncoder().encode(strings) else { return nil }
      return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
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

      let stored = defaults.string(forKey: key)
      defaults.set(json, forKey: key)
      if stored != json {
        WidgetCenter.shared.reloadAllTimelines()
      }
      // The context always goes, so the Watch's stale check sees the new
      // stamp; a queued transfer only when the schedule itself changed.
      self.watchBridge.publish(json, changed: Self.hasNewContent(json, since: stored))
      return true
    }
  }

  /// Whether `json` says anything `stored` did not, apart from when it was
  /// made. Every publish stamps a fresh `generatedAtMs`, so comparing the
  /// raw strings queued a full transfer each time the app opened or a row
  /// changed, and a Watch app opened after a while replayed every one.
  private static func hasNewContent(_ json: String, since stored: String?) -> Bool {
    guard
      let stored,
      let old = snapshotContent(stored),
      let new = snapshotContent(json)
    else { return true }
    return old != new
  }

  private static func snapshotContent(_ json: String) -> NSDictionary? {
    guard
      var object = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
    else { return nil }
    object.removeValue(forKey: "generatedAtMs")
    return object as NSDictionary
  }
}

/// Starts WatchConnectivity as the app launches, before React Native exists.
///
/// A Watch tap can launch the phone app in the background, and that launch
/// connects no scene, so React Native and this module never start. Activated
/// here, the session still receives the command, checks it, queues it in the
/// App Group and answers the Watch; JS applies it the next time it runs,
/// which for an app iOS had terminated is the next time it is opened.
public final class ConPawsWatchSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    ConPawsWatchBridge.shared.activate()
    return false
  }
}
