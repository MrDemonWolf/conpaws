import Foundation
import SwiftUI
import WidgetKit

private struct ConPawsWatchEntry: TimelineEntry {
  let date: Date
  let snapshot: ConPawsSnapshot
  /// Raises this card in the Smart Stack around the moments it matters —
  /// event starts and leave windows. Without a relevance the stack never
  /// surfaces the complication on its own.
  var relevance: TimelineEntryRelevance?

  /// The app's language, not the watch's. The snapshot carries it precisely so
  /// this complication reads the same way the phone screen it mirrors does.
  var strings: ConPawsStrings { snapshot.strings }

  var isStale: Bool {
    !snapshot.conventions.isEmpty
      && ConPawsSnapshotAge.isStale(generatedAtMs: snapshot.generatedAtMs, now: date)
  }

  var staleAccessibilityHint: String {
    guard isStale else { return "" }
    return strings.text(strings.staleA11yFormat, relativeUpdatedText)
  }

  var relativeUpdatedText: String {
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = snapshot.locale
    formatter.unitsStyle = .short
    return formatter.localizedString(
      for: Date(timeIntervalSince1970: snapshot.generatedAtMs / 1_000),
      relativeTo: date
    )
  }

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
    // Within 30 minutes of the countdown target (an event start or a leave
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
      // The leave countdown reads in whole minutes, so it ticks per minute;
      // every other countdown rides the shared hourly ladder.
      let points = projection.isLeaveState
        ? ConPawsCountdown.leaveChangePoints(from: now, to: target)
        : ConPawsCountdown.changePoints(from: now, to: target, timeZone: zone)
      for date in points {
        entries.append(
          ConPawsWatchEntry(date: date, snapshot: snapshot, relevance: relevance(at: date))
        )
      }
    }
    if let staleBoundary = projection.staleBoundary,
      !entries.contains(where: { $0.date == staleBoundary })
    {
      entries.append(ConPawsWatchEntry(date: staleBoundary, snapshot: snapshot, relevance: nil))
    }
    if entries.count == 1 {
      entries.append(
        ConPawsWatchEntry(date: projection.nextRefresh, snapshot: snapshot, relevance: nil)
      )
    }

    entries.sort { $0.date < $1.date }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

private struct ConPawsWatchEntryView: View {
  let entry: ConPawsWatchEntry

  private var schedule: WidgetScheduleProjection {
    WidgetScheduleProjection(snapshot: entry.snapshot, now: entry.date)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Group {
        switch schedule.state {
      case let .comingUp(convention):
        ComingUpWidgetView(
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .leave(current, next, convention):
        LeaveWidgetView(
          current: current,
          next: next,
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .next(current, event, convention):
        NextWidgetView(
          current: current,
          event: event,
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .current(event, convention):
        let until = WidgetFormat.time(
          ConPawsScheduleResolver.effectiveEnd(of: event),
          in: convention,
          locale: entry.snapshot.locale
        )
        VStack(alignment: .leading, spacing: 2) {
          WatchEyebrow(title: "\(entry.strings.happeningNowCaps) · \(entry.strings.text(entry.strings.untilCapsFormat, until))")
          Text(event.title).font(.headline).lineLimit(2)
          Text(entry.strings.noLaterSavedEventsShort).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
      case .finished:
        StatusWidgetView(title: entry.strings.finishedComplication, detail: entry.strings.finishedTitle)
      case .noPicks:
        StatusWidgetView(title: entry.strings.noPicksComplication, detail: entry.strings.noPicksTitle)
      case .noConvention:
        StatusWidgetView(title: entry.strings.noConventionComplication, detail: entry.strings.openOnIphone)
        }
      }
      if entry.isStale {
        Text(entry.strings.text(entry.strings.lastUpdatedFormat, entry.relativeUpdatedText))
          .font(.caption2)
          .lineLimit(1)
        Text("\(entry.strings.staleHintShort) · \(entry.strings.openOnIphone)")
          .font(.caption2)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .environment(\.locale, entry.snapshot.locale)
    .accessibilityHint(Text(entry.staleAccessibilityHint))
  }
}

/// Mark + one line of context: the complication's shared first line, matching
/// the iPhone Lock Screen rectangular grammar. A reminder uses a bell in place
/// of the brand mark.
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

private struct LeaveWidgetView: View {
  @Environment(\.locale) private var locale
  let current: ConPawsEventSnapshot?
  let next: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(
        title: ConPawsCountdown.leaveLead(
          from: now,
          to: next.startDate,
          timeZone: convention.timeZone,
          strings: strings
        ),
        symbol: "bell"
      )
      .monospacedDigit()

      if let current {
        Text(current.title).font(.caption2).lineLimit(1)
        Text("\(strings.upNextCaps) · \(next.title)").font(.headline).lineLimit(1)
      } else {
        Text(next.title).font(.headline).lineLimit(1)
      }

      if let location = WidgetFormat.location(next) {
        Text("\(nextTime) · \(location)")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      } else {
        Text(nextTime)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      if let reminder = WidgetFormat.reminderAt(next, in: convention, locale: locale, strings: strings) {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilitySummary)
  }

  private var nextTime: String {
    WidgetFormat.nextEventTime(
      next.startDate,
      relativeTo: now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }

  private var accessibilitySummary: String {
    let countdown = WidgetFormat.countdownDuration(
      from: now,
      to: next.startDate,
      in: convention.timeZone,
      strings: strings
    )
    let summary: String
    if let current {
      summary = strings.text(
        strings.startsWithCurrentA11yFormat,
        countdown,
        current.title,
        next.title,
        nextTime
      )
    } else {
      summary = strings.text(strings.startsA11yFormat, countdown, next.title, nextTime)
    }
    let reminder = WidgetFormat.reminderAt(next, in: convention, locale: locale, strings: strings)
      .map { ". \($0)" } ?? ""
    return summary + reminder
  }
}

private struct NextWidgetView: View {
  @Environment(\.locale) private var locale
  let current: ConPawsEventSnapshot?
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let current {
        WatchEyebrow(title: strings.happeningNowCaps)
        Text(current.title).font(.headline).lineLimit(1)
        Text("\(strings.upNextCaps) · \(event.title)").font(.caption2).lineLimit(1)
      } else {
        WatchEyebrow(title: strings.upNextCaps)
        Text(event.title).font(.headline).lineLimit(1)
      }

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
      if let reminder = WidgetFormat.reminderAt(event, in: convention, locale: locale, strings: strings) {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
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
    let next = strings.text(strings.nextEventA11yFormat, event.title, startTime)
    let currentText = current.map { "\(strings.happeningNowCaps), \($0.title). " } ?? ""
    let place = WidgetFormat.location(event).map { ", \($0)" } ?? ""
    let reminder = WidgetFormat.reminderAt(event, in: convention, locale: locale, strings: strings)
      .map { ". \($0)" } ?? ""
    return "\(currentText)\(next)\(place)\(reminder)."
  }
}

private struct StatusWidgetView: View {
  let title: String
  let detail: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      WatchEyebrow(title: title)
      Text(detail)
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
      ConPawsWatchEntryView(entry: entry)
        .containerBackground(Color.black, for: .widget)
    }
    // System-drawn, like the iPhone widget's gallery entry: the Smart Stack
    // resolves these against the watch's language, not the app's, so they need
    // resources rather than the shared string table.
    .configurationDisplayName("ConPaws Schedule")
    .description("See your next event, schedule reminder, or convention countdown.")
    .supportedFamilies([.accessoryRectangular])
  }
}

private struct WidgetScheduleProjection {
  enum State {
    case comingUp(ConPawsConventionSnapshot)
    case leave(ConPawsEventSnapshot?, ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case next(ConPawsEventSnapshot?, ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case current(ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case finished(ConPawsConventionSnapshot)
    case noPicks(ConPawsConventionSnapshot)
    case noConvention
  }

  let now: Date
  let resolved: ConPawsScheduleState
  let generatedAtMs: Double
  let hasConventions: Bool

  var convention: ConPawsConventionSnapshot? {
    switch resolved {
    case .noConvention: nil
    case .countdown(let value), .finished(let value), .noPicks(let value): value
    case .next(let value, _, _), .currentOnly(let value, _): value
    }
  }

  var activeEvent: ConPawsEventSnapshot? {
    switch resolved {
    case .next(_, let current, _): current
    case .currentOnly(_, let event): event
    case .noConvention, .countdown, .finished, .noPicks: nil
    }
  }

  var nextEvent: ConPawsEventSnapshot? {
    if case .next(_, _, let upcoming) = resolved { return upcoming }
    return nil
  }

  var state: State {
    switch resolved {
    case .noConvention:
      .noConvention
    case .countdown(let convention):
      .comingUp(convention)
    case .next(let convention, let current, let upcoming):
      ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now)
        ? .leave(current, upcoming, convention)
        : .next(current, upcoming, convention)
    case .currentOnly(let convention, let event):
      .current(event, convention)
    case .finished(let convention):
      .finished(convention)
    case .noPicks(let convention):
      .noPicks(convention)
    }
  }

  var timeZone: TimeZone? { convention?.timeZone }

  var countdownTarget: Date? {
    switch state {
    case .comingUp(let convention): convention.startDate
    case .leave(_, let upcoming, _): upcoming.startDate
    case .next, .current, .finished, .noPicks, .noConvention: nil
    }
  }

  var isLeaveState: Bool {
    if case .leave = state { return true }
    return false
  }

  var staleBoundary: Date? {
    guard hasConventions, !ConPawsSnapshotAge.isStale(generatedAtMs: generatedAtMs, now: now) else {
      return nil
    }
    let date = Date(timeIntervalSince1970: generatedAtMs / 1_000)
      .addingTimeInterval(ConPawsSnapshotAge.staleAfter)
    return date > now ? date : nil
  }

  var nextRefresh: Date {
    var candidates: [Date] = []
    switch state {
    case .comingUp(let convention):
      let remaining = convention.startDate.timeIntervalSince(now)
      candidates.append(convention.startDate)
      if remaining >= 30 * 86_400 {
        var calendar = Calendar.autoupdatingCurrent
        calendar.timeZone = convention.timeZone
        if let midnight = calendar.nextDate(
          after: now,
          matching: DateComponents(hour: 0, minute: 0, second: 0),
          matchingPolicy: .nextTime
        ) {
          candidates.append(midnight)
        }
      } else if remaining >= 86_400 {
        candidates.append(now.addingTimeInterval(3_600))
      }
    case .leave(let current, let upcoming, let convention),
      .next(let current, let upcoming, let convention):
      candidates.append(upcoming.startDate)
      candidates.append(convention.endDate)
      if let current { candidates.append(ConPawsScheduleResolver.effectiveEnd(of: current)) }
      if let minutes = upcoming.reminderMinutes, minutes > 0 {
        candidates.append(upcoming.startDate.addingTimeInterval(-Double(minutes) * 60))
      }
    case .current(let event, let convention):
      candidates.append(ConPawsScheduleResolver.effectiveEnd(of: event))
      candidates.append(convention.endDate)
    case .finished(let convention), .noPicks(let convention):
      candidates.append(convention.endDate)
    case .noConvention:
      break
    }
    return candidates.filter { $0 > now.addingTimeInterval(1) }.min()
      ?? now.addingTimeInterval(21_600)
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    self.now = now
    generatedAtMs = snapshot.generatedAtMs
    hasConventions = !snapshot.conventions.isEmpty
    resolved = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
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

  /// "Reminder at 2:35 PM · 10 min before", from the offset the user chose.
  static func reminderAt(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    guard let minutes = event.reminderMinutes, minutes >= 0 else { return nil }
    let reminderDate = event.startDate.addingTimeInterval(-Double(minutes) * 60)
    return strings.reminderAt(time(reminderDate, in: convention, locale: locale), minutes: minutes)
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
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date? { endAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) } }
}
