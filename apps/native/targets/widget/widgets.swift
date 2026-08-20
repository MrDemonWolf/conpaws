import SwiftUI
import WidgetKit

private enum ConPawsWidgetState {
  case countdown(ConPawsConventionSnapshot)
  case next(ConPawsConventionSnapshot, current: ConPawsEventSnapshot?, upcoming: ConPawsEventSnapshot)
  case leave(ConPawsConventionSnapshot, current: ConPawsEventSnapshot?, upcoming: ConPawsEventSnapshot)
  case empty(ConPawsConventionSnapshot?)
}

@available(iOS 17.0, *)
struct ConPawsWidgetEntry: TimelineEntry {
  let date: Date
  let configuration: ConPawsWidgetIntent
  fileprivate let state: ConPawsWidgetState

  fileprivate var appURL: URL? {
    switch state {
    case .countdown(let convention), .next(let convention, _, _), .leave(let convention, _, _):
      ConPawsSnapshotStore.appURL(conventionID: convention.id)
    case .empty(let convention):
      ConPawsSnapshotStore.appURL(conventionID: convention?.id)
    }
  }
}

@available(iOS 17.0, *)
struct ConPawsWidgetProvider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> ConPawsWidgetEntry {
    ConPawsWidgetEntry(
      date: .now,
      configuration: ConPawsWidgetIntent(),
      state: .next(.sample, current: nil, upcoming: .sample)
    )
  }

  func snapshot(
    for configuration: ConPawsWidgetIntent,
    in context: Context
  ) async -> ConPawsWidgetEntry {
    entry(for: configuration, at: .now)
  }

  func timeline(
    for configuration: ConPawsWidgetIntent,
    in context: Context
  ) async -> Timeline<ConPawsWidgetEntry> {
    let entry = entry(for: configuration, at: .now)
    return Timeline(entries: [entry], policy: .after(nextRefresh(for: entry)))
  }

  private func entry(
    for configuration: ConPawsWidgetIntent,
    at date: Date
  ) -> ConPawsWidgetEntry {
    let snapshot = ConPawsSnapshotStore.load()
    let nowMs = date.timeIntervalSince1970 * 1_000
    let convention = configuration.convention.flatMap { selected in
      snapshot.conventions.first { $0.id == selected.id }
    } ?? snapshot.conventions
      .filter { $0.endAtMs >= nowMs }
      .min { $0.startAtMs < $1.startAtMs }

    guard let convention else {
      return ConPawsWidgetEntry(date: date, configuration: configuration, state: .empty(nil))
    }

    if date < convention.startDate, configuration.mode != .nextEvent {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        state: .countdown(convention)
      )
    }

    let events = convention.events.sorted { $0.startAtMs < $1.startAtMs }
    let current = events.enumerated().compactMap { index, event -> ConPawsEventSnapshot? in
      guard event.startDate <= date else { return nil }
      let nextStart = events.indices.contains(index + 1) ? events[index + 1].startDate : nil
      return date < effectiveEnd(for: event, nextStart: nextStart) ? event : nil
    }.last
    guard let upcoming = events.first(where: { $0.startDate > date }) else {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        state: .empty(convention)
      )
    }

    if
      let reminderMinutes = upcoming.reminderMinutes,
      reminderMinutes > 0,
      date >= upcoming.startDate.addingTimeInterval(TimeInterval(-reminderMinutes * 60))
    {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        state: .leave(convention, current: current, upcoming: upcoming)
      )
    }

    return ConPawsWidgetEntry(
      date: date,
      configuration: configuration,
      state: .next(convention, current: current, upcoming: upcoming)
    )
  }

  private func nextRefresh(for entry: ConPawsWidgetEntry) -> Date {
    var candidates: [Date] = []

    switch entry.state {
    case .countdown(let convention):
      let remaining = convention.startDate.timeIntervalSince(entry.date)
      candidates.append(convention.startDate)
      if remaining >= 30 * 86_400 {
        var calendar = Calendar.autoupdatingCurrent
        calendar.timeZone = convention.timeZone
        if let midnight = calendar.nextDate(
          after: entry.date,
          matching: DateComponents(hour: 0, minute: 0, second: 0),
          matchingPolicy: .nextTime
        ) {
          candidates.append(midnight)
        }
      } else if remaining >= 86_400 {
        candidates.append(entry.date.addingTimeInterval(3_600))
      }
    case .next(let convention, let current, let upcoming):
      candidates.append(upcoming.startDate)
      candidates.append(convention.endDate)
      if let current {
        candidates.append(effectiveEnd(for: current, nextStart: upcoming.startDate))
      }
      if let minutes = upcoming.reminderMinutes, minutes > 0 {
        candidates.append(upcoming.startDate.addingTimeInterval(TimeInterval(-minutes * 60)))
      }
    case .leave(let convention, let current, let upcoming):
      candidates.append(upcoming.startDate)
      candidates.append(convention.endDate)
      if let current {
        candidates.append(effectiveEnd(for: current, nextStart: upcoming.startDate))
      }
    case .empty(let convention):
      if let end = convention?.endDate {
        candidates.append(end)
      }
    }

    return candidates
      .filter { $0 > entry.date.addingTimeInterval(1) }
      .min() ?? entry.date.addingTimeInterval(21_600)
  }

  private func effectiveEnd(for event: ConPawsEventSnapshot, nextStart: Date?) -> Date {
    event.endDate
      ?? min(nextStart ?? .distantFuture, event.startDate.addingTimeInterval(3_600))
  }
}

@available(iOS 17.0, *)
struct ConPawsWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ConPawsWidgetEntry

  var body: some View {
    Group {
      switch entry.state {
      case .countdown(let convention):
        ConPawsCountdownView(entryDate: entry.date, convention: convention)
      case .next(let convention, let current, let upcoming):
        ConPawsNextView(
          current: current,
          upcoming: upcoming,
          timeZone: convention.timeZone,
          family: family
        )
      case .leave(let convention, let current, let upcoming):
        ConPawsLeaveView(
          entryDate: entry.date,
          current: current,
          upcoming: upcoming,
          timeZone: convention.timeZone,
          family: family
        )
      case .empty(let convention):
        ConPawsEmptyView(convention: convention)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(entry.appURL)
    .conPawsWidgetBackground()
  }
}

@available(iOS 17.0, *)
struct ConPawsWidget: Widget {
  let kind = "ConPawsWidget"

  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: kind,
      intent: ConPawsWidgetIntent.self,
      provider: ConPawsWidgetProvider()
    ) { entry in
      ConPawsWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("ConPaws")
    .description("Convention countdowns, next events, and leave reminders.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

private struct ConPawsCountdownView: View {
  let entryDate: Date
  let convention: ConPawsConventionSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      ConPawsEyebrow(title: "COMING UP", symbol: "calendar")
      Text(convention.name)
        .font(.headline)
        .lineLimit(2)
      Spacer(minLength: 2)
      if convention.startDate.timeIntervalSince(entryDate) < 86_400 {
        Text(
          timerInterval: entryDate...convention.startDate,
          pauseTime: convention.startDate,
          countsDown: true,
          showsHours: true
        )
        .font(.system(.title2, design: .rounded, weight: .bold))
        .monospacedDigit()
        .widgetAccentable()
      } else {
        Text(
          ConPawsCountdownFormatter.label(
            from: entryDate,
            to: convention.startDate,
            timeZone: convention.timeZone
          )
        )
        .font(.system(.title2, design: .rounded, weight: .bold))
        .monospacedDigit()
        .widgetAccentable()
      }
      if !convention.dateRangeLabel.isEmpty {
        Text(convention.dateRangeLabel)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ConPawsNextView: View {
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let timeZone: TimeZone
  let family: WidgetFamily

  var body: some View {
    if family == .systemMedium {
      HStack(alignment: .top, spacing: 14) {
        VStack(alignment: .leading, spacing: 6) {
          ConPawsEyebrow(title: "NEXT", symbol: "calendar")
          Text(upcoming.title)
            .font(.title3.weight(.semibold))
            .lineLimit(3)
          Spacer(minLength: 2)
          ConPawsEventTime(event: upcoming, timeZone: timeZone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        Divider()

        VStack(alignment: .leading, spacing: 6) {
          Text("WHERE")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
          Text(upcoming.place ?? "Location not set")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(upcoming.place == nil ? .secondary : .primary)
            .lineLimit(3)
          Spacer(minLength: 2)
          if let current {
            Text("Now: \(current.title)")
              .font(.caption)
              .foregroundStyle(.secondary)
              .lineLimit(2)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .accessibilityElement(children: .combine)
    } else {
      VStack(alignment: .leading, spacing: 7) {
        ConPawsEyebrow(title: "NEXT", symbol: "calendar")
        Text(upcoming.title)
          .font(.headline)
          .lineLimit(3)
        Spacer(minLength: 2)
        ConPawsEventTime(event: upcoming, timeZone: timeZone)
        if let place = upcoming.place {
          Text(place)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      .accessibilityElement(children: .combine)
    }
  }
}

private struct ConPawsLeaveView: View {
  let entryDate: Date
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let timeZone: TimeZone
  let family: WidgetFamily

  var body: some View {
    if family == .systemMedium {
      VStack(spacing: 8) {
        HStack(alignment: .top, spacing: 12) {
          ConPawsEventColumn(label: "NOW", event: current, timeZone: timeZone)
          Divider()
          ConPawsEventColumn(label: "NEXT", event: upcoming, timeZone: timeZone)
        }
        HStack(spacing: 6) {
          Image(systemName: "figure.walk")
            .accessibilityHidden(true)
          Text("Leave in")
            .font(.caption.weight(.semibold))
          Spacer()
          ConPawsLiveTimer(from: entryDate, to: upcoming.startDate)
        }
        .foregroundStyle(.tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
        .widgetAccentable()
      }
      .accessibilityElement(children: .combine)
    } else {
      VStack(alignment: .leading, spacing: 5) {
        Text("NOW")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(current?.title ?? "Free now")
          .font(.caption.weight(.medium))
          .lineLimit(1)
        Divider()
        Text("NEXT")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(upcoming.title)
          .font(.subheadline.weight(.semibold))
          .lineLimit(2)
        Spacer(minLength: 1)
        HStack(spacing: 5) {
          Image(systemName: "figure.walk")
            .accessibilityHidden(true)
          Text("Leave in")
            .font(.caption2.weight(.semibold))
          Spacer()
          ConPawsLiveTimer(from: entryDate, to: upcoming.startDate)
        }
        .foregroundStyle(.tint)
        .widgetAccentable()
      }
      .accessibilityElement(children: .combine)
    }
  }
}

private struct ConPawsEventColumn: View {
  let label: String
  let event: ConPawsEventSnapshot?
  let timeZone: TimeZone

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      Text(event?.title ?? "Free now")
        .font(.subheadline.weight(.semibold))
        .lineLimit(2)
      if let event {
        ConPawsEventTime(event: event, timeZone: timeZone)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct ConPawsEmptyView: View {
  let convention: ConPawsConventionSnapshot?

  var body: some View {
    VStack(spacing: 7) {
      Image(systemName: "calendar.badge.exclamationmark")
        .font(.title2)
        .foregroundStyle(.tint)
        .widgetAccentable()
        .accessibilityHidden(true)
      Text("No upcoming events")
        .font(.headline)
        .multilineTextAlignment(.center)
      Text(
        convention == nil
          ? "Add a convention in ConPaws."
          : "Add or import a schedule in ConPaws."
      )
      .font(.caption)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.center)
      .lineLimit(2)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ConPawsEyebrow: View {
  let title: String
  let symbol: String

  var body: some View {
    Label(title, systemImage: symbol)
      .font(.caption2.weight(.semibold))
      .foregroundStyle(.secondary)
      .labelStyle(.titleAndIcon)
  }
}

private struct ConPawsEventTime: View {
  let event: ConPawsEventSnapshot
  let timeZone: TimeZone

  private var formatStyle: Date.FormatStyle {
    var style = Date.FormatStyle.dateTime.weekday(.abbreviated).hour().minute()
    style.timeZone = timeZone
    return style
  }

  var body: some View {
    Text(event.startDate, format: formatStyle)
      .font(.caption.weight(.medium))
      .foregroundStyle(.secondary)
      .lineLimit(1)
  }
}

private struct ConPawsLiveTimer: View {
  let from: Date
  let to: Date

  var body: some View {
    Text(
      timerInterval: from...to,
      pauseTime: to,
      countsDown: true,
      showsHours: true
    )
    .font(.system(.subheadline, design: .rounded, weight: .bold))
    .monospacedDigit()
  }
}

private enum ConPawsCountdownFormatter {
  static func label(from: Date, to: Date, timeZone: TimeZone) -> String {
    let seconds = max(0, to.timeIntervalSince(from))
    if seconds >= 30 * 86_400 {
      var calendar = Calendar.autoupdatingCurrent
      calendar.timeZone = timeZone
      let components = calendar.dateComponents([.month, .day], from: from, to: to)
      let months = max(0, components.month ?? 0)
      let days = max(0, components.day ?? 0)
      return months > 0 ? "\(months) MO \(days) D" : "\(days) D"
    }

    let hours = Int(seconds / 3_600)
    return "\(hours / 24) D \(hours % 24) H"
  }
}

private extension ConPawsConventionSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date { Date(timeIntervalSince1970: endAtMs / 1_000) }
  var timeZone: TimeZone {
    TimeZone(identifier: timeZoneIdentifier) ?? .autoupdatingCurrent
  }

  static let sample = ConPawsConventionSnapshot(
    id: "preview",
    name: "ConPaws Preview Con",
    startAtMs: Date.now.timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(172_800).timeIntervalSince1970 * 1_000,
    timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
    dateRangeLabel: "Today – Sunday",
    events: [.sample]
  )
}

private extension ConPawsEventSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date? { endAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) } }
  var place: String? {
    switch (location, room) {
    case let (location?, room?) where location != room:
      "\(location) · \(room)"
    case let (location?, _):
      location
    case let (_, room?):
      room
    default:
      nil
    }
  }

  static let sample = ConPawsEventSnapshot(
    id: "preview-event",
    title: "Opening Ceremonies",
    startAtMs: Date.now.addingTimeInterval(3_600).timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(7_200).timeIntervalSince1970 * 1_000,
    location: "Main Ballroom",
    room: nil,
    reminderMinutes: 15
  )
}

private extension View {
  @ViewBuilder
  func conPawsWidgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) {
        Color(uiColor: .systemBackground)
      }
    } else {
      background(Color(uiColor: .systemBackground))
    }
  }
}
