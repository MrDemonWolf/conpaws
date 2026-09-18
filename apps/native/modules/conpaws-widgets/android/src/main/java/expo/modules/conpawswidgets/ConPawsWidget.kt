package expo.modules.conpawswidgets

import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.defaultWeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextOverflow
import androidx.glance.text.TextStyle
import java.util.Date
import java.util.TimeZone

private val COMPACT = DpSize(160.dp, 160.dp)
private val WIDE = DpSize(320.dp, 160.dp)
private val TALL = DpSize(320.dp, 320.dp)

class ConPawsWidget : GlanceAppWidget() {
  override val sizeMode = SizeMode.Responsive(setOf(COMPACT, WIDE, TALL))

  override suspend fun provideGlance(context: Context, id: GlanceId) {
    val state = ConPawsWidgetState.resolve(
      ConPawsSnapshotStore.load(context),
      System.currentTimeMillis(),
    )
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
      ?: Intent(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_LAUNCHER)
        .setPackage(context.packageName)

    provideContent {
      GlanceTheme {
        WidgetSurface(state, actionStartActivity(launchIntent))
      }
    }
  }
}

class ConPawsWidgetReceiver : GlanceAppWidgetReceiver() {
  override val glanceAppWidget: GlanceAppWidget = ConPawsWidget()
}

@Composable
private fun WidgetSurface(state: ConPawsWidgetState, openApp: Action) {
  val size = LocalSize.current
  Column(
    modifier = GlanceModifier
      .fillMaxSize()
      .background(GlanceTheme.colors.widgetBackground)
      .appWidgetBackground()
      .cornerRadius(R.dimen.conpaws_widget_corner_radius)
      .clickable(openApp)
      .padding(if (size == COMPACT) 14.dp else 16.dp),
  ) {
    WidgetHeader(state)
    Spacer(GlanceModifier.height(8.dp))
    when {
      size.height >= TALL.height -> TallContent(state)
      size.width >= WIDE.width -> WideContent(state)
      else -> CompactContent(state)
    }
  }
}

@Composable
private fun WidgetHeader(state: ConPawsWidgetState) {
  val context = LocalContext.current
  val convention = conventionOf(state)
  Row(GlanceModifier.fillMaxWidth()) {
    Text(
      text = context.getString(R.string.conpaws_widget_brand),
      modifier = GlanceModifier.defaultWeight(),
      style = labelStyle(),
      maxLines = 1,
    )
    convention?.let {
      Text(
        text = it.name,
        style = captionStyle(),
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
  }
}

@Composable
private fun CompactContent(state: ConPawsWidgetState) {
  val context = LocalContext.current
  when (state) {
    is ConPawsWidgetState.Active -> {
      val event = state.timeline.currentEvent ?: state.timeline.nextEvent
      if (event == null) {
        EmptyMessage(R.string.conpaws_widget_empty_title, R.string.conpaws_widget_empty_body)
      } else {
        Text(text = eventCue(context, state, event), style = labelStyle())
        Spacer(GlanceModifier.height(4.dp))
        Text(text = event.title, style = titleStyle(), maxLines = 2, overflow = TextOverflow.Ellipsis)
        eventPlace(event)?.let {
          Spacer(GlanceModifier.height(4.dp))
          Text(text = it, style = captionStyle(), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }
    }
    is ConPawsWidgetState.Upcoming -> {
      Text(text = context.getString(R.string.conpaws_widget_upcoming), style = labelStyle())
      Spacer(GlanceModifier.height(4.dp))
      Text(text = countdown(context, state.daysUntil), style = heroStyle())
      Text(text = state.convention.dateRangeLabel, style = captionStyle(), maxLines = 2)
    }
    is ConPawsWidgetState.Empty ->
      EmptyMessage(R.string.conpaws_widget_empty_title, R.string.conpaws_widget_empty_body)
    is ConPawsWidgetState.Finished ->
      EmptyMessage(R.string.conpaws_widget_finished_title, R.string.conpaws_widget_finished_body)
    ConPawsWidgetState.Unavailable ->
      EmptyMessage(R.string.conpaws_widget_unavailable_title, R.string.conpaws_widget_unavailable_body)
  }
}

@Composable
private fun WideContent(state: ConPawsWidgetState) {
  val context = LocalContext.current
  when (state) {
    is ConPawsWidgetState.Active -> Row(GlanceModifier.fillMaxWidth()) {
      PlanColumn(state, state.timeline.currentEvent ?: state.timeline.nextEvent, GlanceModifier.defaultWeight())
      Spacer(GlanceModifier.width(16.dp))
      val second = state.timeline.nextEvent.takeIf { state.timeline.currentEvent != null }
      if (second != null) {
        PlanColumn(state, second, GlanceModifier.defaultWeight())
      } else {
        Column(GlanceModifier.defaultWeight()) {
          Text(text = context.getString(R.string.conpaws_widget_no_next), style = bodyStyle(), maxLines = 2)
          Spacer(GlanceModifier.height(5.dp))
          Text(text = context.getString(R.string.conpaws_widget_open), style = labelStyle())
        }
      }
    }
    is ConPawsWidgetState.Upcoming -> Row(GlanceModifier.fillMaxWidth()) {
      Column(GlanceModifier.defaultWeight()) {
        Text(text = countdown(context, state.daysUntil), style = heroStyle())
        Text(text = state.convention.name, style = bodyStyle(), maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      Spacer(GlanceModifier.width(16.dp))
      Column(GlanceModifier.defaultWeight()) {
        Text(text = state.convention.dateRangeLabel, style = bodyStyle(), maxLines = 2)
        Spacer(GlanceModifier.height(5.dp))
        Text(text = context.getString(R.string.conpaws_widget_open), style = labelStyle())
      }
    }
    is ConPawsWidgetState.Empty ->
      WideMessage(R.string.conpaws_widget_empty_title, R.string.conpaws_widget_empty_body)
    is ConPawsWidgetState.Finished ->
      WideMessage(R.string.conpaws_widget_finished_title, R.string.conpaws_widget_finished_body)
    ConPawsWidgetState.Unavailable ->
      WideMessage(R.string.conpaws_widget_unavailable_title, R.string.conpaws_widget_unavailable_body)
  }
}

@Composable
private fun TallContent(state: ConPawsWidgetState) {
  val context = LocalContext.current
  when (state) {
    is ConPawsWidgetState.Active -> {
      val current = state.timeline.currentEvent
      val visible = state.timeline.events
        .filter { it == current || it.plannedStartAtMs > System.currentTimeMillis() }
        .take(3)
      visible.forEachIndexed { index, event ->
        if (index > 0) {
          gapText(context, state.timeline, visible[index - 1], event)?.let {
            Text(text = it, modifier = GlanceModifier.padding(vertical = 3.dp), style = captionStyle())
          }
        }
        EventRow(state, event)
      }
    }
    is ConPawsWidgetState.Upcoming -> {
      Text(text = countdown(context, state.daysUntil), style = heroStyle())
      Text(text = "${state.convention.name} · ${state.convention.dateRangeLabel}", style = bodyStyle(), maxLines = 2)
      Spacer(GlanceModifier.height(8.dp))
      state.convention.events.take(3).forEach { EventRow(state, it) }
      Spacer(GlanceModifier.defaultWeight())
      Text(text = context.getString(R.string.conpaws_widget_open), style = labelStyle())
    }
    is ConPawsWidgetState.Finished -> {
      Text(text = context.getString(R.string.conpaws_widget_finished_title), style = titleStyle())
      Text(text = context.getString(R.string.conpaws_widget_finished_body), style = captionStyle())
      Spacer(GlanceModifier.height(8.dp))
      state.events.takeLast(3).forEach { EventRow(state, it) }
    }
    is ConPawsWidgetState.Empty ->
      EmptyMessage(R.string.conpaws_widget_empty_title, R.string.conpaws_widget_empty_body)
    ConPawsWidgetState.Unavailable ->
      EmptyMessage(R.string.conpaws_widget_unavailable_title, R.string.conpaws_widget_unavailable_body)
  }
}

@Composable
private fun PlanColumn(
  state: ConPawsWidgetState.Active,
  event: ConPawsEventSnapshot?,
  modifier: GlanceModifier,
) {
  if (event == null) return
  val context = LocalContext.current
  Column(modifier) {
    Text(text = eventCue(context, state, event), style = labelStyle(), maxLines = 1)
    Text(text = event.title, style = bodyStyle(), maxLines = 2, overflow = TextOverflow.Ellipsis)
    eventPlace(event)?.let {
      Spacer(GlanceModifier.height(3.dp))
      Text(text = it, style = captionStyle(), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
}

@Composable
private fun EventRow(state: ConPawsWidgetState, event: ConPawsEventSnapshot) {
  val context = LocalContext.current
  val convention = conventionOf(state) ?: return
  Column(
    GlanceModifier
      .fillMaxWidth()
      .background(GlanceTheme.colors.primaryContainer)
      .cornerRadius(R.dimen.conpaws_widget_row_corner_radius)
      .padding(horizontal = 10.dp, vertical = 7.dp),
  ) {
    Text(
      text = "${formatTime(context, convention, event.plannedStartAtMs)} · ${event.title}",
      style = rowStyle(),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
    eventPlace(event)?.let {
      Text(text = it, style = rowCaptionStyle(), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
  }
  Spacer(GlanceModifier.height(5.dp))
}

@Composable
private fun EmptyMessage(title: Int, body: Int) {
  val context = LocalContext.current
  Text(text = context.getString(title), style = titleStyle(), maxLines = 2)
  Spacer(GlanceModifier.height(5.dp))
  Text(text = context.getString(body), style = captionStyle(), maxLines = 3)
  Spacer(GlanceModifier.defaultWeight())
  Text(text = context.getString(R.string.conpaws_widget_open), style = labelStyle())
}

@Composable
private fun WideMessage(title: Int, body: Int) {
  val context = LocalContext.current
  Row(GlanceModifier.fillMaxWidth()) {
    Text(text = context.getString(title), modifier = GlanceModifier.defaultWeight(), style = titleStyle(), maxLines = 2)
    Spacer(GlanceModifier.width(16.dp))
    Column(GlanceModifier.defaultWeight()) {
      Text(text = context.getString(body), style = captionStyle(), maxLines = 3)
      Spacer(GlanceModifier.height(5.dp))
      Text(text = context.getString(R.string.conpaws_widget_open), style = labelStyle())
    }
  }
}

private fun conventionOf(state: ConPawsWidgetState): ConPawsConventionSnapshot? = when (state) {
  is ConPawsWidgetState.Active -> state.convention
  is ConPawsWidgetState.Empty -> state.convention
  is ConPawsWidgetState.Finished -> state.convention
  is ConPawsWidgetState.Upcoming -> state.convention
  ConPawsWidgetState.Unavailable -> null
}

private fun eventCue(context: Context, state: ConPawsWidgetState.Active, event: ConPawsEventSnapshot): String {
  if (event == state.timeline.currentEvent) {
    val end = event.attendanceEndAtMs ?: event.endAtMs
      ?: return context.getString(R.string.conpaws_widget_now)
    val hasPersonalLeave = event.attendanceEndAtMs != null && event.attendanceEndAtMs != event.endAtMs
    return context.getString(
      if (hasPersonalLeave) R.string.conpaws_widget_leave_at else R.string.conpaws_widget_until,
      formatTime(context, state.convention, end),
    )
  }
  val start = formatTime(context, state.convention, event.plannedStartAtMs)
  val joinsLate = event.attendanceStartAtMs != null && event.attendanceStartAtMs != event.startAtMs
  return if (joinsLate) context.getString(R.string.conpaws_widget_join_at, start)
  else "${context.getString(R.string.conpaws_widget_next)} $start"
}

private fun eventPlace(event: ConPawsEventSnapshot): String? =
  listOfNotNull(event.room?.takeIf { it.isNotBlank() }, event.location?.takeIf { it.isNotBlank() })
    .distinct()
    .joinToString(" · ")
    .ifBlank { null }

private fun countdown(context: Context, days: Int): String = when (days) {
  0 -> context.getString(R.string.conpaws_widget_today)
  1 -> context.getString(R.string.conpaws_widget_tomorrow)
  else -> context.resources.getQuantityString(R.plurals.conpaws_widget_days, days, days)
}

private fun formatTime(context: Context, convention: ConPawsConventionSnapshot, milliseconds: Long): String =
  DateFormat.getTimeFormat(context).run {
    timeZone = TimeZone.getTimeZone(convention.timeZoneIdentifier)
    format(Date(milliseconds))
  }

private fun gapText(
  context: Context,
  timeline: ConPawsPlanTimeline,
  before: ConPawsEventSnapshot,
  after: ConPawsEventSnapshot,
): String {
  val minutes = (after.plannedStartAtMs - timeline.plannedEndAtMs(before)) / 60_000
  return when {
    minutes > 0 -> context.getString(R.string.conpaws_widget_free_minutes, minutes)
    minutes == 0L -> context.getString(R.string.conpaws_widget_back_to_back)
    else -> context.getString(R.string.conpaws_widget_overlap_minutes, -minutes)
  }
}

@Composable
private fun labelStyle() = TextStyle(
  color = GlanceTheme.colors.primary,
  fontSize = 11.sp,
  fontWeight = FontWeight.Bold,
)

@Composable
private fun titleStyle() = TextStyle(
  color = GlanceTheme.colors.onSurface,
  fontSize = 20.sp,
  fontWeight = FontWeight.Bold,
)

@Composable
private fun heroStyle() = TextStyle(
  color = GlanceTheme.colors.primary,
  fontSize = 28.sp,
  fontWeight = FontWeight.Bold,
)

@Composable
private fun bodyStyle() = TextStyle(
  color = GlanceTheme.colors.onSurface,
  fontSize = 14.sp,
  fontWeight = FontWeight.Bold,
)

@Composable
private fun captionStyle() = TextStyle(
  color = GlanceTheme.colors.onSurfaceVariant,
  fontSize = 11.sp,
)

@Composable
private fun rowStyle() = TextStyle(
  color = GlanceTheme.colors.onPrimaryContainer,
  fontSize = 14.sp,
  fontWeight = FontWeight.Bold,
)

@Composable
private fun rowCaptionStyle() = TextStyle(
  color = GlanceTheme.colors.onPrimaryContainer,
  fontSize = 11.sp,
)
