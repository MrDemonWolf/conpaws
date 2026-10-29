#if os(iOS)
import ExpoModulesCore
import UIKit

// SDK 58's ExpoAppSceneDelegate forwards cold and warm scene shortcuts to
// this subscriber. Keep the generated SceneDelegate subclassing Expo's class.
public final class ConPawsQuickActionsSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    ConPawsQuickActions.installCachedLabels()
    if let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
      ConPawsQuickActions.receive(shortcutItem)
    }
    return true
  }

  public func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    completionHandler(ConPawsQuickActions.receive(shortcutItem))
  }
}
#endif
