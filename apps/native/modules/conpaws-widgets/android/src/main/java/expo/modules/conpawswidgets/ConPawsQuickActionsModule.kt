package expo.modules.conpawswidgets

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ConPawsQuickActionsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConPawsQuickActions")
    Events("onQuickAction")

    // Activity hooks persist cold launches before DevLauncher or JS bootstrap.
    Function("consumePendingQuickAction") {
      val context = appContext.reactContext
      if (context == null) null else ConPawsQuickActionsStore.consume(context, appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      val context = appContext.reactContext ?: return@OnNewIntent
      ConPawsQuickActionsStore.capture(context, intent)
      // The Activity listener may already have captured and stripped this intent.
      if (ConPawsQuickActionsStore.hasPending(context)) sendEvent("onQuickAction", emptyMap<String, String>())
    }

    AsyncFunction("setQuickActionLabels") { labels: Map<String, String> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return@AsyncFunction false
      if (labels.keys != ConPawsQuickActionsStore.routes.keys || labels.values.any { it.isBlank() }) return@AsyncFunction false
      val manager = context.getSystemService(ShortcutManager::class.java) ?: return@AsyncFunction false
      val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: return@AsyncFunction false
      val preferences = ConPawsQuickActionsStore.preferences(context)
      val unchanged = ConPawsQuickActionsStore.routes.keys.all { preferences.getString("label.$it", null) == labels[it] }
      if (unchanged && manager.dynamicShortcuts.map { it.id }.toSet() == ConPawsQuickActionsStore.routes.keys) return@AsyncFunction true
      if (manager.isRateLimitingActive) return@AsyncFunction false

      // Fixed IDs/ranks keep tasks predictable; only their translated labels change.
      val shortcuts = ConPawsQuickActionsStore.routes.keys.mapIndexed { rank, id ->
        val intent = Intent(launchIntent)
          .setAction("${context.packageName}.quick-action")
          .setData(null)
          .putExtra(ConPawsQuickActionsStore.ACTION_ID, id)
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

  companion object {
    private val ICONS = mapOf(
      "schedule" to R.drawable.shortcut_star,
      "find" to R.drawable.shortcut_search,
      "create" to R.drawable.shortcut_add,
      "import" to R.drawable.shortcut_download,
    )
  }
}
