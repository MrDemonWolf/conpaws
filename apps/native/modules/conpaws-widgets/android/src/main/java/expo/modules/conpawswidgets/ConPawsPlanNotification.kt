package expo.modules.conpawswidgets

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import org.json.JSONTokener
import java.time.ZoneId
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private const val PLAN_CHANNEL_ID = "active-plan"
private const val PLAN_NOTIFICATION_ID = 0x4350
private const val PLAN_PREFERENCES = "conpaws.widgets"
private const val PLAN_ACTIVE_KEY = "conpaws.plan-notification.active"
private const val PLAN_PAYLOAD_KEY = "conpaws.plan-notification.payload"
private const val PLAN_PHASE_KEY = "conpaws.plan-notification.phase"
private const val MAX_PLAN_PAYLOAD_BYTES = 4_096
private const val FINISHED_TIMEOUT_MS = 60_000L

internal enum class ConPawsPlanPhase(val wireValue: String) {
  UPCOMING("upcoming"),
  CURRENT("current"),
  LEAVE("leave"),
  FINISHED("finished");

  companion object {
    fun fromWireValue(value: String): ConPawsPlanPhase? = entries.firstOrNull {
      it.wireValue == value
    }
  }
}

internal data class ConPawsPlanNotificationPayload(
  val conventionId: String,
  val staleAtMs: Long?,
  val phase: ConPawsPlanPhase,
  val localeIdentifier: String,
  val timeZoneIdentifier: String,
  val conventionName: String,
  val eventId: String,
  val eventTitle: String,
  val room: String?,
  val publishedStartAtMs: Long,
  val publishedEndAtMs: Long?,
  val attendanceStartAtMs: Long,
  val attendanceEndAtMs: Long?,
  val attendanceNeedsReview: Boolean,
  val hasPersonalStart: Boolean,
  val hasPersonalEnd: Boolean,
  val nextEventTitle: String?,
  val nextRoom: String?,
  val nextAttendanceStartAtMs: Long?,
)

internal object ConPawsPlanNotificationPayloadParser {
  fun parse(json: String): ConPawsPlanNotificationPayload? {
    if (json.toByteArray(Charsets.UTF_8).size > MAX_PLAN_PAYLOAD_BYTES) return null

    return try {
      val tokenizer = JSONTokener(json)
      val root = tokenizer.nextValue() as? JSONObject ?: return null
      if (tokenizer.nextClean() != '\u0000') return null
      val content = root.requiredObject("content")
      val publishedStartAtMs = content.requiredLong("publishedStartAtMs")
      val publishedEndAtMs = content.nullableLong("publishedEndAtMs")
      val attendanceStartAtMs = content.requiredLong("attendanceStartAtMs")
      val attendanceEndAtMs = content.nullableLong("attendanceEndAtMs")
      val nextTitle = content.nullableString("nextEventTitle")
      val nextStart = content.nullableLong("nextAttendanceStartAtMs")

      require(publishedStartAtMs >= 0)
      require(publishedEndAtMs == null || publishedEndAtMs > publishedStartAtMs)
      require(attendanceStartAtMs >= 0)
      require(attendanceEndAtMs == null || attendanceEndAtMs > attendanceStartAtMs)
      require((nextTitle == null) == (nextStart == null))
      require(nextStart == null || nextStart >= 0)

      ConPawsPlanNotificationPayload(
        conventionId = root.requiredString("conventionId"),
        staleAtMs = root.nullableLong("staleAtMs"),
        phase = ConPawsPlanPhase.fromWireValue(content.requiredString("phase"))
          ?: return null,
        localeIdentifier = content.requiredString("localeIdentifier"),
        timeZoneIdentifier = content.requiredString("timeZoneIdentifier"),
        conventionName = content.requiredString("conventionName"),
        eventId = content.requiredString("eventId"),
        eventTitle = content.requiredString("eventTitle"),
        room = content.nullableString("room"),
        publishedStartAtMs = publishedStartAtMs,
        publishedEndAtMs = publishedEndAtMs,
        attendanceStartAtMs = attendanceStartAtMs,
        attendanceEndAtMs = attendanceEndAtMs,
        attendanceNeedsReview = content.requiredBoolean("attendanceNeedsReview"),
        hasPersonalStart = content.requiredBoolean("hasPersonalStart"),
        hasPersonalEnd = content.requiredBoolean("hasPersonalEnd"),
        nextEventTitle = nextTitle,
        nextRoom = content.nullableString("nextRoom"),
        nextAttendanceStartAtMs = nextStart,
      ).also { ZoneId.of(it.timeZoneIdentifier) }
    } catch (_: Exception) {
      null
    }
  }

  private fun JSONObject.requiredObject(name: String): JSONObject =
    get(name) as? JSONObject ?: error("$name must be an object")

  private fun JSONObject.requiredString(name: String): String =
    (get(name) as? String)
      ?.takeIf { it.isNotBlank() && it.toByteArray(Charsets.UTF_8).size <= 512 }
      ?: error("$name must be a non-empty string")

  private fun JSONObject.nullableString(name: String): String? {
    if (!has(name) || isNull(name)) return null
    val value = get(name) as? String ?: error("$name must be a string or null")
    require(value.toByteArray(Charsets.UTF_8).size <= 512)
    return value
  }

  private fun JSONObject.requiredBoolean(name: String): Boolean =
    get(name) as? Boolean ?: error("$name must be a boolean")

  private fun JSONObject.requiredLong(name: String): Long = strictLong(get(name), name)

  private fun JSONObject.nullableLong(name: String): Long? {
    if (!has(name) || isNull(name)) return null
    return strictLong(get(name), name)
  }

  private fun strictLong(value: Any, name: String): Long {
    val number = value as? Number ?: error("$name must be a number")
    val double = number.toDouble()
    require(double.isFinite() && double == Math.rint(double))
    val long = double.toLong()
    require(long.toDouble() == double)
    return long
  }
}

internal fun projectPlanNotification(
  snapshot: ConPawsSnapshot,
  nowMs: Long,
): ConPawsPlanNotificationPayload? {
  return when (val state = ConPawsWidgetState.resolve(snapshot, nowMs)) {
    is ConPawsWidgetState.Active -> {
      val event = state.timeline.currentEvent ?: state.timeline.nextEvent ?: return null
      val next = state.timeline.nextEvent.takeIf { state.timeline.currentEvent != null }
      payloadFromEvent(
        snapshot,
        state.convention,
        event,
        next,
        if (state.timeline.currentEvent == null) ConPawsPlanPhase.UPCOMING
        else if (
          event.attendanceEndAtMs != null &&
          event.attendanceEndAtMs - nowMs in 0L..60_000L
        ) ConPawsPlanPhase.LEAVE
        else ConPawsPlanPhase.CURRENT,
        if (state.timeline.currentEvent == null) event.plannedStartAtMs
        else state.timeline.plannedEndAtMs(event),
      )
    }
    is ConPawsWidgetState.Upcoming -> {
      val timeline = ConPawsPlanTimeline(state.convention.events, nowMs)
      val event = timeline.nextEvent ?: return null
      payloadFromEvent(
        snapshot,
        state.convention,
        event,
        null,
        ConPawsPlanPhase.UPCOMING,
        event.plannedStartAtMs,
      )
    }
    is ConPawsWidgetState.Finished -> state.events.lastOrNull()?.let { event ->
      payloadFromEvent(
        snapshot,
        state.convention,
        event,
        null,
        ConPawsPlanPhase.FINISHED,
        null,
      )
    }
    is ConPawsWidgetState.Empty, ConPawsWidgetState.Unavailable -> null
  }
}

private fun payloadFromEvent(
  snapshot: ConPawsSnapshot,
  convention: ConPawsConventionSnapshot,
  event: ConPawsEventSnapshot,
  next: ConPawsEventSnapshot?,
  phase: ConPawsPlanPhase,
  staleAtMs: Long?,
): ConPawsPlanNotificationPayload = ConPawsPlanNotificationPayload(
  conventionId = convention.id,
  staleAtMs = staleAtMs,
  phase = phase,
  localeIdentifier = snapshot.localeIdentifier,
  timeZoneIdentifier = convention.timeZoneIdentifier,
  conventionName = convention.name,
  eventId = event.id,
  eventTitle = event.title,
  room = event.room ?: event.location,
  publishedStartAtMs = event.startAtMs,
  publishedEndAtMs = event.endAtMs,
  attendanceStartAtMs = event.plannedStartAtMs,
  attendanceEndAtMs = event.attendanceEndAtMs ?: event.endAtMs,
  attendanceNeedsReview = event.attendanceNeedsReview,
  hasPersonalStart = !event.attendanceNeedsReview &&
    event.attendanceStartAtMs != null && event.attendanceStartAtMs != event.startAtMs,
  hasPersonalEnd = !event.attendanceNeedsReview &&
    event.attendanceEndAtMs != null && event.attendanceEndAtMs != event.endAtMs,
  nextEventTitle = next?.title,
  nextRoom = next?.let { it.room ?: it.location },
  nextAttendanceStartAtMs = next?.plannedStartAtMs,
)

internal object ConPawsPlanNotification {
  fun status(context: Context, reason: String? = null): Map<String, Any> {
    val preferences = context.getSharedPreferences(PLAN_PREFERENCES, Context.MODE_PRIVATE)
    val result = mutableMapOf<String, Any>(
      "availability" to if (notificationsEnabled(context)) "available" else "disabled",
      "active" to preferences.getBoolean(PLAN_ACTIVE_KEY, false),
    )
    preferences.getString(PLAN_PHASE_KEY, null)?.let { result["phase"] = it }
    reason?.let { result["reason"] = it }
    return result
  }

  fun startOrUpdate(context: Context, json: String): Map<String, Any> {
    val payload = ConPawsPlanNotificationPayloadParser.parse(json)
      ?: return status(context, "invalid-payload")
    if (!notificationsEnabled(context)) return status(context)
    post(context, payload)
    save(context, json, payload)
    return status(context)
  }

  fun reconcile(context: Context, snapshot: ConPawsSnapshot) {
    val preferences = context.getSharedPreferences(PLAN_PREFERENCES, Context.MODE_PRIVATE)
    if (!preferences.getBoolean(PLAN_ACTIVE_KEY, false) || !notificationsEnabled(context)) return
    val payload = projectPlanNotification(snapshot, System.currentTimeMillis())
    if (payload == null) {
      stop(context, false)
      return
    }
    post(context, payload)
    save(context, null, payload)
  }

  fun stop(context: Context, showFinishedState: Boolean): Map<String, Any> {
    val preferences = context.getSharedPreferences(PLAN_PREFERENCES, Context.MODE_PRIVATE)
    val savedPayload = preferences.getString(PLAN_PAYLOAD_KEY, null)
      ?.let(ConPawsPlanNotificationPayloadParser::parse)
    if (showFinishedState && savedPayload != null && notificationsEnabled(context)) {
      post(context, savedPayload.copy(phase = ConPawsPlanPhase.FINISHED, staleAtMs = null))
    } else {
      NotificationManagerCompat.from(context).cancel(PLAN_NOTIFICATION_ID)
    }
    preferences.edit()
      .putBoolean(PLAN_ACTIVE_KEY, false)
      .remove(PLAN_PAYLOAD_KEY)
      .putString(
        PLAN_PHASE_KEY,
        if (showFinishedState && savedPayload != null) ConPawsPlanPhase.FINISHED.wireValue else null,
      )
      .apply()
    return status(context)
  }

  private fun save(
    context: Context,
    json: String?,
    payload: ConPawsPlanNotificationPayload,
  ) {
    context.getSharedPreferences(PLAN_PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(PLAN_ACTIVE_KEY, payload.phase != ConPawsPlanPhase.FINISHED)
      .putString(PLAN_PHASE_KEY, payload.phase.wireValue)
      .apply {
        if (json != null) putString(PLAN_PAYLOAD_KEY, json)
        else if (payload.phase == ConPawsPlanPhase.FINISHED) remove(PLAN_PAYLOAD_KEY)
      }
      .apply()
  }

  private fun post(context: Context, payload: ConPawsPlanNotificationPayload) {
    createChannel(context)
    val localizedContext = localizedContext(context, payload.localeIdentifier)
    val text = notificationText(localizedContext, payload)
    val icon = notificationIcon(context)
    val ongoing = payload.phase != ConPawsPlanPhase.FINISHED
    val builder = NotificationCompat.Builder(context, PLAN_CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(text.first)
      .setContentText(text.second)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text.second))
      .setSubText(cleanText(payload.conventionName))
      .setContentIntent(eventPendingIntent(context, payload))
      .setOngoing(ongoing)
      .setAutoCancel(!ongoing)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setAllowSystemGeneratedContextualActions(false)
      .addAction(icon, localizedContext.getString(R.string.conpaws_plan_open), planPendingIntent(context))

    if (ongoing) {
      builder.addAction(
        icon,
        localizedContext.getString(R.string.conpaws_plan_stop),
        stopPendingIntent(context),
      )
    }

    val timeout = when {
      !ongoing -> FINISHED_TIMEOUT_MS
      payload.staleAtMs != null && payload.staleAtMs > System.currentTimeMillis() ->
        payload.staleAtMs - System.currentTimeMillis() + FINISHED_TIMEOUT_MS
      else -> null
    }
    timeout?.let(builder::setTimeoutAfter)

    val publicVersion = NotificationCompat.Builder(context, PLAN_CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(localizedContext.getString(R.string.conpaws_plan_private_title))
      .setContentText(localizedContext.getString(R.string.conpaws_plan_private_body))
      .setContentIntent(planPendingIntent(context))
      .setOngoing(ongoing)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    builder.setPublicVersion(publicVersion)

    NotificationManagerCompat.from(context).notify(PLAN_NOTIFICATION_ID, builder.build())
  }

  private fun notificationText(
    context: Context,
    payload: ConPawsPlanNotificationPayload,
  ): Pair<String, String> {
    val title = cleanText(payload.eventTitle)
    val room = payload.room?.let(::cleanText)?.takeIf(String::isNotBlank)
    val next = nextText(context, payload)
    return when (payload.phase) {
      ConPawsPlanPhase.UPCOMING -> title to listOfNotNull(
        context.getString(
          if (payload.hasPersonalStart) R.string.conpaws_plan_join_at
          else R.string.conpaws_plan_starts_at,
          formatTime(context, payload, payload.attendanceStartAtMs),
        ),
        room,
      ).joinToString(" · ")
      ConPawsPlanPhase.CURRENT -> title to listOfNotNull(
        payload.attendanceEndAtMs?.let {
          context.getString(
            if (payload.hasPersonalEnd) R.string.conpaws_plan_leave_at
            else R.string.conpaws_plan_until,
            formatTime(context, payload, it),
          )
        } ?: context.getString(R.string.conpaws_plan_happening_now),
        room,
        next,
      ).joinToString("\n")
      ConPawsPlanPhase.LEAVE ->
        context.getString(R.string.conpaws_plan_leave_title, title) to
          (next ?: context.getString(R.string.conpaws_plan_leave_body))
      ConPawsPlanPhase.FINISHED ->
        context.getString(R.string.conpaws_plan_finished_title) to
          if (
            payload.hasPersonalEnd && payload.publishedEndAtMs != null &&
            payload.attendanceEndAtMs != null &&
            payload.publishedEndAtMs > payload.attendanceEndAtMs
          ) {
            context.getString(
              R.string.conpaws_plan_finished_continues,
              title,
              formatTime(context, payload, payload.publishedEndAtMs),
            )
          } else {
            context.getString(R.string.conpaws_plan_finished_body, title)
          }
    }
  }

  private fun nextText(context: Context, payload: ConPawsPlanNotificationPayload): String? {
    val title = payload.nextEventTitle?.let(::cleanText) ?: return null
    val start = payload.nextAttendanceStartAtMs?.let { formatTime(context, payload, it) } ?: return null
    val room = payload.nextRoom?.let(::cleanText)?.takeIf(String::isNotBlank)
    return if (room == null) context.getString(R.string.conpaws_plan_next, title, start)
    else context.getString(R.string.conpaws_plan_next_with_room, title, start, room)
  }

  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      PLAN_CHANNEL_ID,
      context.getString(R.string.conpaws_plan_channel_name),
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = context.getString(R.string.conpaws_plan_channel_description)
      setShowBadge(false)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun notificationsEnabled(context: Context): Boolean {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) return false
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = context.getSystemService(NotificationManager::class.java)
        .getNotificationChannel(PLAN_CHANNEL_ID)
      if (channel?.importance == NotificationManager.IMPORTANCE_NONE) return false
    }
    return true
  }

  private fun localizedContext(context: Context, identifier: String): Context {
    val locale = Locale.forLanguageTag(identifier.replace('_', '-'))
    val configuration = Configuration(context.resources.configuration)
    configuration.setLocale(locale)
    return context.createConfigurationContext(configuration)
  }

  private fun formatTime(
    context: Context,
    payload: ConPawsPlanNotificationPayload,
    milliseconds: Long,
  ): String = DateFormat.getTimeFormat(context).run {
    timeZone = TimeZone.getTimeZone(payload.timeZoneIdentifier)
    format(Date(milliseconds))
  }

  private fun eventPendingIntent(
    context: Context,
    payload: ConPawsPlanNotificationPayload,
  ): PendingIntent = activityPendingIntent(
    context,
    0x4351,
    Uri.Builder()
      .scheme(appScheme(context))
      .authority("convention")
      .appendPath(payload.conventionId)
      .appendQueryParameter("highlightEventId", payload.eventId)
      .build(),
  )

  private fun planPendingIntent(context: Context): PendingIntent = activityPendingIntent(
    context,
    0x4352,
    Uri.Builder().scheme(appScheme(context)).authority("schedule").build(),
  )

  private fun activityPendingIntent(context: Context, requestCode: Int, uri: Uri): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, uri)
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun stopPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, ConPawsPlanNotificationReceiver::class.java)
      .setAction(ConPawsPlanNotificationReceiver.ACTION_STOP)
    return PendingIntent.getBroadcast(
      context,
      0x4353,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun appScheme(context: Context): String =
    if (context.packageName.endsWith(".dev")) "conpaws-dev" else "conpaws"

  private fun notificationIcon(context: Context): Int =
    context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
      .takeIf { it != 0 }
      ?: context.applicationInfo.icon

  private fun cleanText(value: String): String = value
    .replace(Regex("\\s+"), " ")
    .trim()
    .take(180)
}

class ConPawsPlanNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ACTION_STOP) ConPawsPlanNotification.stop(context, false)
  }

  companion object {
    const val ACTION_STOP = "expo.modules.conpawswidgets.STOP_PLAN_NOTIFICATION"
  }
}
