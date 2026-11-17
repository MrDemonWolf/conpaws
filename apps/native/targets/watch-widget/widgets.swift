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

  /// The stale sentence VoiceOver appends to every state's label, or nil
  /// while the data is fresh. Visually, staleness is one symbol in the
  /// eyebrow: the two lines it used to add overflowed a three-line card.
  var staleNotice: String? {
    guard isStale else { return nil }
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

  var body: some View {
    let schedule = WidgetScheduleProjection(snapshot: entry.snapshot, now: entry.date)
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
        CurrentWidgetView(event: event, convention: convention, strings: entry.strings)
      case .finished:
        StatusWidgetView(title: entry.strings.finishedComplication, detail: entry.strings.finishedTitle)
      case .noPicks:
        StatusWidgetView(title: entry.strings.noPicksComplication, detail: entry.strings.noPicksTitle)
      case .noConvention:
        StatusWidgetView(title: entry.strings.noConventionComplication, detail: entry.strings.openOnIphone)
      }
    }
    // Every state is at most three lines, pinned to the top: centered, an
    // overflowing card clipped its eyebrow, which is the line carrying the
    // countdown.
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .environment(\.locale, entry.snapshot.locale)
    .environment(\.staleNotice, entry.staleNotice)
  }
}

private extension EnvironmentValues {
  /// The complication's stale sentence, or nil while the data is fresh. The
  /// eyebrow draws a symbol for it and each state appends it to its label.
  @Entry var staleNotice: String? = nil
}

/// A state's VoiceOver summary with the stale sentence after it.
private func spokenSummary(_ summary: String, stale: String?) -> String {
  guard let stale else { return summary }
  let endsSentence = summary.last.map { ".。!?！？".contains($0) } ?? true
  return endsSentence ? "\(summary) \(stale)" : "\(summary). \(stale)"
}

/// Mark + one line of context: the complication's shared first line, matching
/// the iPhone Lock Screen rectangular grammar. A reminder uses a bell in place
/// of the brand mark. A stale plan adds a trailing symbol rather than lines.
private struct WatchEyebrow: View {
  @Environment(\.staleNotice) private var staleNotice
  let title: String
  var symbol: String?

  var body: some View {
    HStack(spacing: 4) {
      if let symbol {
        Image(systemName: symbol)
          .font(.caption2.bold())
          .accessibilityHidden(true)
      } else {
        // 16 pt: the compass ring blurs below that.
        ConPawsMark(size: 16)
      }
      Text(title)
        .lineLimit(1)
      if staleNotice != nil {
        Spacer(minLength: 2)
        Image(systemName: "exclamationmark.arrow.circlepath")
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .font(.caption2.bold())
    .foregroundStyle(Color.accentColor)
    .widgetAccentable()
  }
}

/// "2:00 PM · Hall A" as two Text views, so the room can be privacy-sensitive
/// on its own: wrist-down the watch face hides it, like the app does, and
/// keeps the time. The time wins the width; the room truncates first.
private struct WidgetDetailLine: View {
  let time: String
  let place: String?

  var body: some View {
    HStack(spacing: 3) {
      Text(time)
        .layoutPriority(1)
      if let place {
        Text(verbatim: "·")
          .accessibilityHidden(true)
        Text(place)
          .privacySensitive()
      }
    }
    .font(.caption2)
    .foregroundStyle(.secondary)
    .lineLimit(1)
  }
}

private struct ComingUpWidgetView: View {
  @Environment(\.staleNotice) private var staleNotice
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
      spokenSummary(
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
        ),
        stale: staleNotice
      )
    )
  }
}

private struct LeaveWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let current: ConPawsEventSnapshot?
  let next: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    // Three lines: countdown, where to go, when. The running event and the
    // reminder (which has already fired by the time this state exists) are
    // spoken, not drawn.
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: lead, symbol: "bell")
        .monospacedDigit()

      Text(next.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()

      WidgetDetailLine(time: nextTime, place: next.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
  }

  private var lead: String {
    ConPawsCountdown.leaveLead(
      from: now,
      to: next.startDate,
      timeZone: convention.timeZone,
      strings: strings
    )
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
    // A redacted face must not be read aloud either: the label replaces the
    // children, so `privacySensitive` on them never reaches VoiceOver. Speak
    // only what stays drawn, the lead and the clock time.
    if redactionReasons.contains(.privacy) {
      return "\(lead), \(nextTime)."
    }
    let countdown = WidgetFormat.countdownDuration(
      from: now,
      to: next.startDate,
      in: convention.timeZone,
      strings: strings
    )
    if let current {
      return strings.text(
        strings.startsWithCurrentA11yFormat,
        countdown,
        current.title,
        next.title,
        nextTime
      )
    }
    return strings.text(strings.startsA11yFormat, countdown, next.title, nextTime)
  }
}

private struct NextWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let current: ConPawsEventSnapshot?
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    // Three lines about the next event. The running event and the pending
    // reminder are spoken, not drawn: as extra lines they pushed the card
    // past what accessoryRectangular holds.
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: strings.upNextCaps)
      Text(event.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()
      WidgetDetailLine(time: startTime, place: event.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
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
    let reminder = WidgetFormat.reminderAt(event, in: convention, locale: locale, strings: strings)
      .map { ". \($0)" } ?? ""
    // Redacted: no titles or rooms, as on screen (see LeaveWidgetView).
    if redactionReasons.contains(.privacy) {
      return "\(strings.upNextCaps), \(startTime)\(reminder)."
    }
    let next = strings.text(strings.nextEventA11yFormat, event.title, startTime)
    let currentText = current.map { "\(strings.happeningNowCaps), \($0.title). " } ?? ""
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(currentText)\(next)\(place)\(reminder)."
  }
}

private struct CurrentWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    // The time range moves down to the detail line, so the eyebrow no longer
    // truncates "HAPPENING NOW · UNTIL 10:30 AM".
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: strings.happeningNowCaps)
      Text(event.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()
      WidgetDetailLine(time: timeRange, place: event.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
  }

  private var timeRange: String {
    WidgetFormat.timeRange(event, in: convention, locale: locale)
  }

  private var accessibilitySummary: String {
    // Redacted: no title or room, as on screen (see LeaveWidgetView).
    if redactionReasons.contains(.privacy) {
      return "\(strings.happeningNowCaps), \(timeRange). \(strings.noLaterSavedEventsShort)."
    }
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(strings.happeningNowCaps), \(event.title), \(timeRange)\(place). \(strings.noLaterSavedEventsShort)."
  }
}

private struct StatusWidgetView: View {
  @Environment(\.staleNotice) private var staleNotice
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
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary("\(title), \(detail)", stale: staleNotice))
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
        // The target's own $widgetBackground, through the symbol Xcode
        // generates for it, so a renamed asset fails the build instead of
        // falling back silently.
        .containerBackground(Color(.widgetBackground), for: .widget)
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

  /// "9:00–10:30 AM", or the start alone when the end is unknown. A copy of
  /// the watch app's WatchFormat.timeRange until both share one formatter.
  static func timeRange(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> String {
    guard let end = event.endDate else {
      return time(event.startDate, in: convention, locale: locale)
    }
    return "\(time(event.startDate, in: convention, locale: locale))–\(time(end, in: convention, locale: locale))"
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
