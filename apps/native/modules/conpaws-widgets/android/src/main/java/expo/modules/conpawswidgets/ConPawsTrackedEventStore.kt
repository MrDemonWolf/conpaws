package expo.modules.conpawswidgets

import android.content.Context

/**
 * Device-only memory of the tracked-event session. Every write uses commit():
 * the receiver may be the last code to run before the process is killed, and a
 * Stop that never lands would bring the notification back on the next restore.
 */
internal object ConPawsTrackedEventStore {
  private const val STATE = "state"
  private const val EVENT_ID = "eventId"
  private const val CONVENTION_ID = "conventionId"
  private const val TOKEN = "token"
  private const val CLEANUP_AT_MS = "cleanupAtMs"

  private fun preferences(context: Context) =
    context.getSharedPreferences("conpaws.tracked-event", Context.MODE_PRIVATE)

  fun read(context: Context): TrackedEventRecord? {
    val preferences = preferences(context)
    val state = preferences.getString(STATE, null)
      ?.let { name -> TrackedEventState.entries.firstOrNull { it.name == name } } ?: return null
    val eventId = preferences.getString(EVENT_ID, null)?.takeIf { it.isNotBlank() } ?: return null
    val conventionId = preferences.getString(CONVENTION_ID, null)?.takeIf { it.isNotBlank() } ?: return null
    val token = preferences.getString(TOKEN, null)?.takeIf { it.isNotBlank() } ?: return null
    if (!preferences.contains(CLEANUP_AT_MS)) return null
    return TrackedEventRecord(state, eventId, conventionId, token, preferences.getLong(CLEANUP_AT_MS, 0L))
  }

  fun write(context: Context, record: TrackedEventRecord): Boolean = preferences(context).edit()
    .putString(STATE, record.state.name)
    .putString(EVENT_ID, record.eventId)
    .putString(CONVENTION_ID, record.conventionId)
    .putString(TOKEN, record.token)
    .putLong(CLEANUP_AT_MS, record.cleanupAtMs)
    .commit()

  fun clear(context: Context): Boolean = preferences(context).edit().clear().commit()
}
