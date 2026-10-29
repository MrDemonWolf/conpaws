package expo.modules.conpawswidgets

import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConPawsQuickActionsModule : Module() {
  private val lock = Any()

  override fun definition() = ModuleDefinition {
    Name("ConPawsQuickActions")
    Events("onQuickAction")

    // Cold launches retain the Activity intent until JS can pass its gates.
    Function("consumePendingQuickAction") {
      synchronized(lock) {
        captureIntent(appContext.currentActivity?.intent)
        val preferences = preferences() ?: return@synchronized null
        val route = preferences.getString(PENDING_ROUTE, null)
        preferences.edit().remove(PENDING_ROUTE).apply()
        route
      }
    }

    OnNewIntent { intent ->
      val captured = synchronized(lock) {
        // Strip a still-parked cold intent before recording the newer warm tap.
        val initial = captureIntent(appContext.currentActivity?.intent)
        val incoming = captureIntent(intent)
        initial || incoming
      }
      if (captured) sendEvent("onQuickAction", emptyMap<String, String>())
    }

    AsyncFunction("setQuickActionLabels") { labels: Map<String, String> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return@AsyncFunction false
      if (labels.keys != ROUTES.keys || labels.values.any { it.isBlank() }) return@AsyncFunction false
      val manager = context.getSystemService(ShortcutManager::class.java) ?: return@AsyncFunction false
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return@AsyncFunction false
      val preferences = preferences() ?: return@AsyncFunction false
      val unchanged = ROUTES.keys.all { preferences.getString("label.$it", null) == labels[it] }
      if (unchanged && manager.dynamicShortcuts.map { it.id }.toSet() == ROUTES.keys) return@AsyncFunction true
      if (manager.isRateLimitingActive) return@AsyncFunction false

      // Fixed IDs/ranks keep tasks predictable; only their translated labels change.
      val shortcuts = ROUTES.keys.mapIndexed { rank, id ->
        val intent = Intent(launchIntent)
          .setAction("${context.packageName}.quick-action")
          .setData(null)
          .putExtra(ACTION_ID, id)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        ShortcutInfo.Builder(context, id)
          .setShortLabel(labels.getValue(id))
          .setLongLabel(labels.getValue(id))
          .setRank(rank)
          .setIcon(Icon.createWithResource(context, ICONS.getValue(id)))
          .setIntent(intent)
          .build()
      }.take(manager.maxShortcutCountPerActivity)
      val updated = manager.setDynamicShortcuts(shortcuts)
      if (updated) {
        preferences.edit().also { editor ->
          labels.forEach { (id, label) -> editor.putString("label.$id", label) }
        }.apply()
      }
      updated
    }
  }

  private fun preferences() = appContext.reactContext
    ?.getSharedPreferences("conpaws.quick-actions", Context.MODE_PRIVATE)

  private fun captureIntent(intent: Intent?): Boolean = synchronized(lock) {
    val context = appContext.reactContext ?: return@synchronized false
    val receivedIntent = intent ?: return@synchronized false
    // Explicit app-scoped intents never pass arbitrary URLs to Expo Router.
    if (receivedIntent.action != "${context.packageName}.quick-action" ||
      receivedIntent.component?.packageName != context.packageName) return@synchronized false
    val id = receivedIntent.getStringExtra(ACTION_ID) ?: return@synchronized false
    receivedIntent.removeExtra(ACTION_ID)
    val route = ROUTES[id] ?: return@synchronized false
    preferences()?.edit()?.putString(PENDING_ROUTE, route)?.apply()
    true
  }

  companion object {
    private const val ACTION_ID = "conpaws.quick-action.id"
    private const val PENDING_ROUTE = "pending-route"
    private val ROUTES = linkedMapOf(
      "schedule" to "/schedule",
      "find" to "/convention/find",
      "create" to "/convention/create",
      "import" to "/convention/new/import",
    )
    private val ICONS = mapOf(
      "schedule" to R.drawable.shortcut_star,
      "find" to R.drawable.shortcut_search,
      "create" to R.drawable.shortcut_add,
      "import" to R.drawable.shortcut_download,
    )
  }
}
