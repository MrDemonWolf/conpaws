package expo.modules.conpawswidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent

/** Expo Android has no timeline API; a native alarm asks its provider to render current props again. */
internal object ConPawsWidgetUpdates {
  private fun intent(context: Context) = PendingIntent.getBroadcast(context, 0,
    Intent(context, ConPawsWidgetBoundaryReceiver::class.java).setAction("${context.packageName}.widget-boundary"),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  fun schedule(context: Context) {
    val alarm = context.getSystemService(AlarmManager::class.java) ?: return
    alarm.cancel(intent(context))
    val manager = AppWidgetManager.getInstance(context)
    val provider = ComponentName(context.packageName, "${context.packageName}.ConPawsWidgetProvider")
    if (manager.getAppWidgetIds(provider).isEmpty()) return
    // Inexact updates may arrive late under power saving; rendered event times stay absolute,
    // and a reminder's "Starts in" count has a boundary for every minute it changes.
    ConPawsWidgetModel.nextBoundary(ConPawsWidgetStore.read(context), System.currentTimeMillis())?.let { next ->
      alarm.set(AlarmManager.RTC, next, intent(context))
    }
  }

  fun refresh(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val provider = ComponentName(context.packageName, "${context.packageName}.ConPawsWidgetProvider")
    val ids = manager.getAppWidgetIds(provider)
    if (ids.isNotEmpty()) context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
      .setComponent(provider).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids))
    schedule(context)
  }
}

class ConPawsWidgetBoundaryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action in listOf("${context.packageName}.widget-boundary", Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED))
      ConPawsWidgetUpdates.refresh(context)
  }
}
