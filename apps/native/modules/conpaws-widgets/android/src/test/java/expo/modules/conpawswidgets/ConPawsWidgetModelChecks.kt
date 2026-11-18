package expo.modules.conpawswidgets

/** Dependency-free JVM checks: ./gradlew :conpaws-widgets:widgetModelCheck */
object ConPawsWidgetModelChecks {
  @JvmStatic fun main(args: Array<String>) {
    val event = mapOf<String, Any?>("id" to "e", "title" to "Visit", "startAtMs" to 1000L, "endAtMs" to 2000L, "reminderMinutes" to 15)
    val convention = mapOf<String, Any?>("id" to "c", "name" to "Con", "startAtMs" to 0L, "endAtMs" to 10_000L, "timeZoneIdentifier" to "America/Chicago", "events" to listOf(event))
    val root = mapOf<String, Any?>("schemaVersion" to 2, "generatedAtMs" to 0L, "localeIdentifier" to "en", "conventions" to listOf(convention))
    fun decode(value: Map<String, Any?> = root) = ConPawsWidgetModel.decode(value)
    check(decode(root + ("schemaVersion" to 1)) != null)
    for (version in listOf(0, 3, 1.5, Double.NaN, "2")) check(decode(root + ("schemaVersion" to version)) == null)
    for (bad in listOf(Double.NaN, Double.POSITIVE_INFINITY, 9e18, "1000")) {
      check(decode(root + ("generatedAtMs" to bad)) == null)
      val snapshot = decode(root + ("conventions" to listOf(convention + ("events" to listOf(event + ("startAtMs" to bad))))))!!
      check(snapshot.conventions.single().events.isEmpty())
    }
    val invalidEnds = listOf(-1L, Double.NaN, Double.POSITIVE_INFINITY, "3000")
    for (bad in invalidEnds) check(decode(root + ("conventions" to listOf(convention + ("events" to listOf(event + ("endAtMs" to bad))))))!!.conventions.single().events.isEmpty())
    check(decode(root + ("conventions" to listOf(convention + ("timeZoneIdentifier" to "invalid"))))!!.conventions.isEmpty())
    check(decode(root + ("conventions" to listOf(convention, convention)))!!.conventions.size == 1)
    val unordered = listOf(event + mapOf("id" to "later", "startAtMs" to 3000L, "endAtMs" to 4000L), event + ("id" to "b"), event + ("id" to "a"), event + ("id" to "a"))
    val sorted = decode(root + ("conventions" to listOf(convention + ("events" to unordered))))!!
    check(sorted.conventions.single().events.map { it.id } == listOf("a", "b", "later"))
    val snapshot = decode()!!
    check(ConPawsWidgetModel.nextBoundary(snapshot, -1L) == 0L)
    check(ConPawsWidgetModel.nextBoundary(snapshot, 500L) == 1000L)
    check(ConPawsWidgetModel.nextBoundary(snapshot, 1000L) == 2000L)
    check(ConPawsWidgetModel.nextBoundary(snapshot, 2000L) == 10_000L)
    check(ConPawsWidgetModel.nextBoundary(snapshot, 10_000L) == null)
    check(ConPawsWidgetModel.nextBoundary(null, 0L) == null)
    val noEnd = snapshot.copy(conventions = listOf(snapshot.conventions.single().copy(events = listOf(WidgetEvent("unknown", 1000L, null)))))
    check(ConPawsWidgetModel.nextBoundary(noEnd, 10_000L) == 3_601_000L)
    check(ConPawsWidgetModel.nextBoundary(noEnd, 3_601_000L) == null)
    val refreshed = decode(root + ("conventions" to listOf(convention + ("events" to listOf(event + mapOf("startAtMs" to 3000L, "endAtMs" to 4000L))))))!!
    check(ConPawsWidgetModel.nextBoundary(refreshed, 500L) == 3000L)
    println("ConPaws Android widget model checks passed")
  }
}
