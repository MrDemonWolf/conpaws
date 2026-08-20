import Foundation
import SwiftUI
import WidgetKit

private struct ConPawsWatchEntry: TimelineEntry {
  let date: Date
  let snapshot: ConPawsSnapshot

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
          reminderMinutes: nil
        ),
        ConPawsEventSnapshot(
          id: "preview-next",
          title: "Fursuit Meetup",
          startAtMs: now.addingTimeInterval(1_200).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(4_800).timeIntervalSince1970 * 1_000,
          location: "Convention Center",
          room: "Hall A",
          reminderMinutes: 30
        ),
      ]
    )
    return ConPawsWatchEntry(
      date: now,
      snapshot: ConPawsSnapshot(
        schemaVersion: 1,
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
      : ConPawsWatchEntry(date: .now, snapshot: cached))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<ConPawsWatchEntry>) -> Void
  ) {
    #if DEBUG
    let preview = ConPawsWatchEntry.preview
    if case .leave = WidgetScheduleProjection(snapshot: preview.snapshot, now: preview.date).state {
      // Expected preview state.
    } else {
      assertionFailure("The Watch widget preview must cover the leave state")
    }
    if let convention = preview.snapshot.conventions.first {
      assert(
        WidgetFormat.nextEventTime(
          preview.date.addingTimeInterval(86_400),
          relativeTo: preview.date,
          in: convention
        ).hasPrefix("Tomorrow · ")
      )
    }
    #endif

    let now = Date()
    let snapshot = ConPawsSnapshotStore.load()
    let next = WidgetScheduleProjection(snapshot: snapshot, now: now).nextRefresh
    let entries = [
      ConPawsWatchEntry(date: now, snapshot: snapshot),
      ConPawsWatchEntry(date: next, snapshot: snapshot),
    ]
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

private struct ConPawsWatchEntryView: View {
  let entry: ConPawsWatchEntry

  private var schedule: WidgetScheduleProjection {
    WidgetScheduleProjection(snapshot: entry.snapshot, now: entry.date)
  }

  var body: some View {
    Group {
      switch schedule.state {
      case let .comingUp(convention):
        ComingUpWidgetView(convention: convention, now: entry.date)
      case let .leave(current, next, convention):
        LeaveWidgetView(
          current: current,
          next: next,
          convention: convention,
          now: entry.date
        )
      case let .next(event, convention):
        NextWidgetView(event: event, convention: convention, now: entry.date)
      case let .blank(convention):
        BlankWidgetView(convention: convention)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct ComingUpWidgetView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Label("COMING UP", systemImage: "calendar.badge.clock")
        .font(.caption2.bold())
        .foregroundStyle(.cyan)
        .widgetAccentable()
      WidgetCountdownView(target: convention.startDate, now: now, timeZone: convention.timeZone)
        .font(.headline)
        .monospacedDigit()
      Text(convention.name)
        .font(.caption2)
        .lineLimit(1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "Coming up, \(convention.name), \(WidgetFormat.countdownAccessibility(from: now, to: convention.startDate, in: convention.timeZone))"
    )
  }
}

private struct LeaveWidgetView: View {
  let current: ConPawsEventSnapshot?
  let next: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: "clock")
          .accessibilityHidden(true)
        Text("LEAVE IN")
        WidgetCountdownView(target: next.startDate, now: now, timeZone: convention.timeZone)
          .monospacedDigit()
      }
      .font(.caption.bold())
      .foregroundStyle(.cyan)
      .widgetAccentable()

      if let current {
        Text("NOW · \(current.title)")
          .font(.caption2)
          .lineLimit(1)
      } else {
        Text("FOR")
          .font(.caption2.bold())
          .foregroundStyle(.secondary)
      }

      Text(
        "NEXT · \(WidgetFormat.nextEventTime(next.startDate, relativeTo: now, in: convention)) · \(next.title)"
      )
        .font(.caption2)
        .lineLimit(1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(accessibilitySummary)
  }

  private var accessibilitySummary: String {
    let countdown = WidgetFormat.countdownAccessibility(
      from: now,
      to: next.startDate,
      in: convention.timeZone
    )
    if let current {
      return "Leave in \(countdown). Current event: \(current.title). Next event: \(next.title), starts \(WidgetFormat.nextEventTime(next.startDate, relativeTo: now, in: convention))."
    }
    return "Leave in \(countdown) for \(next.title), starts \(WidgetFormat.nextEventTime(next.startDate, relativeTo: now, in: convention))."
  }
}

private struct NextWidgetView: View {
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 4) {
        Image(systemName: "calendar")
          .accessibilityHidden(true)
        Text(
          "NEXT · \(WidgetFormat.nextEventTime(event.startDate, relativeTo: now, in: convention))"
        )
      }
      .font(.caption2.bold())
      .foregroundStyle(.cyan)
      .widgetAccentable()

      Text(event.title)
        .font(.headline)
        .lineLimit(1)

      if let location = WidgetFormat.location(event) {
        Text(location)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "Next event: \(event.title), starts \(WidgetFormat.nextEventTime(event.startDate, relativeTo: now, in: convention))\(WidgetFormat.location(event).map { ", \($0)" } ?? "")."
    )
  }
}

private struct BlankWidgetView: View {
  let convention: ConPawsConventionSnapshot?

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Label("No upcoming events", systemImage: "calendar")
        .font(.caption.bold())
        .foregroundStyle(.cyan)
        .widgetAccentable()
      Text(convention?.name ?? "Sync a convention from iPhone")
        .font(.caption2)
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

  var body: some View {
    if target.timeIntervalSince(now) < 86_400, target > now {
      Text(timerInterval: now...target, countsDown: true)
    } else {
      Text(WidgetFormat.countdown(from: now, to: target, in: timeZone))
    }
  }
}

struct ConPawsWatchWidget: Widget {
  static let kind = "ConPawsWatchWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: ConPawsWatchProvider()) { entry in
      ConPawsWatchEntryView(entry: entry)
        .containerBackground(Color.black, for: .widget)
    }
    .configurationDisplayName("ConPaws Schedule")
    .description("See your next event, leave reminder, or convention countdown.")
    .supportedFamilies([.accessoryRectangular])
  }
}

private struct WidgetScheduleProjection {
  enum State {
    case comingUp(ConPawsConventionSnapshot)
    case leave(ConPawsEventSnapshot?, ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case next(ConPawsEventSnapshot, ConPawsConventionSnapshot)
    case blank(ConPawsConventionSnapshot?)
  }

  let now: Date
  let convention: ConPawsConventionSnapshot?
  let activeEvent: ConPawsEventSnapshot?
  let activeEventEnd: Date?
  let nextEvent: ConPawsEventSnapshot?
  let leaveDate: Date?

  var state: State {
    guard let convention else { return .blank(nil) }
    if now < convention.startDate { return .comingUp(convention) }
    guard let nextEvent else { return .blank(convention) }
    if let leaveDate, leaveDate <= now, now < nextEvent.startDate {
      return .leave(activeEvent, nextEvent, convention)
    }
    return .next(nextEvent, convention)
  }

  var nextRefresh: Date {
    guard let convention else { return now.addingTimeInterval(21_600) }

    if now < convention.startDate {
      let remaining = convention.startDate.timeIntervalSince(now)
      let cadence = remaining >= 30 * 86_400 ? 86_400 : remaining >= 86_400 ? 3_600 : remaining
      return max(now.addingTimeInterval(60), min(convention.startDate, now.addingTimeInterval(cadence)))
    }

    let candidates = [
      leaveDate,
      nextEvent?.startDate,
      activeEventEnd,
      convention.endDate,
    ].compactMap { $0 }.filter { $0 > now.addingTimeInterval(1) }
    return candidates.min() ?? now.addingTimeInterval(21_600)
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    self.now = now
    let selected = snapshot.conventions
      .filter { $0.endDate >= now || $0.events.contains { $0.startDate >= now } }
      .sorted { $0.startAtMs < $1.startAtMs }
      .first
    convention = selected

    guard let selected else {
      activeEvent = nil
      activeEventEnd = nil
      nextEvent = nil
      leaveDate = nil
      return
    }

    let events = selected.events.sorted { $0.startAtMs < $1.startAtMs }
    let active = events.enumerated().compactMap { index, event -> (ConPawsEventSnapshot, Date)? in
      guard event.startDate <= now else { return nil }
      let nextStart = events.indices.contains(index + 1) ? events[index + 1].startDate : nil
      let fallbackEnd = min(nextStart ?? .distantFuture, event.startDate.addingTimeInterval(3_600))
      let end = event.endDate ?? fallbackEnd
      return now < end ? (event, end) : nil
    }.last
    activeEvent = active?.0
    activeEventEnd = active?.1

    let next = events.first { $0.startDate > now }
    nextEvent = next
    if let next, let minutes = next.reminderMinutes {
      leaveDate = next.startDate.addingTimeInterval(-Double(minutes) * 60)
    } else {
      leaveDate = nil
    }
  }
}

private enum WidgetFormat {
  static func time(_ date: Date, in convention: ConPawsConventionSnapshot) -> String {
    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
    formatter.timeZone = convention.timeZone
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }

  static func nextEventTime(
    _ date: Date,
    relativeTo now: Date,
    in convention: ConPawsConventionSnapshot
  ) -> String {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = convention.timeZone
    let timeLabel = time(date, in: convention)
    guard !calendar.isDate(date, inSameDayAs: now) else { return timeLabel }

    if
      let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)),
      calendar.isDate(date, inSameDayAs: tomorrow)
    {
      return "Tomorrow · \(timeLabel)"
    }

    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
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

  static func countdown(from now: Date, to target: Date, in timeZone: TimeZone) -> String {
    let seconds = max(0, target.timeIntervalSince(now))
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = timeZone

    if seconds >= 30 * 86_400 {
      let parts = calendar.dateComponents([.month, .day], from: now, to: target)
      return "\(max(0, parts.month ?? 0)) MO  \(max(0, parts.day ?? 0)) D"
    }

    let parts = calendar.dateComponents([.day, .hour], from: now, to: target)
    return "\(max(0, parts.day ?? 0)) D  \(max(0, parts.hour ?? 0)) H"
  }

  static func countdownAccessibility(
    from now: Date,
    to target: Date,
    in timeZone: TimeZone
  ) -> String {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = timeZone
    let parts = calendar.dateComponents([.month, .day, .hour, .minute], from: now, to: target)
    if target.timeIntervalSince(now) >= 30 * 86_400 {
      return "\(max(0, parts.month ?? 0)) months, \(max(0, parts.day ?? 0)) days remaining"
    }
    if target.timeIntervalSince(now) >= 86_400 {
      return "\(max(0, parts.day ?? 0)) days, \(max(0, parts.hour ?? 0)) hours remaining"
    }
    return "\(max(0, parts.hour ?? 0)) hours, \(max(0, parts.minute ?? 0)) minutes remaining"
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
