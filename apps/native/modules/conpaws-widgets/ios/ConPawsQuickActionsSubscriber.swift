#if os(iOS)
import ExpoModulesCore
import UIKit

public final class ConPawsQuickActionsSubscriber: ExpoAppDelegateSubscriber {
  private let pendingRouteKey = "conpaws.pending-quick-action"

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    application.shortcutItems = [
      shortcut(type: "schedule", title: title(for: "schedule"), icon: .favorite),
      shortcut(type: "create", title: title(for: "create"), icon: .add),
      shortcut(type: "import", title: title(for: "import"), icon: .capturePhoto),
    ]

    // A cold launch never calls performActionFor. When the app is not already
    // running, iOS hands the tapped shortcut to this method in launchOptions
    // instead, and that is the only chance to see it — so without this a Home
    // Screen action on a closed app just opened the default screen.
    if let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
      storePendingRoute(for: shortcutItem)
    }

    return true
  }

  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    completionHandler(storePendingRoute(for: shortcutItem))
  }

  /// Parks the route for JS to pick up once the router is mounted.
  ///
  /// Writing the same route twice is harmless — the read side removes the key
  /// as it consumes it — which is what makes it safe to call from both the
  /// cold-launch and the warm-launch path without coordinating them.
  @discardableResult
  private func storePendingRoute(for shortcutItem: UIApplicationShortcutItem) -> Bool {
    guard let route = route(for: shortcutItem.type) else { return false }
    UserDefaults.standard.set(route, forKey: pendingRouteKey)
    return true
  }

  private func shortcut(
    type: String,
    title: String,
    icon: UIApplicationShortcutIcon.IconType
  ) -> UIApplicationShortcutItem {
    UIApplicationShortcutItem(
      type: "com.mrdemonwolf.conpaws.\(type)",
      localizedTitle: title,
      localizedSubtitle: nil,
      icon: UIApplicationShortcutIcon(type: icon),
      userInfo: nil
    )
  }

  private func route(for type: String) -> String? {
    switch type.split(separator: ".").last {
    case "schedule": "/schedule"
    case "create": "/convention/create"
    case "import": "/convention/new/import"
    default: nil
    }
  }

  private func title(for action: String) -> String {
    let language = Locale.current.language.languageCode?.identifier ?? "en"
    let titles: [String: [String: String]] = [
      "en": ["schedule": "My Schedule", "create": "Add Convention", "import": "Import Schedule"],
      "de": ["schedule": "Mein Zeitplan", "create": "Convention hinzufügen", "import": "Zeitplan importieren"],
      "es": ["schedule": "Mi horario", "create": "Añadir convención", "import": "Importar horario"],
      "fr": ["schedule": "Mon programme", "create": "Ajouter une convention", "import": "Importer un programme"],
      "nl": ["schedule": "Mijn programma", "create": "Conventie toevoegen", "import": "Programma importeren"],
      "pl": ["schedule": "Mój harmonogram", "create": "Dodaj konwent", "import": "Importuj harmonogram"],
      "pt": ["schedule": "Minha programação", "create": "Adicionar convenção", "import": "Importar programação"],
      "sv": ["schedule": "Mitt schema", "create": "Lägg till konvent", "import": "Importera schema"],
    ]
    return titles[language]?[action] ?? titles["en"]?[action] ?? action
  }
}
#endif
