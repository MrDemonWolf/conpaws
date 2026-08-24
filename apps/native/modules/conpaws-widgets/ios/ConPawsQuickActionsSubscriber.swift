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
    return true
  }

  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let route = route(for: shortcutItem.type) else {
      completionHandler(false)
      return
    }
    UserDefaults.standard.set(route, forKey: pendingRouteKey)
    completionHandler(true)
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
