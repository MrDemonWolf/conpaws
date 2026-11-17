package expo.modules.conpawswidgets

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import java.util.UUID

/**
 * Shows the one event the user chose to track as a standard ongoing
 * notification. It is posted only while the app asks for it: there is no
 * foreground service, boot receiver or alarm, so nothing here can start
 * tracking on its own. The system timeout removes it when the event is over.
 *
 * Built with the platform Notification.Builder because androidx.core is not on
 * this module's compile classpath (expo-widgets only uses it internally).
 */
internal object ConPawsTrackedEventNotifier {
  const val CHANNEL_ID = "tracked-event"
  // One fixed tag and id, so a second tracked event always replaces the first.
  const val TAG = "conpaws.tracked-event"
  const val NOTIFICATION_ID = 7310
  const val ACTION_STOP = "expo.modules.conpawswidgets.TRACKED_EVENT_STOP"
  const val ACTION_DISMISS = "expo.modules.conpawswidgets.TRACKED_EVENT_DISMISS"
  const val EXTRA_TOKEN = "expo.modules.conpawswidgets.extra.TRACKED_EVENT_TOKEN"

  private const val CONTENT_REQUEST_CODE = 7302
  private const val STOP_REQUEST_CODE = 7303
  private const val DISMISS_REQUEST_CODE = 7304

  // Meta-data written by the expo-notifications config plugin; reminders use the same icon and colour.
  private const val NOTIFICATIONS_DEFAULT_ICON_META_DATA = "expo.modules.notifications.default_notification_icon"
  private const val NOTIFICATIONS_DEFAULT_COLOR_META_DATA = "expo.modules.notifications.default_notification_color"

  private val lock = Any()

  /** Called from the receiver, while the module is alive, so a Stop reaches JS without waiting for a reconcile. */
  @Volatile var stopListener: (() -> Unit)? = null

  fun present(context: Context, raw: Map<String, Any?>): String = synchronized(lock) {
    val input = ConPawsTrackedEventModel.decode(raw) ?: return "failed"
    val manager = context.getSystemService(NotificationManager::class.java) ?: return "failed"
    val timeout = ConPawsTrackedEventModel.timeoutAfterMs(input.cleanupAtMs, System.currentTimeMillis()) ?: return "failed"
    ensureChannel(manager, input)
    if (!canPost(context, manager)) return "notifications-denied"
    val record = TrackedEventRecord(TrackedEventState.ACTIVE, input.eventId, input.conventionId, UUID.randomUUID().toString(), input.cleanupAtMs)
    // The session is stored before posting, so a Stop pressed at once always finds it.
    if (!ConPawsTrackedEventStore.write(context, record)) return "failed"
    if (!post(context, manager, input, record.token, timeout)) {
      // Building the notification already pointed Stop and dismiss at the new
      // session, so an earlier event still on screen could no longer be
      // stopped from its own buttons. Nothing tracked is the only state that
      // is true on both sides.
      runCatching { manager.cancel(TAG, NOTIFICATION_ID) }
      ConPawsTrackedEventStore.clear(context)
      return "failed"
    }
    "started"
  }

  fun update(context: Context, raw: Map<String, Any?>): Boolean = synchronized(lock) {
    val input = ConPawsTrackedEventModel.decode(raw) ?: return false
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    val record = ConPawsTrackedEventStore.read(context)
    if (!ConPawsTrackedEventModel.canUpdate(record, input.eventId, isShowing(manager)) || record == null) return false
    repost(context, manager, input, record)
  }

  fun restore(context: Context, raw: Map<String, Any?>): Boolean = synchronized(lock) {
    val input = ConPawsTrackedEventModel.decode(raw) ?: return false
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    val record = ConPawsTrackedEventStore.read(context)
    if (!ConPawsTrackedEventModel.canRestore(record, input.eventId, isShowing(manager)) || record == null) return false
    repost(context, manager, input, record)
  }

  fun dismiss(context: Context): Boolean = synchronized(lock) {
    // An app cancel does not fire the delete intent, so this never reads as a user stop.
    context.getSystemService(NotificationManager::class.java)?.cancel(TAG, NOTIFICATION_ID)
    ConPawsTrackedEventStore.clear(context)
  }

  fun read(context: Context): Map<String, Any> = synchronized(lock) {
    val manager = context.getSystemService(NotificationManager::class.java)
    val reading = ConPawsTrackedEventModel.read(ConPawsTrackedEventStore.read(context), manager?.let(::isShowing) == true)
    if (reading.clearStored) ConPawsTrackedEventStore.clear(context)
    mapOf("showing" to reading.showing, "stoppedByUser" to reading.stoppedByUser)
  }

  /** Runs in the receiver with or without a JS runtime. */
  fun handleUserAction(context: Context, action: TrackedEventUserAction, token: String?) {
    val changed = synchronized(lock) {
      val record = ConPawsTrackedEventStore.read(context)
      val next = ConPawsTrackedEventModel.afterUserAction(record, action, token, System.currentTimeMillis())
      if (next == record) {
        // Nothing is being tracked, so a notification still offering Stop is an orphan; honour the tap.
        if (record == null && action == TrackedEventUserAction.STOP) {
          context.getSystemService(NotificationManager::class.java)?.cancel(TAG, NOTIFICATION_ID)
        }
        return@synchronized false
      }
      if (next == null) ConPawsTrackedEventStore.clear(context) else ConPawsTrackedEventStore.write(context, next)
      if (action == TrackedEventUserAction.STOP) {
        context.getSystemService(NotificationManager::class.java)?.cancel(TAG, NOTIFICATION_ID)
      }
      next != null
    }
    if (changed) runCatching { stopListener?.invoke() }
  }

  private fun repost(context: Context, manager: NotificationManager, input: TrackedEventInput, record: TrackedEventRecord): Boolean {
    val timeout = ConPawsTrackedEventModel.timeoutAfterMs(input.cleanupAtMs, System.currentTimeMillis()) ?: return false
    ensureChannel(manager, input)
    if (!canPost(context, manager)) return false
    // Keep the session token so a Stop already queued from the previous post still applies.
    val next = record.copy(conventionId = input.conventionId, cleanupAtMs = input.cleanupAtMs)
    if (next != record && !ConPawsTrackedEventStore.write(context, next)) return false
    return post(context, manager, input, record.token, timeout)
  }

  fun isShowing(manager: NotificationManager): Boolean = runCatching {
    manager.activeNotifications.any { it.tag == TAG && it.id == NOTIFICATION_ID }
  }.getOrDefault(false)

  private fun ensureChannel(manager: NotificationManager, input: TrackedEventInput) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    // Re-created on every post so a language change renames it; Android keeps the user's importance choice.
    val channel = NotificationChannel(CHANNEL_ID, input.channelName, NotificationManager.IMPORTANCE_LOW).apply {
      description = input.channelDescription
      setShowBadge(false)
      setSound(null, null)
      enableVibration(false)
    }
    manager.createNotificationChannel(channel)
  }

  /** Posting into a blocked app or channel succeeds silently, so check first and tell JS why. */
  private fun canPost(context: Context, manager: NotificationManager): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
    if (!manager.areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = manager.getNotificationChannel(CHANNEL_ID) ?: return false
      if (channel.importance == NotificationManager.IMPORTANCE_NONE) return false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val group = channel.group?.let { manager.getNotificationChannelGroup(it) }
        if (group?.isBlocked == true) return false
      }
    }
    return true
  }

  private fun post(context: Context, manager: NotificationManager, input: TrackedEventInput, token: String, timeout: Long): Boolean {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID).setTimeoutAfter(timeout)
    } else {
      // Android 7 has no channels and no timeout; the next app reconcile removes it after the event.
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_LOW).setDefaults(0)
    }
    builder
      .setSmallIcon(smallIcon(context))
      .setContentTitle(input.title)
      .setContentText(input.text)
      .setWhen(input.startAtMs)
      .setShowWhen(true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setCategory(Notification.CATEGORY_EVENT)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setDeleteIntent(broadcast(context, ACTION_DISMISS, DISMISS_REQUEST_CODE, token))
      .addAction(Notification.Action.Builder(null as Icon?, input.stopLabel, broadcast(context, ACTION_STOP, STOP_REQUEST_CODE, token)).build())
    if (input.subText.isNotEmpty()) builder.setSubText(input.subText)
    color(context)?.let(builder::setColor)
    ConPawsAppLaunch.quickActionPendingIntent(context, "schedule", CONTENT_REQUEST_CODE)?.let(builder::setContentIntent)
    return runCatching { manager.notify(TAG, NOTIFICATION_ID, builder.build()) }.isSuccess
  }

  private fun broadcast(context: Context, action: String, requestCode: Int, token: String): PendingIntent {
    // Explicit and immutable: only this app's receiver can be reached, and no one can rewrite the token.
    val intent = Intent(context, ConPawsTrackedEventReceiver::class.java).setAction(action).putExtra(EXTRA_TOKEN, token)
    return PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun smallIcon(context: Context): Int =
    applicationMetaData(context)?.getInt(NOTIFICATIONS_DEFAULT_ICON_META_DATA, 0)?.takeIf { it != 0 }
      ?: context.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.sym_def_app_icon

  private fun color(context: Context): Int? {
    val resourceId = applicationMetaData(context)?.getInt(NOTIFICATIONS_DEFAULT_COLOR_META_DATA, 0) ?: 0
    if (resourceId == 0) return null
    return runCatching { context.resources.getColor(resourceId, null) }.getOrNull()
  }

  @Suppress("DEPRECATION")
  private fun applicationMetaData(context: Context): Bundle? = runCatching {
    context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData
  }.getOrNull()
}
