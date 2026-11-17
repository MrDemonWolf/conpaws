package expo.modules.conpawswidgets

import android.app.ActivityOptions
import android.os.Build
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import expo.modules.widgets.ExpoWidgetsAppWidgetProvider

/** Expo renders the card; this adapter preserves ConPaws' guarded cold launch. */
open class ConPawsExpoWidgetProvider : ExpoWidgetsAppWidgetProvider("ConPawsWidget") {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    ConPawsWidgetUpdates.schedule(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "expo.modules.widgets.ACTION_WIDGET_INTERACTION" &&
      intent.getStringExtra("expo.modules.widgets.extra.SOURCE") == "ConPawsWidget" &&
      intent.getStringExtra("expo.modules.widgets.extra.TARGET") == "__expo_widgets_target_0") {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launch.action = "${context.packageName}.quick-action"
      launch.putExtra(ConPawsQuickActionsStore.ACTION_ID, "schedule")
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val pending = PendingIntent.getActivity(context, 7301, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val options = if (Build.VERSION.SDK_INT >= 34) ActivityOptions.makeBasic().apply {
        if (Build.VERSION.SDK_INT >= 36) setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS)
        else {
          @Suppress("DEPRECATION")
          val legacyMode = ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
          setPendingIntentBackgroundActivityStartMode(legacyMode)
        }
      }.toBundle() else null
      try { pending.send(context, 0, null, null, null, null, options) } catch (_: PendingIntent.CanceledException) { }

      return
    }
    super.onReceive(context, intent)
  }
}
