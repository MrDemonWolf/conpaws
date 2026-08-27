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
  /// The app's language, carried on the entry so every rendering formats in it
  /// rather than in whatever language the phone happens to be set to.
  let locale: Locale
  /// The same language again, for the words that sit beside those dates.
  let strings: ConPawsStrings
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
    let snapshot = ConPawsSnapshotStore.load()
    return ConPawsWidgetEntry(
      date: .now,
      configuration: ConPawsWidgetIntent(),
      locale: snapshot.locale,
      strings: snapshot.strings,
      state: .next(.sample, current: nil, upcoming: .sample)
    )
  }

  func snapshot(
    for configuration: ConPawsWidgetIntent,
    in context: Context
  ) async -> ConPawsWidgetEntry {
    // The gallery is a shop window, not a live view. Someone browsing it
    // before importing anything should see what this widget looks like full,
    // not the empty state they are trying to get out of.
    context.isPreview
      ? placeholder(in: context)
      : entry(for: configuration, at: .now)
  }

  func timeline(
    for configuration: ConPawsWidgetIntent,
    in context: Context
  ) async -> Timeline<ConPawsWidgetEntry> {
    let now = Date.now
    let first = entry(for: configuration, at: now)

    // One entry plus a refresh request leaves the label frozen for as long as
    // the system takes to wake us -- which is exactly when a countdown looks
    // broken. Pre-build an entry for every moment the text changes so
    // WidgetKit can render them without us.
    var entries = [first]
    for date in changePoints(for: first, from: now) {
      entries.append(entry(for: configuration, at: date))
    }

    // Re-plan from the last entry rather than a fixed interval, so the next
    // wake lands exactly when the pre-built run is exhausted. The states that
    // build no change points have no run to exhaust, and asking for the last
    // entry there would resolve to `now` -- a reload request for a moment that
    // has already passed. Those ask nextRefresh for their single transition.
    let reload = entries.dropFirst().last?.date ?? nextRefresh(for: first)
    return Timeline(entries: entries, policy: .after(reload))
  }

  private func entry(
    for configuration: ConPawsWidgetIntent,
    at date: Date
  ) -> ConPawsWidgetEntry {
    let snapshot = ConPawsSnapshotStore.load()
    let locale = snapshot.locale
    let strings = snapshot.strings
    let nowMs = date.timeIntervalSince1970 * 1_000
    let convention = configuration.convention.flatMap { selected in
      snapshot.conventions.first { $0.id == selected.id }
    } ?? snapshot.conventions
      .filter { $0.endAtMs >= nowMs }
      .min { $0.startAtMs < $1.startAtMs }

    guard let convention else {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        locale: locale,
        strings: strings,
        state: .empty(nil)
      )
    }

    if date < convention.startDate, configuration.mode != .nextEvent {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        locale: locale,
        strings: strings,
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
        locale: locale,
        strings: strings,
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
        locale: locale,
        strings: strings,
        state: .leave(convention, current: current, upcoming: upcoming)
      )
    }

    return ConPawsWidgetEntry(
      date: date,
      configuration: configuration,
      locale: locale,
      strings: strings,
      state: .next(convention, current: current, upcoming: upcoming)
    )
  }

  /// Moments at which this entry's visible countdown would change wording.
  private func changePoints(
    for entry: ConPawsWidgetEntry,
    from date: Date
  ) -> [Date] {
    switch entry.state {
    case .countdown(let convention):
      return ConPawsCountdown.changePoints(
        from: date,
        to: convention.startDate,
        timeZone: convention.timeZone
      )
    case .leave(let convention, _, let upcoming):
      return ConPawsCountdown.changePoints(
        from: date,
        to: upcoming.startDate,
        timeZone: convention.timeZone
      )
    case .next, .empty:
      // These read as clock times rather than countdowns, so they only need
      // the single transition nextRefresh already computes.
      return []
    }
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
      switch family {
      case .accessoryCircular:
        ConPawsCircularView(entry: entry)
      case .accessoryRectangular:
        ConPawsRectangularView(entry: entry)
      case .accessoryInline:
        ConPawsInlineView(entry: entry)
      default:
        homeScreenBody
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .environment(\.locale, entry.locale)
    .widgetURL(entry.appURL)
    .conPawsWidgetBackground(family: family)
  }

  @ViewBuilder
  private var homeScreenBody: some View {
    switch entry.state {
    case .countdown(let convention):
      ConPawsCountdownView(
        entryDate: entry.date,
        convention: convention,
        strings: entry.strings
      )
    case .next(let convention, let current, let upcoming):
      ConPawsNextView(
        current: current,
        upcoming: upcoming,
        timeZone: convention.timeZone,
        family: family,
        strings: entry.strings
      )
    case .leave(let convention, let current, let upcoming):
      ConPawsLeaveView(
        entryDate: entry.date,
        current: current,
        upcoming: upcoming,
        timeZone: convention.timeZone,
        family: family,
        strings: entry.strings
      )
    case .empty(let convention):
      ConPawsEmptyView(convention: convention, strings: entry.strings)
    }
  }
}

@available(iOS 17.0, *)
struct ConPawsWidget: Widget {
  let kind = ConPawsWidgetKind.homeScreen

  var body: some WidgetConfiguration {
    AppIntentConfiguration(
      kind: kind,
      intent: ConPawsWidgetIntent.self,
      provider: ConPawsWidgetProvider()
    ) { entry in
      ConPawsWidgetEntryView(entry: entry)
    }
    // Left in English on purpose. These two are drawn by the widget gallery,
    // not by us, and the system resolves them against the device's language
    // through this extension's bundle. Translating them needs real .lproj or
    // String Catalog resources, which the target generator cannot produce --
    // see the note on ConPawsStrings. Everything the widget itself draws
    // follows the app's language instead.
    .configurationDisplayName("ConPaws")
    .description("Convention countdowns, next events, and leave reminders.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline,
    ])
  }
}

private struct ConPawsCountdownView: View {
  let entryDate: Date
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      ConPawsEyebrow(title: strings.comingUpCaps, symbol: "calendar")
      Text(convention.name)
        .font(.headline)
        .lineLimit(2)
      Spacer(minLength: 2)
      Text(
        ConPawsCountdown.label(
          from: entryDate,
          to: convention.startDate,
          timeZone: convention.timeZone,
          strings: strings
        )
      )
      .font(.system(.title2, design: .rounded, weight: .bold))
      .monospacedDigit()
      .minimumScaleFactor(0.8)
      .lineLimit(1)
      .widgetAccentable()
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
  let strings: ConPawsStrings

  var body: some View {
    if family == .systemMedium {
      HStack(alignment: .top, spacing: 14) {
        VStack(alignment: .leading, spacing: 6) {
          ConPawsEyebrow(title: strings.nextCaps, symbol: "calendar")
          Text(upcoming.title)
            .font(.title3.weight(.semibold))
            .lineLimit(3)
          Spacer(minLength: 2)
          ConPawsEventTime(event: upcoming, timeZone: timeZone)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        Divider()

        VStack(alignment: .leading, spacing: 6) {
          Text(strings.whereCaps)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
          Text(upcoming.place ?? strings.locationNotSet)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(upcoming.place == nil ? .secondary : .primary)
            .lineLimit(3)
          Spacer(minLength: 2)
          if let current {
            Text(strings.text(strings.nowEventFormat, current.title))
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
        ConPawsEyebrow(title: strings.nextCaps, symbol: "calendar")
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
  let strings: ConPawsStrings

  var body: some View {
    if family == .systemMedium {
      VStack(spacing: 8) {
        HStack(alignment: .top, spacing: 12) {
          ConPawsEventColumn(
            label: strings.nowCaps,
            event: current,
            timeZone: timeZone,
            strings: strings
          )
          Divider()
          ConPawsEventColumn(
            label: strings.nextCaps,
            event: upcoming,
            timeZone: timeZone,
            strings: strings
          )
        }
        HStack(spacing: 6) {
          Image(systemName: "figure.walk")
            .accessibilityHidden(true)
          Text(strings.leaveIn)
            .font(.caption.weight(.semibold))
          Spacer()
          ConPawsLiveTimer(
            from: entryDate,
            to: upcoming.startDate,
            timeZone: timeZone,
            strings: strings
          )
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
        Text(strings.nowCaps)
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(current?.title ?? strings.freeNow)
          .font(.caption.weight(.medium))
          .lineLimit(1)
        Divider()
        Text(strings.nextCaps)
          .font(.caption2.weight(.semibold))
          .foregroundStyle(.secondary)
        Text(upcoming.title)
          .font(.subheadline.weight(.semibold))
          .lineLimit(2)
        Spacer(minLength: 1)
        HStack(spacing: 5) {
          Image(systemName: "figure.walk")
            .accessibilityHidden(true)
          Text(strings.leaveIn)
            .font(.caption2.weight(.semibold))
          Spacer()
          ConPawsLiveTimer(
            from: entryDate,
            to: upcoming.startDate,
            timeZone: timeZone,
            strings: strings
          )
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
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(label)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
      Text(event?.title ?? strings.freeNow)
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
  let strings: ConPawsStrings

  var body: some View {
    VStack(spacing: 7) {
      Image(systemName: "calendar.badge.exclamationmark")
        .font(.title2)
        .foregroundStyle(.tint)
        .widgetAccentable()
        .accessibilityHidden(true)
      Text(strings.noUpcomingEvents)
        .font(.headline)
        .multilineTextAlignment(.center)
      Text(
        convention == nil
          ? strings.addConventionHint
          : strings.addScheduleHint
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
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let timeZone: TimeZone

  private var formatStyle: Date.FormatStyle {
    var style = Date.FormatStyle.dateTime.weekday(.abbreviated).hour().minute()
    style.timeZone = timeZone
    style.locale = locale
    return style
  }

  var body: some View {
    Text(event.startDate, format: formatStyle)
      .font(.caption.weight(.medium))
      .foregroundStyle(.secondary)
      .lineLimit(1)
  }
}

/// "Leave in" readout. Shows whole minutes at most, for the same reason the
/// convention countdown does: a widget cannot honour a per-second promise.
private struct ConPawsLiveTimer: View {
  let from: Date
  let to: Date
  let timeZone: TimeZone
  let strings: ConPawsStrings

  var body: some View {
    Text(ConPawsCountdown.label(from: from, to: to, timeZone: timeZone, strings: strings))
      .font(.system(.subheadline, design: .rounded, weight: .bold))
      .monospacedDigit()
      .lineLimit(1)
  }
}

// MARK: - Lock Screen

/// Clock time in the convention's zone. The Lock Screen families have no room
/// for a weekday alongside it, unlike their Home Screen counterparts.
private func conPawsClockStyle(_ timeZone: TimeZone, locale: Locale) -> Date.FormatStyle {
  var style = Date.FormatStyle.dateTime.hour().minute()
  style.timeZone = timeZone
  style.locale = locale
  return style
}

@available(iOS 17.0, *)
private struct ConPawsCircularView: View {
  let entry: ConPawsWidgetEntry

  var body: some View {
    switch entry.state {
    case .countdown(let convention):
      Gauge(
        value: ConPawsCountdown.ringProgress(from: entry.date, to: convention.startDate)
      ) {
        Text(convention.name)
      } currentValueLabel: {
        Text(compact(to: convention.startDate, in: convention.timeZone))
          .minimumScaleFactor(0.6)
          .lineLimit(1)
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .accessibilityLabel(
        "\(convention.name), \(spoken(to: convention.startDate, in: convention.timeZone))"
      )

    case .leave(let convention, _, let upcoming):
      // The reminder window is minutes wide, so every compact label here would
      // read "Soon". The glyph is the message; the number adds nothing.
      ConPawsCircularStack(symbol: "figure.walk")
        .accessibilityLabel(
          entry.strings.text(
            entry.strings.leaveForA11yFormat,
            upcoming.title,
            spoken(to: upcoming.startDate, in: convention.timeZone)
          )
        )

    case .next(let convention, _, let upcoming):
      ConPawsCircularStack(
        symbol: "calendar",
        detail: compact(to: upcoming.startDate, in: convention.timeZone)
      )
      .accessibilityLabel(
        entry.strings.text(
          entry.strings.nextA11yFormat,
          upcoming.title,
          spoken(to: upcoming.startDate, in: convention.timeZone)
        )
      )

    case .empty:
      ConPawsCircularStack(symbol: "calendar")
        .accessibilityLabel(entry.strings.noUpcomingEvents)
    }
  }

  private func compact(to date: Date, in timeZone: TimeZone) -> String {
    ConPawsCountdown.compactLabel(
      from: entry.date,
      to: date,
      timeZone: timeZone,
      strings: entry.strings
    )
  }

  private func spoken(to date: Date, in timeZone: TimeZone) -> String {
    ConPawsCountdown.label(
      from: entry.date,
      to: date,
      timeZone: timeZone,
      strings: entry.strings
    )
  }
}

private struct ConPawsCircularStack: View {
  let symbol: String
  var detail: String?

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(systemName: symbol)
          .font(detail == nil ? .title3 : .caption2)
          .accessibilityHidden(true)
        if let detail {
          Text(detail)
            .font(.caption.weight(.semibold))
            .minimumScaleFactor(0.6)
            .lineLimit(1)
        }
      }
      .padding(6)
    }
  }
}

@available(iOS 17.0, *)
private struct ConPawsRectangularView: View {
  let entry: ConPawsWidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      switch entry.state {
      case .countdown(let convention):
        ConPawsAccessoryEyebrow(
          title: entry.strings.comingUpCaps,
          symbol: "calendar.badge.clock"
        )
        Text(spoken(to: convention.startDate, in: convention.timeZone))
          .font(.headline)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Text(convention.name)
          .font(.caption2)
          .lineLimit(1)

      case .leave(let convention, _, let upcoming):
        ConPawsAccessoryEyebrow(
          title: "\(entry.strings.leaveCaps) · \(spoken(to: upcoming.startDate, in: convention.timeZone))",
          symbol: "figure.walk"
        )
        Text(upcoming.title)
          .font(.headline)
          .lineLimit(1)
        if let place = upcoming.place {
          Text(place)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

      case .next(let convention, _, let upcoming):
        ConPawsAccessoryEyebrow(
          title: "\(entry.strings.nextCaps) · \(clock(upcoming.startDate, in: convention.timeZone))",
          symbol: "calendar"
        )
        Text(upcoming.title)
          .font(.headline)
          .lineLimit(1)
        if let place = upcoming.place {
          Text(place)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

      case .empty(let convention):
        ConPawsAccessoryEyebrow(title: entry.strings.noEventsCaps, symbol: "calendar")
        Text(convention?.name ?? entry.strings.addConvention)
          .font(.headline)
          .lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }

  private func spoken(to date: Date, in timeZone: TimeZone) -> String {
    ConPawsCountdown.label(
      from: entry.date,
      to: date,
      timeZone: timeZone,
      strings: entry.strings
    )
  }

  private func clock(_ date: Date, in timeZone: TimeZone) -> String {
    date.formatted(conPawsClockStyle(timeZone, locale: entry.locale))
  }
}

private struct ConPawsAccessoryEyebrow: View {
  let title: String
  let symbol: String

  var body: some View {
    Label(title, systemImage: symbol)
      .font(.caption2.weight(.semibold))
      .lineLimit(1)
  }
}

@available(iOS 17.0, *)
private struct ConPawsInlineView: View {
  let entry: ConPawsWidgetEntry

  /// Inline sits on one line beside the clock and renders a symbol plus text.
  /// Custom layout is ignored here, so every state is one `Label`.
  var body: some View {
    switch entry.state {
    case .countdown(let convention):
      // Countdown first. Inline shares its line with the date and truncates
      // hard, and the countdown is the part worth reading -- putting the
      // convention name first buries it behind an ellipsis.
      Label(
        "\(spoken(to: convention.startDate, in: convention.timeZone)) · \(convention.name)",
        systemImage: "calendar"
      )
    case .leave(let convention, _, let upcoming):
      Label(
        "\(leaveLead(to: upcoming.startDate, in: convention.timeZone)) · \(upcoming.title)",
        systemImage: "figure.walk"
      )
    case .next(let convention, _, let upcoming):
      Label(
        "\(upcoming.startDate.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))) · \(upcoming.title)",
        systemImage: "calendar"
      )
    case .empty:
      Label(entry.strings.noUpcomingEvents, systemImage: "calendar")
    }
  }

  private func spoken(to date: Date, in timeZone: TimeZone) -> String {
    ConPawsCountdown.label(
      from: entry.date,
      to: date,
      timeZone: timeZone,
      strings: entry.strings
    )
  }

  /// "Leave in 3 hours", built from the shared countdown rather than a second
  /// wording of the same wait.
  private func leaveLead(to date: Date, in timeZone: TimeZone) -> String {
    let strings = entry.strings
    return strings.text(
      strings.inlineLeaveFormat,
      strings.midSentenceCountdown(spoken(to: date, in: timeZone))
    )
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
  func conPawsWidgetBackground(family: WidgetFamily) -> some View {
    switch family {
    case .accessoryCircular, .accessoryRectangular, .accessoryInline:
      // The Lock Screen paints its own backdrop and expects the widget to sit
      // in it. Anything opaque here reads as a card stuck on the wallpaper.
      containerBackground(.clear, for: .widget)
    default:
      containerBackground(for: .widget) {
        Color(uiColor: .systemBackground)
      }
    }
  }
}

#if DEBUG
/// Boundary checks for the countdown ladder the Lock Screen families added.
///
/// The compact and prose renderings share one classifier precisely so they
/// cannot drift apart; these assertions are what would catch it if they did.
func runConPawsWidgetSelfCheck() {
  let zone = TimeZone(identifier: "UTC")!
  // 2026-01-01 00:00 UTC. Midnight in the test zone keeps the calendar-day
  // arithmetic below unambiguous.
  let now = Date(timeIntervalSince1970: 1_767_225_600)

  // Pinned to English: the assertions below compare exact wording, so reading
  // the app's language here would fail them on a translated build rather than
  // on a broken ladder.
  func compact(_ seconds: TimeInterval) -> String {
    ConPawsCountdown.compactLabel(
      from: now,
      to: now.addingTimeInterval(seconds),
      timeZone: zone,
      strings: .english
    )
  }
  func prose(_ seconds: TimeInterval) -> String {
    ConPawsCountdown.label(
      from: now,
      to: now.addingTimeInterval(seconds),
      timeZone: zone,
      strings: .english
    )
  }

  assert(compact(-60) == "Now")
  assert(compact(0) == "Now")
  assert(compact(60) == "Soon")
  assert(compact(3_599) == "Soon")
  assert(compact(3_600) == "1h")
  assert(compact(6 * 3_600) == "6h")
  assert(compact(86_399) == "23h")
  assert(compact(86_400) == "1d")
  assert(compact(13 * 86_400) == "13d")
  assert(compact(60 * 86_400) == "2mo")

  assert(prose(0) == "Now")
  assert(prose(3_600) == "In 1 hour")
  assert(prose(86_400) == "Tomorrow")
  assert(prose(13 * 86_400) == "In 13 days")
  assert(prose(60 * 86_400) == "In 2 months")

  // 30 days out with no whole calendar month between them stays in days. This
  // is the rung the JS mirrors in docs/ get wrong by dividing by 30.
  assert(compact(30 * 86_400) == "30d")
  assert(prose(30 * 86_400) == "In 30 days")
  assert(compact(31 * 86_400) == "1mo")

  // The ring is scaled to the final week and clamped either side of it.
  assert(ConPawsCountdown.ringProgress(from: now, to: now) == 1)
  assert(ConPawsCountdown.ringProgress(from: now, to: now.addingTimeInterval(7 * 86_400)) == 0)
  assert(ConPawsCountdown.ringProgress(from: now, to: now.addingTimeInterval(30 * 86_400)) == 0)
  let midweek = ConPawsCountdown.ringProgress(
    from: now,
    to: now.addingTimeInterval(3.5 * 86_400)
  )
  assert(abs(midweek - 0.5) < 0.000_1)

  // Polish is the only language here that inflects 2-4 apart from 5 and up, so
  // it is the only one whose plural rule can be wrong without English noticing.
  let polish = ConPawsStrings.table(for: .pl)
  assert(polish.hours(1) == "1 godzina")
  assert(polish.hours(2) == "2 godziny")
  assert(polish.hours(5) == "5 godzin")
  assert(polish.hours(12) == "12 godzin")
  assert(polish.hours(22) == "22 godziny")
  assert(polish.inDays(3) == "Za 3 dni")

  // A language the app does not ship, and a regionless Portuguese, both have to
  // land somewhere renderable rather than on an empty string.
  assert(ConPawsLanguage.resolve("ja") == .en)
  assert(ConPawsLanguage.resolve("pt") == .ptBR)
  assert(ConPawsLanguage.resolve("de_DE") == .de)
  assert(ConPawsLanguage.resolve("pt-BR") == .ptBR)
}
#endif
