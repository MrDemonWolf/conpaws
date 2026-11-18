package expo.modules.conpawswidgets

/** Dependency-free JVM checks for tracked-event rules; run by :conpaws-widgets:widgetModelCheck. */
object ConPawsTrackedEventChecks {
  @JvmStatic fun main(args: Array<String>) {
    val input = mapOf<String, Any?>(
      "eventId" to "e", "conventionId" to "c", "title" to "Fursuit parade", "text" to "10:00 AM – 11:00 AM · Hall A",
      "subText" to "Con", "startAtMs" to 1000.0, "cleanupAtMs" to 2000.0, "stopLabel" to "Stop",
      "channelName" to "Tracked event", "channelDescription" to "Shows the event you track.",
    )
    fun decode(value: Map<String, Any?>) = ConPawsTrackedEventModel.decode(value)
    val decoded = decode(input)!!
    check(decoded.startAtMs == 1000L && decoded.cleanupAtMs == 2000L && decoded.text.endsWith("Hall A"))
    check(decode(input + ("startAtMs" to 1000L))!!.startAtMs == 1000L)
    check(decode(input + ("subText" to " "))!!.subText.isEmpty())
    check(decode(input + ("channelDescription" to ""))!!.channelDescription.isEmpty())
    for (key in listOf("eventId", "conventionId", "title", "text", "stopLabel", "channelName")) {
      check(decode(input + (key to "  ")) == null) { "blank $key accepted" }
      check(decode(input - key) == null) { "missing $key accepted" }
      check(decode(input + (key to 3)) == null) { "non-string $key accepted" }
    }
    for (key in listOf("subText", "channelDescription")) check(decode(input - key) == null)
    for (bad in listOf(Double.NaN, Double.POSITIVE_INFINITY, 9e18, "1000", null)) {
      check(decode(input + ("startAtMs" to bad)) == null)
      check(decode(input + ("cleanupAtMs" to bad)) == null)
    }
    check(decode(input + ("cleanupAtMs" to 1000.0)) == null)
    check(decode(input + ("cleanupAtMs" to 999.0)) == null)
    check(ConPawsTrackedEventModel.decode(null) == null)
    check(ConPawsTrackedEventModel.decode(listOf(input)) == null)

    check(ConPawsTrackedEventModel.timeoutAfterMs(2000L, 500L) == 1500L)
    check(ConPawsTrackedEventModel.timeoutAfterMs(2000L, 1999L) == 1L)
    check(ConPawsTrackedEventModel.timeoutAfterMs(2000L, 2000L) == null)
    check(ConPawsTrackedEventModel.timeoutAfterMs(2000L, 5000L) == null)

    val active = TrackedEventRecord(TrackedEventState.ACTIVE, "e", "c", "token-1", 10_000_000L)
    check(ConPawsTrackedEventModel.canUpdate(active, "e", showing = true))
    check(!ConPawsTrackedEventModel.canUpdate(active, "e", showing = false))
    check(!ConPawsTrackedEventModel.canUpdate(active, "other", showing = true))
    check(!ConPawsTrackedEventModel.canUpdate(null, "e", showing = true))
    check(ConPawsTrackedEventModel.canRestore(active, "e", showing = false))
    check(!ConPawsTrackedEventModel.canRestore(active, "e", showing = true))
    check(!ConPawsTrackedEventModel.canRestore(active, "other", showing = false))
    check(!ConPawsTrackedEventModel.canRestore(null, "e", showing = false))
    for (state in listOf(TrackedEventState.STOPPED_BY_USER, TrackedEventState.DISMISSED_BY_USER)) {
      // A user stop or swipe must never be undone by an update or a restore.
      check(!ConPawsTrackedEventModel.canUpdate(active.copy(state = state), "e", showing = true))
      check(!ConPawsTrackedEventModel.canRestore(active.copy(state = state), "e", showing = false))
    }

    val stop = TrackedEventUserAction.STOP
    val dismiss = TrackedEventUserAction.DISMISS
    check(ConPawsTrackedEventModel.afterUserAction(active, stop, "token-1", 0L)?.state == TrackedEventState.STOPPED_BY_USER)
    check(ConPawsTrackedEventModel.afterUserAction(active, dismiss, "token-1", 0L)?.state == TrackedEventState.DISMISSED_BY_USER)
    // A Stop queued for an earlier session, or one without a token, changes nothing.
    for (token in listOf("token-0", "", null)) {
      check(ConPawsTrackedEventModel.afterUserAction(active, stop, token, 0L) == active)
      check(ConPawsTrackedEventModel.afterUserAction(active, dismiss, token, 0L) == active)
    }
    check(ConPawsTrackedEventModel.afterUserAction(null, stop, "token-1", 0L) == null)
    val stopped = active.copy(state = TrackedEventState.STOPPED_BY_USER)
    check(ConPawsTrackedEventModel.afterUserAction(stopped, dismiss, "token-1", 0L) == stopped)
    // The system timeout can arrive as a dismissal at the end time: that is the event ending, not a user stop.
    val slack = ConPawsTrackedEventModel.TIMEOUT_DISMISS_SLACK_MS
    check(ConPawsTrackedEventModel.afterUserAction(active, dismiss, "token-1", active.cleanupAtMs) == null)
    check(ConPawsTrackedEventModel.afterUserAction(active, dismiss, "token-1", active.cleanupAtMs - slack) == null)
    check(ConPawsTrackedEventModel.afterUserAction(active, dismiss, "token-1", active.cleanupAtMs - slack - 1)?.state == TrackedEventState.DISMISSED_BY_USER)
    check(ConPawsTrackedEventModel.afterUserAction(active, stop, "token-1", active.cleanupAtMs)?.state == TrackedEventState.STOPPED_BY_USER)

    check(ConPawsTrackedEventModel.read(active, showing = true) == TrackedEventReading(showing = true, stoppedByUser = false, clearStored = false))
    check(ConPawsTrackedEventModel.read(active, showing = false) == TrackedEventReading(showing = false, stoppedByUser = false, clearStored = false))
    check(ConPawsTrackedEventModel.read(null, showing = false) == TrackedEventReading(showing = false, stoppedByUser = false, clearStored = false))
    for (state in listOf(TrackedEventState.STOPPED_BY_USER, TrackedEventState.DISMISSED_BY_USER)) {
      check(ConPawsTrackedEventModel.read(active.copy(state = state), showing = false) == TrackedEventReading(showing = false, stoppedByUser = true, clearStored = true))
    }
    println("ConPaws Android tracked-event checks passed")
  }
}
