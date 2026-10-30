package expo.modules.conpawswidgets

import android.content.Context
import android.content.Intent

// Shared by the Activity hooks and JS module, including before a ReactContext exists.
internal object ConPawsQuickActionsStore {
  const val ACTION_ID = "conpaws.quick-action.id"
  private const val PENDING_ROUTE = "pending-route"
  val routes = linkedMapOf(
    "schedule" to "/schedule",
    "find" to "/convention/find",
    "create" to "/convention/create",
    "import" to "/convention/new/import",
  )

  fun preferences(context: Context) =
    context.getSharedPreferences("conpaws.quick-actions", Context.MODE_PRIVATE)

  @Synchronized
  fun capture(context: Context, intent: Intent?): Boolean {
    val receivedIntent = intent ?: return false
    // Only our explicit launcher actions can queue one of the fixed app routes.
    if (receivedIntent.action != "${context.packageName}.quick-action" ||
      receivedIntent.component?.packageName != context.packageName) return false
    val id = receivedIntent.getStringExtra(ACTION_ID) ?: return false
    receivedIntent.removeExtra(ACTION_ID)
    val route = routes[id] ?: return false
    preferences(context).edit().putString(PENDING_ROUTE, route).apply()
    return true
  }

  @Synchronized
  fun consume(context: Context, initialIntent: Intent?): String? {
    capture(context, initialIntent)
    val preferences = preferences(context)
    val route = preferences.getString(PENDING_ROUTE, null)
    preferences.edit().remove(PENDING_ROUTE).apply()
    return route?.takeIf { it in routes.values }
  }

  @Synchronized
  fun hasPending(context: Context) = preferences(context).contains(PENDING_ROUTE)
}
