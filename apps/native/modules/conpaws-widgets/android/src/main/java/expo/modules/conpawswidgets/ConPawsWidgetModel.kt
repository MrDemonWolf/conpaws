package expo.modules.conpawswidgets

import java.util.TimeZone

// Only persisted time boundaries cross into Kotlin; Expo owns selection and rendering.
internal data class WidgetEvent(val id: String, val start: Long, val end: Long?)
internal data class WidgetConvention(val id: String, val start: Long, val end: Long, val events: List<WidgetEvent>)
internal data class WidgetSnapshot(val conventions: List<WidgetConvention>)

internal object ConPawsWidgetModel {
  private val validZones = TimeZone.getAvailableIDs().toSet()
  private fun map(value: Any?) = value as? Map<*, *>
  private fun text(value: Any?) = (value as? String)?.takeIf { it.isNotBlank() }
  private fun instant(value: Any?): Long? {
    val number = (value as? Number)?.toDouble() ?: return null
    return number.takeIf { it.isFinite() && kotlin.math.abs(it) <= 8.64e15 }?.toLong()
  }

  fun decode(value: Any?): WidgetSnapshot? {
    val root = map(value) ?: return null
    if ((root["schemaVersion"] as? Number)?.toDouble() !in listOf(1.0, 2.0)) return null
    instant(root["generatedAtMs"]) ?: return null
    text(root["localeIdentifier"]) ?: return null
    val rawConventions = root["conventions"] as? List<*> ?: return null
    val seenConventions = mutableSetOf<String>()
    val conventions = rawConventions.mapNotNull { raw ->
      val row = map(raw) ?: return@mapNotNull null
      val id = text(row["id"]) ?: return@mapNotNull null
      text(row["name"]) ?: return@mapNotNull null
      val start = instant(row["startAtMs"]) ?: return@mapNotNull null
      val end = instant(row["endAtMs"]) ?: return@mapNotNull null
      val zone = text(row["timeZoneIdentifier"]) ?: return@mapNotNull null
      if (end < start || !seenConventions.add(id) || zone !in validZones) return@mapNotNull null
      val rawEvents = row["events"] as? List<*> ?: return@mapNotNull null
      val seenEvents = mutableSetOf<String>()
      val events = rawEvents.mapNotNull event@ { item ->
        val event = map(item) ?: return@event null
        val eventId = text(event["id"]) ?: return@event null
        text(event["title"]) ?: return@event null
        val eventStart = instant(event["startAtMs"]) ?: return@event null
        val eventEnd = event["endAtMs"]?.let { instant(it) ?: return@event null }
        if (eventEnd != null && eventEnd < eventStart || !seenEvents.add(eventId)) return@event null
        WidgetEvent(eventId, eventStart, eventEnd)
      }.sortedWith(compareBy<WidgetEvent> { it.start }.thenBy { it.id })
      WidgetConvention(id, start, end, events)
    }.sortedWith(compareBy<WidgetConvention> { it.start }.thenBy { it.id })
    return WidgetSnapshot(conventions)
  }

  fun effectiveEnd(event: WidgetEvent): Long = event.end ?: event.start + 3_600_000L

  fun nextBoundary(snapshot: WidgetSnapshot?, now: Long): Long? = snapshot?.conventions?.flatMap { convention ->
    listOf(convention.start, convention.end) + convention.events.flatMap { listOf(it.start, effectiveEnd(it)) }
  }?.filter { it > now }?.minOrNull()
}
