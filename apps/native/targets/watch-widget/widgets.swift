import Foundation
import SwiftUI
import WidgetKit

private struct ConPawsWatchEntry: TimelineEntry {
  let date: Date
  let snapshot: ConPawsSnapshot
  /// Raises this card in the Smart Stack around the moments it matters —
  /// convention starts and chosen leave times. Without a relevance the stack never
  /// surfaces the complication on its own.
  var relevance: TimelineEntryRelevance?

  /// The app's language, not the watch's. The snapshot carries it precisely so
  /// this complication reads the same way the phone screen it mirrors does.
  var strings: ConPawsStrings { snapshot.strings }

  static var preview: ConPawsWatchEntry {
    let now = Date()
    let convention = ConPawsConventionSnapshot(
      id: "preview-convention",
      name: "ConPaws Preview Con",
      startAtMs: now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000,
      endAtMs: now.addingTimeInterval(86_400).timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
      dateRangeLabel: "Today",
      events: [
        ConPawsEventSnapshot(
          id: "preview-current",
          title: "Opening Ceremonies",
          startAtMs: now.addingTimeInterval(-1_800).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(600).timeIntervalSince1970 * 1_000,
          location: "Convention Center",
          room: "Main Ballroom",
          reminderMinutes: nil,
          ageRating: nil
        ),
        ConPawsEventSnapshot(
          id: "preview-next",
          title: "Fursuit Meetup",
          startAtMs: now.addingTimeInterval(1_200).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(4_800).timeIntervalSince1970 * 1_000,
          location: "Convention Center",
          room: "Hall A",
          reminderMinutes: 30,
          ageRating: nil
        ),
      ]
    )
    return ConPawsWatchEntry(
      date: now,
      snapshot: ConPawsSnapshot(
        schemaVersion: 2,
        generatedAtMs: now.timeIntervalSince1970 * 1_000,
        localeIdentifier: Locale.autoupdatingCurrent.identifier,
        conventions: [convention]
      )
    )
  }
}

private struct ConPawsWatchProvider: TimelineProvider {
  func placeholder(in context: Context) -> ConPawsWatchEntry {
    .preview
  }

  func getSnapshot(in context: Context, completion: @escaping (ConPawsWatchEntry) -> Void) {
    let cached = ConPawsSnapshotStore.load()
    completion(context.isPreview
      ? .preview
      : ConPawsWatchEntry(date: .now, snapshot: cached, relevance: nil))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<ConPawsWatchEntry>) -> Void
  ) {
    let now = Date()
    let snapshot = ConPawsSnapshotStore.load()
    let projection = WidgetScheduleProjection(snapshot: snapshot, now: now)

    // Pre-build an entry for every wording change rather than relying on the
    // system waking this extension on time. Complications get an even smaller
    // refresh budget than Home Screen widgets, so a frozen label is likelier
    // here, not less.
    // Within 30 minutes of the countdown target (a convention start or a leave
    // moment) the card is at its most useful; score it accordingly so the
    // Smart Stack rotates it up.
    func relevance(at date: Date) -> TimelineEntryRelevance? {
      guard let target = projection.countdownTarget else { return nil }
      let minutesOut = target.timeIntervalSince(date) / 60
      guard minutesOut > -30, minutesOut < 30 else { return nil }
      return TimelineEntryRelevance(score: 100, duration: 30 * 60)
    }

    var entries = [
      ConPawsWatchEntry(date: now, snapshot: snapshot, relevance: relevance(at: now))
    ]
    if let target = projection.countdownTarget, let zone = projection.timeZone {
      // Current panels show the chosen leave clock, not a synthetic walking
      // countdown, so only the actual leave boundary needs another entry.
      let points = projection.usesPersonalLeaveBoundary
        ? [target]
        : ConPawsCountdown.changePoints(from: now, to: target, timeZone: zone)
      for date in points {
        entries.append(
          ConPawsWatchEntry(date: date, snapshot: snapshot, relevance: relevance(at: date))
        )
      }
    }
    if entries.count == 1 {
      entries.append(
        ConPawsWatchEntry(date: projection.nextRefresh, snapshot: snapshot, relevance: nil)
      )
    }

    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

private struct ConPawsWatchEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ConPawsWatchEntry

  private var schedule: WidgetScheduleProjection {
    WidgetScheduleProjection(snapshot: entry.snapshot, now: entry.date)
  }

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        CircularWatchWidgetView(
          schedule: schedule,
          strings: entry.strings
        )
      case .accessoryInline:
        InlineWatchWidgetView(
          schedule: schedule,
          strings: entry.strings
        )
      default:
        rectangularBody
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .environment(\.locale, entry.snapshot.locale)
    .widgetURL(ConPawsSnapshotStore.appURL(conventionID: schedule.convention?.id))
  }

  @ViewBuilder
  private var rectangularBody: some View {
    switch schedule.state {
    case let .comingUp(convention):
      ComingUpWidgetView(
        convention: convention,
        now: entry.date,
        strings: entry.strings
      )
    case let .current(current, next, convention):
      CurrentWidgetView(
        current: current,
        next: next,
        convention: convention,
        now: entry.date,
        strings: entry.strings
      )
    case let .next(event, convention):
      NextWidgetView(
        event: event,
        convention: convention,
        now: entry.date,
        strings: entry.strings
      )
    case let .blank(convention):
      BlankWidgetView(convention: convention, strings: entry.strings)
    }
  }
}

private struct CircularWatchWidgetView: View {
  @Environment(\.locale) private var locale
  let schedule: WidgetScheduleProjection
  let strings: ConPawsStrings

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      switch schedule.state {
      case let .comingUp(convention):
        VStack(spacing: 1) {
          Image(systemName: "calendar")
            .font(.caption2)
          Text(
            ConPawsCountdown.label(
              from: schedule.now,
              to: convention.startDate,
              timeZone: convention.timeZone,
              strings: strings
            )
          )
          .font(.caption2.bold())
          .minimumScaleFactor(0.55)
          .lineLimit(1)
        }
      case let .current(event, _, _):
        if event.hasPersonalEnd, let end = event.plannedEndDate {
          VStack(spacing: 0) {
            Text(strings.leaveInCaps)
              .font(.system(size: 8, weight: .semibold))
              .lineLimit(1)
            Text(
              timerInterval: schedule.now...end,
              countsDown: true,
              showsHours: false
            )
              .font(.headline.bold())
              .monospacedDigit()
              .minimumScaleFactor(0.7)
              .lineLimit(1)
          }
          .foregroundStyle(Color.accentColor)
          .widgetAccentable()
        } else {
          VStack(spacing: 1) {
            Text(strings.nowCaps)
              .font(.caption2.bold())
            Text(event.title)
              .font(.caption2)
              .lineLimit(2)
              .multilineTextAlignment(.center)
          }
        }
      case let .next(event, convention):
        VStack(spacing: 1) {
          Text(strings.nextCaps)
            .font(.system(size: 8, weight: .semibold))
          Text(WidgetFormat.time(event.startDate, in: convention, locale: locale))
            .font(.headline)
            .monospacedDigit()
          Text(event.title)
            .font(.system(size: 8))
            .lineLimit(1)
        }
      case .blank:
        VStack(spacing: 2) {
          Image(systemName: "iphone")
          Text("ConPaws")
            .font(.caption2.bold())
        }
      }
    }
    .accessibilityElement(children: .combine)
  }
}

private struct InlineWatchWidgetView: View {
  @Environment(\.locale) private var locale
  let schedule: WidgetScheduleProjection
  let strings: ConPawsStrings

  var body: some View {
    Text(summary)
      .lineLimit(1)
  }

  private var summary: String {
    switch schedule.state {
    case let .comingUp(convention):
      return "\(convention.name) · \(ConPawsCountdown.label(from: schedule.now, to: convention.startDate, timeZone: convention.timeZone, strings: strings))"
    case let .current(current, next, convention):
      if current.hasPersonalEnd, let end = current.plannedEndDate {
        let leave = strings.text(
          strings.inlineLeaveFormat,
          WidgetFormat.time(end, in: convention, locale: locale)
        )
        if let next, let location = WidgetFormat.location(next) {
          return "\(leave) · \(location)"
        }
        return "\(leave) · \(current.title)"
      }
      return "\(strings.now) · \(current.title)"
    case let .next(event, convention):
      return "\(WidgetFormat.time(event.startDate, in: convention, locale: locale)) · \(event.title)"
    case let .blank(convention):
      guard let convention else { return strings.noScheduleMessage }
      return convention.events.isEmpty ? strings.starHint : strings.allDoneTitle
    }
  }
}

/// Mark + one line of context: the complication's shared first line, matching
/// the iPhone Lock Screen rectangular grammar. The walk symbol takes the
/// mark's place in the leave window -- the only other glyph these families use.
private struct WatchEyebrow: View {
  let title: String
  var symbol: String?

  var body: some View {
    HStack(spacing: 4) {
      if let symbol {
        Image(systemName: symbol)
          .font(.caption2.bold())
          .accessibilityHidden(true)
      } else {
        ConPawsMark(size: 11)
      }
      Text(title)
        .lineLimit(1)
    }
    .font(.caption2.bold())
    .foregroundStyle(Color.accentColor)
    .widgetAccentable()
  }
}

private struct ComingUpWidgetView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      WatchEyebrow(title: convention.name)
      WidgetCountdownView(
        target: convention.startDate,
        now: now,
        timeZone: convention.timeZone,
        strings: strings
      )
      .font(.headline)
      .monospacedDigit()
      Text(
        convention.dateRangeLabel.isEmpty ? strings.comingUpTitle : convention.dateRangeLabel
      )
      .font(.caption2)
      .foregroundStyle(.secondary)
      .lineLimit(1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      strings.text(
        strings.comingUpA11yFormat,
        convention.name,
        strings.remaining(
          WidgetFormat.countdownDuration(
            from: now,
            to: convention.startDate,
            in: convention.timeZone,
            strings: strings
          )
        )
      )
    )
  }
}

private struct CurrentWidgetView: View {
  @Environment(\.locale) private var locale
  let current: ConPawsEventSnapshot
  let next: ConPawsEventSnapshot?
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      if let end = current.endDate, current.hasPersonalEnd {
        WatchEyebrow(
          title: strings.text(
            strings.inlineLeaveFormat,
            WidgetFormat.time(end, in: convention, locale: locale)
          ),
          symbol: "figure.walk"
        )
      } else {
        WatchEyebrow(title: convention.name)
      }

      Text("\(strings.now) · \(current.title)")
        .font(.headline)
        .lineLimit(1)

      if let next {
        Text("\(strings.nextCaps) · \(next.title) · \(nextTime(next))")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else if let location = WidgetFormat.location(current) {
        Text(location)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text(convention.name)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .accessibilityElement(children: .combine)
  }

  private func nextTime(_ event: ConPawsEventSnapshot) -> String {
    WidgetFormat.nextEventTime(
      event.startDate,
      relativeTo: now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }

}

private struct NextWidgetView: View {
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      WatchEyebrow(title: convention.name)

      Text(event.title)
        .font(.headline)
        .lineLimit(1)

      if let location = WidgetFormat.location(event) {
        Text("\(startTime) · \(location)")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text(startTime)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilitySummary)
  }

  private var startTime: String {
    WidgetFormat.nextEventTime(
      event.startDate,
      relativeTo: now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }

  private var accessibilitySummary: String {
    let summary = strings.text(strings.nextEventA11yFormat, event.title, startTime)
    guard let location = WidgetFormat.location(event) else { return "\(summary)." }
    return "\(summary), \(location)."
  }
}

private struct BlankWidgetView: View {
  let convention: ConPawsConventionSnapshot?
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      WatchEyebrow(title: convention?.name ?? "ConPaws")
      Text(
        convention == nil
          ? strings.noScheduleMessage
          : convention?.events.isEmpty == true
            ? strings.starHint
            : strings.allDoneTitle
      )
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct WidgetCountdownView: View {
  let target: Date
  let now: Date
  let timeZone: TimeZone
  let strings: ConPawsStrings

  var body: some View {
    Text(ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings))
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }
}

struct ConPawsWatchWidget: Widget {
  static let kind = ConPawsWidgetKind.watchComplication

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: ConPawsWatchProvider()) { entry in
      if #available(iOS 17.0, watchOS 10.0, *) {
        ConPawsWatchEntryView(entry: entry)
          .containerBackground(Color.black, for: .widget)
      } else {
        ConPawsWatchEntryView(entry: entry)
          .background(Color.black)
      }
    }
    // System-drawn, like the iPhone widget's gallery entry: the Smart Stack
    // resolves these against the watch's language, not the app's, so they need
    // resources rather than the shared string table.
    .configurationDisplayName("ConPaws Schedule")
    .description("See your current stop, chosen leave time, next event, or convention countdown.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}

private struct WidgetScheduleProjection {
  enum State {
    case comingUp(ConPawsConventionSnapshot)
    case current(ConPawsEventSnapshot, ConPawsEventSnapshot?, ConPawsConventionSnapshot)
    case next(ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case blank(ConPawsConventionSnapshot?)
  }

  let now: Date
  let convention: ConPawsConventionSnapshot?
  let activeEvent: ConPawsEventSnapshot?
  let activeEventEnd: Date?
  let nextEvent: ConPawsEventSnapshot?

  var state: State {
    guard let convention else { return .blank(nil) }
    if now < convention.startDate { return .comingUp(convention) }
    if let activeEvent { return .current(activeEvent, nextEvent, convention) }
    guard let nextEvent else { return .blank(convention) }
    return .next(nextEvent, convention)
  }

  /// The convention's zone, so day wording matches where the event happens.
  var timeZone: TimeZone? { convention?.timeZone }

  /// The date this widget is currently counting down to, if any.
  ///
  /// Only the two states that render a countdown report one. `next` shows a
  /// clock time, so it has nothing that changes wording minute to minute.
  var countdownTarget: Date? {
    switch state {
    case .comingUp(let convention): return convention.startDate
    case .current(let current, _, _):
      guard
        current.hasPersonalEnd,
        let end = current.endDate,
        end.timeIntervalSince(now) <= 30 * 60
      else { return nil }
      return end
    case .next, .blank: return nil
    }
  }

  /// A chosen leave time needs one exact transition entry; the view displays
  /// the saved clock time rather than inventing a walking countdown.
  var usesPersonalLeaveBoundary: Bool {
    if case .current(let current, _, _) = state {
      return current.hasPersonalEnd
    }
    return false
  }

  var nextRefresh: Date {
    guard let convention else { return now.addingTimeInterval(21_600) }

    if now < convention.startDate {
      let remaining = convention.startDate.timeIntervalSince(now)
      let cadence = remaining >= 30 * 86_400 ? 86_400 : remaining >= 86_400 ? 3_600 : remaining
      return max(now.addingTimeInterval(60), min(convention.startDate, now.addingTimeInterval(cadence)))
    }

    let candidates = [
      nextEvent?.startDate,
      activeEventEnd,
      convention.endDate,
    ].compactMap { $0 }.filter { $0 > now.addingTimeInterval(1) }
    return candidates.min() ?? now.addingTimeInterval(21_600)
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    self.now = now
    let selected = snapshot.conventions
      .filter { $0.isCurrentOrUpcoming(at: now) }
      .sorted { $0.startAtMs < $1.startAtMs }
      .first
    convention = selected

    guard let selected else {
      activeEvent = nil
      activeEventEnd = nil
      nextEvent = nil
      return
    }

    let plan = ConPawsPlanTimeline(events: selected.events, now: now)
    activeEvent = plan.currentEvent
    activeEventEnd = plan.currentEventEnd
    nextEvent = plan.nextEvent
  }
}

private enum WidgetFormat {
  static func time(
    _ date: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.timeZone = convention.timeZone
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }

  static func nextEventTime(
    _ date: Date,
    relativeTo now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = convention.timeZone
    let timeLabel = time(date, in: convention, locale: locale)
    guard !calendar.isDate(date, inSameDayAs: now) else { return timeLabel }

    if
      let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)),
      calendar.isDate(date, inSameDayAs: tomorrow)
    {
      return "\(strings.tomorrow) · \(timeLabel)"
    }

    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.timeZone = convention.timeZone
    formatter.setLocalizedDateFormatFromTemplate("EEEE")
    return "\(formatter.string(from: date)) · \(timeLabel)"
  }

  static func location(_ event: ConPawsEventSnapshot) -> String? {
    let values = [event.room, event.location]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    if values.count == 2, values[0] == values[1] { return values[0] }
    return values.isEmpty ? nil : values.joined(separator: " • ")
  }

  /// How long the wait is, spoken as two units.
  ///
  /// Deliberately without "remaining" or its equivalents: the caller decides
  /// whether the duration stands alone or sits inside a longer sentence, and
  /// several languages phrase "remaining" as a prefix rather than a suffix.
  static func countdownDuration(
    from now: Date,
    to target: Date,
    in timeZone: TimeZone,
    strings: ConPawsStrings
  ) -> String {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = timeZone
    let parts = calendar.dateComponents([.month, .day, .hour, .minute], from: now, to: target)
    let months = max(0, parts.month ?? 0)
    let days = max(0, parts.day ?? 0)
    let hours = max(0, parts.hour ?? 0)
    let minutes = max(0, parts.minute ?? 0)

    if target.timeIntervalSince(now) >= 30 * 86_400 {
      return strings.duration(strings.months(months), strings.days(days))
    }
    if target.timeIntervalSince(now) >= 86_400 {
      return strings.duration(strings.days(days), strings.hours(hours))
    }
    return strings.duration(strings.hours(hours), strings.minutes(minutes))
  }
}

private extension ConPawsConventionSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date { Date(timeIntervalSince1970: endAtMs / 1_000) }
  var timeZone: TimeZone { TimeZone(identifier: timeZoneIdentifier) ?? .autoupdatingCurrent }
}

private extension ConPawsEventSnapshot {
  var startDate: Date { plannedStartDate }
  var endDate: Date? { plannedEndDate }
}
