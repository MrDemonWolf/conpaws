package expo.modules.conpawswidgets

// Pure rules for the tracked-event notification. No Android imports, so the
// JVM check program can hold them without a device or a test library.

/** What JS sends: already translated and formatted on that side of the bridge. */
internal data class TrackedEventInput(
  val eventId: String,
  val conventionId: String,
  val title: String,
  val text: String,
  val subText: String,
  val startAtMs: Long,
  val cleanupAtMs: Long,
  val stopLabel: String,
  val channelName: String,
  val channelDescription: String,
)

internal enum class TrackedEventState { ACTIVE, STOPPED_BY_USER, DISMISSED_BY_USER }

internal enum class TrackedEventUserAction { STOP, DISMISS }

/**
 * What survives the process. The token names one tracking session, so a Stop
 * or dismissal queued for an earlier event can never end a newer one.
 */
internal data class TrackedEventRecord(
  val state: TrackedEventState,
  val eventId: String,
  val conventionId: String,
  val token: String,
  val cleanupAtMs: Long,
)

internal data class TrackedEventReading(val showing: Boolean, val stoppedByUser: Boolean, val clearStored: Boolean)

internal object ConPawsTrackedEventModel {
  /**
   * The system's own timeout can remove the notification at about the cleanup
   * time, and Android may report that through the delete intent. A dismissal
   * this close to (or after) the cleanup time is treated as the event ending,
   * not as the user choosing to stop.
   */
  const val TIMEOUT_DISMISS_SLACK_MS = 60_000L

  private fun text(value: Any?) = (value as? String)?.takeIf { it.isNotBlank() }
  private fun instant(value: Any?): Long? {
    val number = (value as? Number)?.toDouble() ?: return null
    return number.takeIf { it.isFinite() && kotlin.math.abs(it) <= 8.64e15 }?.toLong()
  }

  fun decode(value: Any?): TrackedEventInput? {
    val input = value as? Map<*, *> ?: return null
    val startAtMs = instant(input["startAtMs"]) ?: return null
    val cleanupAtMs = instant(input["cleanupAtMs"]) ?: return null
    if (cleanupAtMs <= startAtMs) return null
    // The convention name and the channel description only add context, so an
    // empty one must not stop the user from tracking; everything else is shown
    // as the notification's identity or its only control.
    val subText = input["subText"] as? String ?: return null
    val channelDescription = input["channelDescription"] as? String ?: return null
    return TrackedEventInput(
      eventId = text(input["eventId"]) ?: return null,
      conventionId = text(input["conventionId"]) ?: return null,
      title = text(input["title"]) ?: return null,
      text = text(input["text"]) ?: return null,
      subText = subText.trim(),
      startAtMs = startAtMs,
      cleanupAtMs = cleanupAtMs,
      stopLabel = text(input["stopLabel"]) ?: return null,
      channelName = text(input["channelName"]) ?: return null,
      channelDescription = channelDescription.trim(),
    )
  }

  /** Milliseconds until the system should remove the notification; null when it is already over. */
  fun timeoutAfterMs(cleanupAtMs: Long, now: Long): Long? = (cleanupAtMs - now).takeIf { it > 0 }

  /** Re-post in place: the same session is active and still on screen. */
  fun canUpdate(record: TrackedEventRecord?, eventId: String, showing: Boolean): Boolean =
    showing && record?.state == TrackedEventState.ACTIVE && record.eventId == eventId

  /**
   * Re-post after the system removed it without the user (reboot, force-stop,
   * app update): the session is still active but nothing is on screen.
   */
  fun canRestore(record: TrackedEventRecord?, eventId: String, showing: Boolean): Boolean =
    !showing && record?.state == TrackedEventState.ACTIVE && record.eventId == eventId

  /**
   * The record after a Stop or dismissal broadcast. Returns the record
   * unchanged when the broadcast belongs to another session or nothing is
   * active, and null when the stored state should be cleared.
   */
  fun afterUserAction(record: TrackedEventRecord?, action: TrackedEventUserAction, token: String?, now: Long): TrackedEventRecord? {
    if (record == null || token.isNullOrEmpty() || record.token != token || record.state != TrackedEventState.ACTIVE) return record
    return when (action) {
      TrackedEventUserAction.STOP -> record.copy(state = TrackedEventState.STOPPED_BY_USER)
      TrackedEventUserAction.DISMISS ->
        if (now >= record.cleanupAtMs - TIMEOUT_DISMISS_SLACK_MS) null
        else record.copy(state = TrackedEventState.DISMISSED_BY_USER)
    }
  }

  /** Reading a user stop or dismissal consumes it, so JS reports it exactly once. */
  fun read(record: TrackedEventRecord?, showing: Boolean): TrackedEventReading {
    val stopped = record?.state == TrackedEventState.STOPPED_BY_USER || record?.state == TrackedEventState.DISMISSED_BY_USER
    return TrackedEventReading(showing = showing, stoppedByUser = stopped, clearStored = stopped)
  }
}
