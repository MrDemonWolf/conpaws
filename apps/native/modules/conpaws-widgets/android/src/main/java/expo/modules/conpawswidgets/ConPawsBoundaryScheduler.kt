package expo.modules.conpawswidgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import java.util.Calendar

private const val ACTION_REFRESH = "expo.modules.conpawswidgets.REFRESH_BOUNDARY"
private const val BOUNDARY_REQUEST_CODE = 0x4354
private const val LEAVE_WARNING_MS = 60_000L
private const val FALLBACK_EVENT_DURATION_MS = 3_600_000L

internal object ConPawsBoundaryScheduler {
  fun schedule(context: Context, snapshot: ConPawsSnapshot? = ConPawsSnapshotStore.load(context)) {
    val nowMs = System.currentTimeMillis()
    val nextAtMs = listOfNotNull(
      snapshot?.let { nextSnapshotBoundary(it, nowMs) },
      ConPawsPlanNotification.nextBoundary(context, nowMs),
    ).minOrNull()
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val pendingIntent = pendingIntent(context)
    if (nextAtMs == null) alarmManager.cancel(pendingIntent)
    else alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextAtMs, pendingIntent)
  }

  private fun pendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    BOUNDARY_REQUEST_CODE,
    Intent(context, ConPawsBoundaryReceiver::class.java).setAction(ACTION_REFRESH),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}

internal fun nextSnapshotBoundary(snapshot: ConPawsSnapshot, nowMs: Long): Long? {
  var nextAtMs: Long? = null
  fun consider(value: Long?) {
    if (value != null && value > nowMs && (nextAtMs == null || value < nextAtMs!!)) {
      nextAtMs = value
    }
  }

  snapshot.conventions.forEach { convention ->
    consider(convention.startAtMs)
    consider(convention.endAtMs)
    val events = convention.events.sortedBy(ConPawsEventSnapshot::plannedStartAtMs)
    var currentStart: Long? = null
    var laterStart: Long? = null
    for (event in events.asReversed()) {
      if (currentStart != event.plannedStartAtMs) {
        laterStart = currentStart
        currentStart = event.plannedStartAtMs
      }
      consider(event.plannedStartAtMs)
      val fallbackEnd = if (event.plannedStartAtMs > Long.MAX_VALUE - FALLBACK_EVENT_DURATION_MS) {
        Long.MAX_VALUE
      } else {
        event.plannedStartAtMs + FALLBACK_EVENT_DURATION_MS
      }
      val endAtMs = event.attendanceEndAtMs
        ?: event.endAtMs
        ?: minOf(laterStart ?: Long.MAX_VALUE, fallbackEnd)
      if (endAtMs > LEAVE_WARNING_MS) consider(endAtMs - LEAVE_WARNING_MS)
      consider(endAtMs)
    }
  }

  val state = ConPawsWidgetState.resolve(snapshot, nowMs)
  if (state is ConPawsWidgetState.Upcoming) {
    val midnight = Calendar.getInstance(requireTimeZone(state.convention.timeZoneIdentifier)).apply {
      timeInMillis = nowMs
      add(Calendar.DAY_OF_MONTH, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    consider(midnight.timeInMillis)
  }
  return nextAtMs
}

class ConPawsBoundaryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (
      intent.action != ACTION_REFRESH &&
      intent.action != Intent.ACTION_BOOT_COMPLETED &&
      intent.action != Intent.ACTION_TIME_CHANGED &&
      intent.action != Intent.ACTION_TIMEZONE_CHANGED
    ) return

    val widgetManager = AppWidgetManager.getInstance(context)
    val component = ComponentName(context, ConPawsWidgetReceiver::class.java)
    val widgetIds = widgetManager.getAppWidgetIds(component)
    if (widgetIds.isNotEmpty()) {
      context.sendBroadcast(
        Intent(context, ConPawsWidgetReceiver::class.java)
          .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds),
      )
    }
    ConPawsPlanNotification.reconcileStoredSnapshot(context)
    ConPawsBoundaryScheduler.schedule(context)
  }
}
