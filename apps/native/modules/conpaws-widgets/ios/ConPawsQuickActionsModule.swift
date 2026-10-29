#if os(iOS)
import ExpoModulesCore
import UIKit

enum ConPawsQuickActions {
  static let changed = Notification.Name("conpaws.quick-action.changed")
  private static let labelsKey = "conpaws.quick-action.labels"
  private static let pendingKey = "conpaws.pending-quick-action"
  private static let pendingLock = NSLock()
  private static let actions = [
    (id: "schedule", route: "/schedule", symbol: "star", fallback: "Schedule"),
    (id: "find", route: "/convention/find", symbol: "magnifyingglass", fallback: "Find Convention"),
    (id: "create", route: "/convention/create", symbol: "plus", fallback: "Create Convention"),
    (id: "import", route: "/convention/new/import", symbol: "square.and.arrow.down", fallback: "Import Schedule"),
  ]

  static func installCachedLabels() {
    let labels = UserDefaults.standard.dictionary(forKey: labelsKey) as? [String: String] ?? [:]
    install(labels)
  }

  static func updateLabels(_ labels: [String: String]) -> Bool {
    guard Set(labels.keys) == Set(actions.map(\.id)),
      labels.values.allSatisfy({ !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
    else { return false }
    UserDefaults.standard.set(labels, forKey: labelsKey)
    install(labels)
    return true
  }

  private static func install(_ labels: [String: String]) {
    guard let bundleID = Bundle.main.bundleIdentifier else { return }
    UIApplication.shared.shortcutItems = actions.map { action in
      UIApplicationShortcutItem(
        type: "\(bundleID).\(action.id)",
        localizedTitle: labels[action.id] ?? action.fallback,
        localizedSubtitle: nil,
        icon: UIApplicationShortcutIcon(systemImageName: action.symbol),
        userInfo: nil
      )
    }
  }

  @discardableResult
  static func receive(_ item: UIApplicationShortcutItem) -> Bool {
    guard let bundleID = Bundle.main.bundleIdentifier,
      let action = actions.first(where: { item.type == "\(bundleID).\($0.id)" })
    else { return false }
    pendingLock.lock()
    UserDefaults.standard.set(action.route, forKey: pendingKey)
    pendingLock.unlock()
    NotificationCenter.default.post(name: changed, object: nil)
    return true
  }

  static func consume() -> String? {
    pendingLock.lock()
    defer { pendingLock.unlock() }
    let route = UserDefaults.standard.string(forKey: pendingKey)
    UserDefaults.standard.removeObject(forKey: pendingKey)
    return route
  }
}

public final class ConPawsQuickActionsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ConPawsQuickActions")
    Events("onQuickAction")

    Function("consumePendingQuickAction") { ConPawsQuickActions.consume() }
    AsyncFunction("setQuickActionLabels") { (labels: [String: String]) in
      ConPawsQuickActions.updateLabels(labels)
    }.runOnQueue(.main)

    OnStartObserving {
      self.observer = NotificationCenter.default.addObserver(
        forName: ConPawsQuickActions.changed, object: nil, queue: .main
      ) { [weak self] _ in self?.sendEvent("onQuickAction", [:]) }
    }
    OnStopObserving { self.stopObserving() }
    OnDestroy { self.stopObserving() }
  }

  private func stopObserving() {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    observer = nil
  }
}
#endif
