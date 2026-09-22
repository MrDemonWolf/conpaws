package expo.modules.conpawswidgets

import android.content.Context
import androidx.glance.appwidget.updateAll
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.util.Calendar
import java.util.TimeZone

internal const val CONPAWS_SNAPSHOT_SCHEMA_VERSION = 3
private val SUPPORTED_SNAPSHOT_SCHEMAS = 2..CONPAWS_SNAPSHOT_SCHEMA_VERSION
private const val MAX_SNAPSHOT_BYTES = 2_000_000
private const val MAX_CONVENTIONS = 100
private const val MAX_EVENTS = 5_000
private const val MILLIS_PER_DAY = 86_400_000L
private val AVAILABLE_TIME_ZONE_IDS = TimeZone.getAvailableIDs().toHashSet()

internal fun requireTimeZone(identifier: String): TimeZone {
  require(identifier in AVAILABLE_TIME_ZONE_IDS)
  return TimeZone.getTimeZone(identifier)
}

internal data class ConPawsEventSnapshot(
  val id: String,
  val title: String,
  val startAtMs: Long,
  val endAtMs: Long?,
  val attendanceStartAtMs: Long?,
  val attendanceEndAtMs: Long?,
  val attendanceNeedsReview: Boolean,
  val location: String?,
  val room: String?,
) {
  val plannedStartAtMs: Long
    get() = attendanceStartAtMs ?: startAtMs
}

internal data class ConPawsConventionSnapshot(
  val id: String,
  val name: String,
  val startAtMs: Long,
  val endAtMs: Long,
  val timeZoneIdentifier: String,
  val dateRangeLabel: String,
  val events: List<ConPawsEventSnapshot>,
)

internal data class ConPawsSnapshot(
  val schemaVersion: Int,
  val generatedAtMs: Long,
  val localeIdentifier: String,
  val conventions: List<ConPawsConventionSnapshot>,
)

internal sealed interface SnapshotParseResult {
  data class Valid(val snapshot: ConPawsSnapshot) : SnapshotParseResult
  data object Unsupported : SnapshotParseResult
  data object Malformed : SnapshotParseResult
}

internal object ConPawsSnapshotParser {
  fun parse(json: String): SnapshotParseResult {
    if (json.toByteArray(Charsets.UTF_8).size > MAX_SNAPSHOT_BYTES) {
      return SnapshotParseResult.Malformed
    }

    return try {
      val tokenizer = JSONTokener(json)
      val root = tokenizer.nextValue() as? JSONObject
        ?: return SnapshotParseResult.Malformed
      if (tokenizer.nextClean() != '\u0000') return SnapshotParseResult.Malformed

      val schemaVersion = root.requiredInt("schemaVersion")
      if (schemaVersion !in SUPPORTED_SNAPSHOT_SCHEMAS) {
        return SnapshotParseResult.Unsupported
      }

      val conventionsJSON = root.requiredArray("conventions")
      require(conventionsJSON.length() <= MAX_CONVENTIONS)
      var eventCount = 0
      val conventions = buildList {
        for (index in 0 until conventionsJSON.length()) {
          val value = conventionsJSON.getJSONObject(index)
          val eventsJSON = value.requiredArray("events")
          eventCount += eventsJSON.length()
          require(eventCount <= MAX_EVENTS)
          val events = buildList {
            for (eventIndex in 0 until eventsJSON.length()) {
              add(parseEvent(eventsJSON.getJSONObject(eventIndex), schemaVersion))
            }
          }
          val startAtMs = value.requiredLong("startAtMs")
          val endAtMs = value.requiredLong("endAtMs")
          require(startAtMs >= 0 && endAtMs > startAtMs)
          val timeZoneIdentifier = value.requiredString("timeZoneIdentifier")
          requireTimeZone(timeZoneIdentifier)
          add(
            ConPawsConventionSnapshot(
              id = value.requiredString("id"),
              name = value.requiredString("name"),
              startAtMs = startAtMs,
              endAtMs = endAtMs,
              timeZoneIdentifier = timeZoneIdentifier,
              dateRangeLabel = value.requiredString("dateRangeLabel"),
              events = events,
            ),
          )
        }
      }

      SnapshotParseResult.Valid(
        ConPawsSnapshot(
          schemaVersion = schemaVersion,
          generatedAtMs = root.requiredLong("generatedAtMs"),
          localeIdentifier = root.requiredString("localeIdentifier"),
          conventions = conventions,
        ),
      )
    } catch (_: Exception) {
      SnapshotParseResult.Malformed
    }
  }

  private fun parseEvent(
    value: JSONObject,
    schemaVersion: Int,
  ): ConPawsEventSnapshot {
    val startAtMs = value.requiredLong("startAtMs")
    val endAtMs = value.nullableLong("endAtMs", required = true)
    val attendanceStartAtMs =
      value.nullableLong("attendanceStartAtMs", required = schemaVersion >= 3)
    val attendanceEndAtMs =
      value.nullableLong("attendanceEndAtMs", required = schemaVersion >= 3)
    val attendanceNeedsReview =
      if (schemaVersion >= 3) value.requiredBoolean("attendanceNeedsReview") else false
    require(startAtMs >= 0)
    require(endAtMs == null || endAtMs > startAtMs)
    require(attendanceStartAtMs == null || attendanceStartAtMs >= 0)
    require(
      attendanceEndAtMs == null ||
        attendanceStartAtMs != null && attendanceEndAtMs > attendanceStartAtMs,
    )

    return ConPawsEventSnapshot(
      id = value.requiredString("id"),
      title = value.requiredString("title"),
      startAtMs = startAtMs,
      endAtMs = endAtMs,
      attendanceStartAtMs = attendanceStartAtMs,
      attendanceEndAtMs = attendanceEndAtMs,
      attendanceNeedsReview = attendanceNeedsReview,
      location = value.nullableString("location"),
      room = value.nullableString("room"),
    )
  }

  private fun JSONObject.requiredArray(name: String): JSONArray =
    get(name) as? JSONArray ?: error("$name must be an array")

  private fun JSONObject.requiredBoolean(name: String): Boolean =
    get(name) as? Boolean ?: error("$name must be a boolean")

  private fun JSONObject.requiredString(name: String): String =
    (get(name) as? String)?.takeIf { it.isNotBlank() }
      ?: error("$name must be a non-empty string")

  private fun JSONObject.nullableString(name: String): String? {
    if (!has(name) || isNull(name)) return null
    return get(name) as? String ?: error("$name must be a string or null")
  }

  private fun JSONObject.requiredInt(name: String): Int {
    val value = requiredLong(name)
    require(value in Int.MIN_VALUE..Int.MAX_VALUE)
    return value.toInt()
  }

  private fun JSONObject.requiredLong(name: String): Long =
    strictLong(get(name), name)

  private fun JSONObject.nullableLong(name: String, required: Boolean): Long? {
    if (!has(name)) {
      if (required) error("$name is required")
      return null
    }
    if (isNull(name)) return null
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

internal class ConPawsPlanTimeline(
  sourceEvents: List<ConPawsEventSnapshot>,
  private val nowMs: Long,
) {
  val events = sourceEvents.sortedWith(
    compareBy<ConPawsEventSnapshot> { it.plannedStartAtMs }
      .thenBy { it.title }
      .thenBy { it.id },
  )

  val currentEvent: ConPawsEventSnapshot? = events.withIndex()
    .mapNotNull { (index, event) ->
      if (event.plannedStartAtMs > nowMs) return@mapNotNull null
      event.takeIf { nowMs < endAtMs(index, event) }
    }
    .lastOrNull()

  val nextEvent: ConPawsEventSnapshot? =
    events.firstOrNull { it.plannedStartAtMs > nowMs }

  fun plannedEndAtMs(event: ConPawsEventSnapshot): Long {
    val index = events.indexOf(event)
    return if (index >= 0) endAtMs(index, event) else fallbackEnd(event, null)
  }

  private fun endAtMs(index: Int, event: ConPawsEventSnapshot): Long {
    event.attendanceEndAtMs?.let { return it }
    event.endAtMs?.let { return it }
    val laterStart = events.drop(index + 1)
      .firstOrNull { it.plannedStartAtMs > event.plannedStartAtMs }
      ?.plannedStartAtMs
    return fallbackEnd(event, laterStart)
  }

  private fun fallbackEnd(event: ConPawsEventSnapshot, laterStart: Long?): Long {
    val oneHourLater = if (event.plannedStartAtMs > Long.MAX_VALUE - 3_600_000) {
      Long.MAX_VALUE
    } else {
      event.plannedStartAtMs + 3_600_000
    }
    return minOf(laterStart ?: Long.MAX_VALUE, oneHourLater)
  }
}

internal sealed interface ConPawsWidgetState {
  data class Upcoming(
    val convention: ConPawsConventionSnapshot,
    val daysUntil: Int,
  ) : ConPawsWidgetState

  data class Active(
    val convention: ConPawsConventionSnapshot,
    val timeline: ConPawsPlanTimeline,
  ) : ConPawsWidgetState

  data class Empty(val convention: ConPawsConventionSnapshot) : ConPawsWidgetState
  data class Finished(
    val convention: ConPawsConventionSnapshot,
    val events: List<ConPawsEventSnapshot>,
  ) : ConPawsWidgetState

  data object Unavailable : ConPawsWidgetState

  companion object {
    fun resolve(snapshot: ConPawsSnapshot?, nowMs: Long): ConPawsWidgetState {
      if (snapshot == null || snapshot.conventions.isEmpty()) return Unavailable

      val selected = snapshot.conventions
        .filter { convention ->
          val timeline = ConPawsPlanTimeline(convention.events, nowMs)
          convention.endAtMs >= nowMs ||
            timeline.currentEvent != null ||
            timeline.nextEvent != null
        }
        .minWithOrNull(compareBy<ConPawsConventionSnapshot> { it.startAtMs }.thenBy { it.name })
        ?: snapshot.conventions.maxBy { it.endAtMs }

      if (nowMs < selected.startAtMs) {
        return Upcoming(selected, daysUntil(selected, nowMs))
      }

      val timeline = ConPawsPlanTimeline(selected.events, nowMs)
      if (timeline.currentEvent != null || timeline.nextEvent != null) {
        return Active(selected, timeline)
      }
      if (selected.events.isEmpty()) return Empty(selected)
      return Finished(selected, timeline.events)
    }

    internal fun daysUntil(
      convention: ConPawsConventionSnapshot,
      nowMs: Long,
    ): Int {
      val zone = requireTimeZone(convention.timeZoneIdentifier)
      val today = localEpochDay(nowMs, zone)
      val firstDay = localEpochDay(convention.startAtMs, zone)
      return (firstDay - today).coerceIn(0, Int.MAX_VALUE.toLong()).toInt()
    }

    private fun localEpochDay(milliseconds: Long, zone: TimeZone): Long {
      val local = Calendar.getInstance(zone).apply { timeInMillis = milliseconds }
      return Calendar.getInstance(TimeZone.getTimeZone("UTC")).run {
        clear()
        set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH))
        timeInMillis / MILLIS_PER_DAY
      }
    }
  }
}

internal object ConPawsSnapshotStore {
  private const val PREFERENCES_NAME = "conpaws.widgets"
  private const val SNAPSHOT_KEY = "conpaws.widget.snapshot.v1"

  fun load(context: Context): ConPawsSnapshot? {
    val json = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
      .getString(SNAPSHOT_KEY, null) ?: return null
    return (ConPawsSnapshotParser.parse(json) as? SnapshotParseResult.Valid)?.snapshot
  }

  fun save(context: Context, json: String): Pair<Boolean, Boolean> {
    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    if (preferences.getString(SNAPSHOT_KEY, null) == json) return true to false
    return preferences.edit().putString(SNAPSHOT_KEY, json).commit() to true
  }

  fun clear(context: Context): Boolean {
    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    if (!preferences.contains(SNAPSHOT_KEY)) return false
    preferences.edit().remove(SNAPSHOT_KEY).commit()
    return true
  }
}

class ConPawsWidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ConPawsWidgets")

    Function("getSupportedSnapshotSchemaVersion") {
      CONPAWS_SNAPSHOT_SCHEMA_VERSION
    }

    AsyncFunction("publishSnapshot") Coroutine { json: String ->
      val context = appContext.reactContext ?: return@Coroutine false
      when (val result = ConPawsSnapshotParser.parse(json)) {
        is SnapshotParseResult.Malformed -> false
        is SnapshotParseResult.Unsupported -> {
          if (ConPawsSnapshotStore.clear(context)) ConPawsWidget().updateAll(context)
          ConPawsBoundaryScheduler.schedule(context)
          false
        }
        is SnapshotParseResult.Valid -> {
          val (saved, changed) = ConPawsSnapshotStore.save(context, json)
          if (!saved) return@Coroutine false
          if (changed) ConPawsWidget().updateAll(context)
          ConPawsPlanNotification.reconcile(context, result.snapshot)
          ConPawsBoundaryScheduler.schedule(context, result.snapshot)
          true
        }
      }
    }

    Function("getLiveActivityStatus") {
      val context = appContext.reactContext
        ?: return@Function mapOf("availability" to "unsupported", "active" to false)
      ConPawsPlanNotification.status(context)
    }

    AsyncFunction("startOrUpdateLiveActivity") Coroutine { json: String ->
      val context = appContext.reactContext
        ?: return@Coroutine mapOf("availability" to "unsupported", "active" to false)
      ConPawsPlanNotification.startOrUpdate(context, json)
    }

    AsyncFunction("endLiveActivity") Coroutine { showFinishedState: Boolean ->
      val context = appContext.reactContext
        ?: return@Coroutine mapOf("availability" to "unsupported", "active" to false)
      ConPawsPlanNotification.stop(context, showFinishedState)
    }
  }
}
