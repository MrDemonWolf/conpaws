import SwiftUI
import WidgetKit

// MARK: - Brand

/// Widget brand accent, resolved from the asset catalog so light and dark get
/// their own values (#00729C / #18B7F2).
///
/// The light primary measures ≈4.7:1 on white — a documented divergence from
/// the app's AAA policy (the app darkened its own primary to #005575; the
/// widget deliberately did not, per docs/widget-redesign-2026-08.html §1).
/// That contrast is fine at headline sizes and not below ~13pt, which is what
/// `smallText` (#00618A in light) exists for. Dark mode's #18B7F2 clears 8:1
/// and shares one value across both roles.
private enum ConPawsBrand {
  static let primary = Color("BrandPrimary")
  static let smallText = Color("BrandSmallText")
}

private enum ConPawsWidgetState {
  case countdown(ConPawsConventionSnapshot)
  case next(ConPawsConventionSnapshot, current: ConPawsEventSnapshot?, upcoming: ConPawsEventSnapshot)
  case leave(ConPawsConventionSnapshot, current: ConPawsEventSnapshot?, upcoming: ConPawsEventSnapshot)
  case current(ConPawsConventionSnapshot, ConPawsEventSnapshot)
  case finished(ConPawsConventionSnapshot)
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
  let snapshotDate: Date?
  fileprivate let state: ConPawsWidgetState

  fileprivate var isSnapshotStale: Bool {
    guard let snapshotDate else { return false }
    return ConPawsSnapshotAge.isStale(
      generatedAtMs: snapshotDate.timeIntervalSince1970 * 1_000,
      now: date
    )
  }

  fileprivate var appURL: URL? {
    switch state {
    case .countdown(let convention), .next(let convention, _, _), .leave(let convention, _, _), .current(let convention, _), .finished(let convention):
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
      snapshotDate: Date.now,
      state: .next(.sample, current: .sampleCurrent, upcoming: .sample)
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
    if let snapshotDate = first.snapshotDate {
      let staleAt = snapshotDate.addingTimeInterval(ConPawsSnapshotAge.staleAfter)
      if staleAt > now, !entries.contains(where: { $0.date == staleAt }) {
        entries.append(entry(for: configuration, at: staleAt))
      }
    }
    entries.sort { $0.date < $1.date }

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
    let snapshotDate = snapshot.conventions.isEmpty
      ? nil
      : Date(timeIntervalSince1970: snapshot.generatedAtMs / 1_000)
    let resolved = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: configuration.convention?.id,
      skipCountdown: configuration.mode == .nextEvent,
      now: date
    )
    let state: ConPawsWidgetState
    switch resolved {
    case .noConvention:
      state = .empty(nil)
    case .countdown(let convention):
      state = .countdown(convention)
    case .next(let convention, let current, let upcoming):
      state = ConPawsScheduleResolver.isInReminderWindow(upcoming, now: date)
        ? .leave(convention, current: current, upcoming: upcoming)
        : .next(convention, current: current, upcoming: upcoming)
    case .currentOnly(let convention, let event):
      state = .current(convention, event)
    case .finished(let convention):
      state = .finished(convention)
    case .noPicks(let convention):
      state = .empty(convention)
    }
    return ConPawsWidgetEntry(
      date: date,
      configuration: configuration,
      locale: locale,
      strings: strings,
      snapshotDate: snapshotDate,
      state: state
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
    case .leave(_, _, let upcoming):
      // The leave countdown reads in whole minutes, so it needs an entry per
      // minute rather than the hourly ladder.
      return ConPawsCountdown.leaveChangePoints(from: date, to: upcoming.startDate)
    case .next, .empty, .finished:
      // These read as clock times rather than countdowns, so they only need
      // the single transition nextRefresh already computes.
      return []
    case .current:
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
        candidates.append(ConPawsScheduleResolver.effectiveEnd(of: current))
      }
      if let minutes = upcoming.reminderMinutes, minutes > 0 {
        candidates.append(upcoming.startDate.addingTimeInterval(TimeInterval(-minutes * 60)))
      }
      // The large day view rolls its header and row list at the convention's
      // local midnight even when no event boundary falls there.
      var calendar = Calendar.autoupdatingCurrent
      calendar.timeZone = convention.timeZone
      if let midnight = calendar.nextDate(
        after: entry.date,
        matching: DateComponents(hour: 0, minute: 0, second: 0),
        matchingPolicy: .nextTime
      ) {
        candidates.append(midnight)
      }
    case .leave(let convention, let current, let upcoming):
      candidates.append(upcoming.startDate)
      candidates.append(convention.endDate)
      if let current {
        candidates.append(ConPawsScheduleResolver.effectiveEnd(of: current))
      }
    case .empty(let convention):
      if let end = convention?.endDate {
        candidates.append(end)
      }
    case .current(let convention, let event):
      candidates.append(ConPawsScheduleResolver.effectiveEnd(of: event))
      candidates.append(convention.endDate)
    case .finished(let convention):
      candidates.append(convention.endDate)
    }

    if let snapshotDate = entry.snapshotDate {
      let staleAt = snapshotDate.addingTimeInterval(ConPawsSnapshotAge.staleAfter)
      if staleAt > entry.date { candidates.append(staleAt) }
    }

    return candidates
      .filter { $0 > entry.date.addingTimeInterval(1) }
      .min() ?? entry.date.addingTimeInterval(21_600)
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
    VStack(alignment: .leading, spacing: 3) {
      Group {
        switch entry.state {
        case .countdown(let convention):
          if family == .systemLarge {
            ConPawsLargeCountdownView(
              entryDate: entry.date,
              convention: convention,
              strings: entry.strings
            )
          } else {
            ConPawsCountdownView(
              entryDate: entry.date,
              convention: convention,
              strings: entry.strings
            )
          }
        case .next(let convention, let current, let upcoming):
          scheduleBody(convention: convention, current: current, upcoming: upcoming, isLeave: false)
        case .leave(let convention, let current, let upcoming):
          scheduleBody(convention: convention, current: current, upcoming: upcoming, isLeave: true)
        case .current(let convention, let event):
          ConPawsCurrentOnlyView(
            convention: convention,
            event: event,
            strings: entry.strings
          )
        case .finished(let convention):
          ConPawsEmptyView(
            family: family,
            title: entry.strings.finishedTitle,
            hint: entry.strings.finishedHint,
            lastEnded: lastEndedText(in: convention, locale: entry.locale, strings: entry.strings)
          )
        case .empty(let convention):
          ConPawsEmptyView(
            family: family,
            title: convention == nil ? entry.strings.noConventionTitle : entry.strings.noPicksTitle,
            hint: convention == nil ? entry.strings.noConventionHint : entry.strings.noPicksHint
          )
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

      if family == .systemMedium || family == .systemLarge {
        ConPawsSnapshotFooter(entry: entry)
      }
    }
  }

  private func lastEndedText(
    in convention: ConPawsConventionSnapshot,
    locale: Locale,
    strings: ConPawsStrings
  ) -> String? {
    guard let event = convention.events.max(by: {
      ConPawsScheduleResolver.effectiveEnd(of: $0) < ConPawsScheduleResolver.effectiveEnd(of: $1)
    }) else { return nil }
    return strings.text(
      strings.lastEndedFormat,
      ConPawsScheduleResolver.effectiveEnd(of: event).formatted(
        conPawsClockStyle(convention.timeZone, locale: locale)
      )
    )
  }

  @ViewBuilder
  private func scheduleBody(
    convention: ConPawsConventionSnapshot,
    current: ConPawsEventSnapshot?,
    upcoming: ConPawsEventSnapshot,
    isLeave: Bool
  ) -> some View {
    switch family {
    case .systemMedium:
      ConPawsMediumView(
        entryDate: entry.date,
        convention: convention,
        current: current,
        upcoming: upcoming,
        strings: entry.strings,
        isLeave: isLeave
      )
    case .systemLarge:
      ConPawsLargeView(
        entryDate: entry.date,
        convention: convention,
        current: current,
        upcoming: upcoming,
        strings: entry.strings,
        isLeave: isLeave
      )
    default:
      if isLeave {
        ConPawsSmallLeaveView(
          entryDate: entry.date,
          current: current,
          upcoming: upcoming,
          convention: convention,
          strings: entry.strings
        )
      } else {
        ConPawsSmallNextView(
          entryDate: entry.date,
          current: current,
          upcoming: upcoming,
          convention: convention,
          strings: entry.strings
        )
      }
    }
  }
}

private struct ConPawsSnapshotFooter: View {
  let entry: ConPawsWidgetEntry

  var body: some View {
    if let snapshotDate = entry.snapshotDate {
      VStack(alignment: .leading, spacing: 1) {
        Text(entry.strings.text(entry.strings.planLastUpdatedFormat, time(snapshotDate)))
          .lineLimit(1)
        if entry.isSnapshotStale {
          Text(entry.strings.staleHint)
            .lineLimit(1)
        }
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      .accessibilityElement(children: .combine)
    }
  }

  private func time(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = entry.locale
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}

private struct ConPawsCurrentOnlyView: View {
  @Environment(\.locale) private var locale
  let convention: ConPawsConventionSnapshot
  let event: ConPawsEventSnapshot
  let strings: ConPawsStrings

  var body: some View {
    let end = ConPawsScheduleResolver.effectiveEnd(of: event)
    let endTime = end.formatted(conPawsClockStyle(convention.timeZone, locale: locale))
    VStack(alignment: .leading, spacing: 6) {
      ConPawsAccessoryEyebrow(
        title: "\(strings.happeningNowCaps) · \(strings.text(strings.untilCapsFormat, endTime))"
      )
      Text(event.title).font(.headline).lineLimit(2)
      if let place = event.place { Text(place).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
      Text(strings.noLaterSavedEvents).font(.caption).foregroundStyle(.secondary).lineLimit(2)
      Text(convention.name).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
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
    .description("Convention countdowns, upcoming events, and schedule reminders.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .systemLarge,
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline,
    ])
  }
}

// MARK: - Shared pieces

/// Mark + convention name on the left, context on the right. Every Home
/// Screen family that shows a schedule opens with this line.
private struct ConPawsWidgetHeader: View {
  let name: String
  let trailing: String

  var body: some View {
    HStack(spacing: 8) {
      HStack(spacing: 4) {
        ConPawsMark(size: 12)
        Text(name)
          .lineLimit(1)
      }
      .font(.caption2.weight(.bold))
      .foregroundStyle(ConPawsBrand.smallText)
      .widgetAccentable()
      Spacer(minLength: 8)
      Text(trailing)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
  }
}

/// "Starts in 18 min · Dance Practice 101" on a brand chip, pinned into the
/// medium and large layouts during the leave window.
private struct ConPawsLeaveStrip: View {
  let entryDate: Date
  let upcoming: ConPawsEventSnapshot
  let timeZone: TimeZone
  let strings: ConPawsStrings

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "bell")
        .accessibilityHidden(true)
      Text(
        "\(ConPawsCountdown.leaveLead(from: entryDate, to: upcoming.startDate, timeZone: timeZone, strings: strings)) · \(upcoming.title)"
      )
      .lineLimit(1)
    }
    .font(.caption.weight(.bold))
    .monospacedDigit()
    .foregroundStyle(ConPawsBrand.smallText)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .background(ConPawsBrand.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    .widgetAccentable()
  }
}

/// The age pill for a restricted event, pre-localized by the app. Medium and
/// large rows only -- smaller families have no room for it.
private struct ConPawsAgePill: View {
  let label: String

  var body: some View {
    Text(label)
      .font(.caption2.weight(.semibold))
      .lineLimit(1)
      .foregroundStyle(ConPawsBrand.smallText)
      .padding(.horizontal, 5)
      .padding(.vertical, 1)
      .background(ConPawsBrand.primary.opacity(0.12), in: Capsule())
  }
}

private struct ConPawsRail: View {
  var body: some View {
    RoundedRectangle(cornerRadius: 1.5)
      .fill(ConPawsBrand.primary)
      // Width fixed, height capped to the row: a bare Shape accepts every
      // point a widget has spare, which blew the Now card up to fill the
      // whole family. The row's fixedSize keeps the card hugging its text.
      .frame(width: 3)
      .frame(maxHeight: .infinity)
      .widgetAccentable()
  }
}

/// Clock time in the convention's zone.
private func conPawsClockStyle(_ timeZone: TimeZone, locale: Locale) -> Date.FormatStyle {
  var style = Date.FormatStyle.dateTime.hour().minute()
  style.timeZone = timeZone
  style.locale = locale
  return style
}

/// Clock time, prefixed with the weekday when the event is not on the entry's
/// day (in the convention's zone) -- a bare "7:00 PM" for tomorrow's opening
/// ceremony would read as tonight's.
private func conPawsTimeLabel(
  _ date: Date,
  now: Date,
  timeZone: TimeZone,
  locale: Locale
) -> String {
  var calendar = Calendar.autoupdatingCurrent
  calendar.timeZone = timeZone
  let clock = date.formatted(conPawsClockStyle(timeZone, locale: locale))
  guard !calendar.isDate(date, inSameDayAs: now) else { return clock }
  var weekday = Date.FormatStyle.dateTime.weekday(.abbreviated)
  weekday.timeZone = timeZone
  weekday.locale = locale
  return "\(date.formatted(weekday)) \(clock)"
}

private func conPawsReminderAtLabel(
  _ upcoming: ConPawsEventSnapshot,
  timeZone: TimeZone,
  locale: Locale,
  strings: ConPawsStrings
) -> String? {
  guard let minutes = upcoming.reminderMinutes, minutes >= 0 else { return nil }
  let reminderAt = upcoming.startDate.addingTimeInterval(-Double(minutes) * 60)
  return strings.reminderAt(
    reminderAt.formatted(conPawsClockStyle(timeZone, locale: locale)),
    minutes: minutes
  )
}

/// The header's date, in the convention's zone: "Thu, Sep 3" on medium,
/// "Thursday · Sep 3" on large.
private func conPawsDayLabel(
  _ date: Date,
  timeZone: TimeZone,
  locale: Locale,
  wide: Bool
) -> String {
  if wide {
    var weekday = Date.FormatStyle.dateTime.weekday(.wide)
    weekday.timeZone = timeZone
    weekday.locale = locale
    var monthDay = Date.FormatStyle.dateTime.month(.abbreviated).day()
    monthDay.timeZone = timeZone
    monthDay.locale = locale
    return "\(date.formatted(weekday)) · \(date.formatted(monthDay))"
  }
  var style = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day()
  style.timeZone = timeZone
  style.locale = locale
  return date.formatted(style)
}

// MARK: - systemSmall

private struct ConPawsSmallNextView: View {
  @Environment(\.locale) private var locale
  let entryDate: Date
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(current == nil ? strings.upNextCaps : strings.happeningNowCaps)
        .font(.caption2.weight(.bold))
        .foregroundStyle(ConPawsBrand.smallText)
        .widgetAccentable()
      if let current {
        Text(current.title).font(.footnote.weight(.semibold)).lineLimit(1)
        Text("\(strings.upNextCaps) · \(conPawsTimeLabel(upcoming.startDate, now: entryDate, timeZone: convention.timeZone, locale: locale))")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(ConPawsBrand.smallText)
          .lineLimit(1)
      } else {
        Spacer(minLength: 2)
        Text(conPawsTimeLabel(upcoming.startDate, now: entryDate, timeZone: convention.timeZone, locale: locale))
          .font(.footnote.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(ConPawsBrand.smallText)
          .widgetAccentable()
      }
      Text(upcoming.title)
        .font(.footnote.weight(.semibold))
        .lineLimit(1)
      if let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: locale, strings: strings) {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
      }
      if let place = upcoming.place {
        Text(place)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      if current == nil {
        Spacer(minLength: 2)
        Text(convention.name).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ConPawsSmallLeaveView: View {
  @Environment(\.locale) private var locale
  let entryDate: Date
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      if let current {
        Text(strings.happeningNowCaps).font(.caption2.weight(.bold)).foregroundStyle(ConPawsBrand.smallText)
        Text(current.title).font(.caption.weight(.semibold)).lineLimit(1)
      }
      HStack(spacing: 4) {
        Image(systemName: "bell")
          .accessibilityHidden(true)
        Text(strings.startsIn)
      }
      .font(.caption2.weight(.bold))
      .foregroundStyle(ConPawsBrand.smallText)
      .widgetAccentable()
      Spacer(minLength: 2)
      Text(
        ConPawsCountdown.leaveCountdown(
          from: entryDate,
          to: upcoming.startDate,
          timeZone: convention.timeZone,
          strings: strings
        )
      )
      .font(.system(.title2, design: .rounded, weight: .bold))
      .monospacedDigit()
      .foregroundStyle(ConPawsBrand.primary)
      .minimumScaleFactor(0.8)
      .lineLimit(1)
      .widgetAccentable()
      Text(upcoming.title)
        .font(.footnote.weight(.semibold))
        .lineLimit(1)
      if let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: locale, strings: strings) {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
      }
      Text(meta)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
      Spacer(minLength: 2)
    }
    .accessibilityElement(children: .combine)
  }

  private var meta: String {
    let clock = conPawsTimeLabel(upcoming.startDate, now: entryDate, timeZone: convention.timeZone, locale: locale)
    guard let place = upcoming.place else { return clock }
    return "\(place) · \(clock)"
  }
}

// MARK: - Countdown (pre-con)

private struct ConPawsCountdownView: View {
  let entryDate: Date
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 4) {
        ConPawsMark(size: 11)
        Text(strings.comingUpCaps)
          .lineLimit(1)
      }
      .font(.caption2.weight(.bold))
      .foregroundStyle(ConPawsBrand.smallText)
      .widgetAccentable()
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
      .foregroundStyle(ConPawsBrand.primary)
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

private struct ConPawsLargeCountdownView: View {
  let entryDate: Date
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      ConPawsWidgetHeader(name: convention.name, trailing: strings.comingUpTitle)
      Spacer()
      VStack(spacing: 4) {
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
        .foregroundStyle(ConPawsBrand.primary)
        .widgetAccentable()
        Text(subtitle)
          .font(.caption)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .lineLimit(2)
      }
      .frame(maxWidth: .infinity)
      Spacer()
      if !convention.events.isEmpty {
        Divider()
        Text(strings.starred(convention.events.count))
          .font(.caption2)
          .foregroundStyle(.secondary)
          .padding(.top, 6)
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var subtitle: String {
    convention.dateRangeLabel.isEmpty
      ? strings.untilTheConvention
      : "\(convention.dateRangeLabel) · \(strings.untilTheConvention)"
  }
}

// MARK: - systemMedium

private struct ConPawsMediumView: View {
  @Environment(\.locale) private var locale
  let entryDate: Date
  let convention: ConPawsConventionSnapshot
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let strings: ConPawsStrings
  let isLeave: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      ConPawsWidgetHeader(
        name: convention.name,
        trailing: conPawsDayLabel(
          entryDate,
          timeZone: convention.timeZone,
          locale: locale,
          wide: false
        )
      )
      // Urgency descends with the reading order: leave (act now), then the
      // running event, then what comes later. Matches the large family.
      if isLeave {
        ConPawsLeaveStrip(
          entryDate: entryDate,
          upcoming: upcoming,
          timeZone: convention.timeZone,
          strings: strings
        )
      }
      if let current {
        nowRow(current)
      }
      ForEach(upcomingRows) { event in
        eventRow(event)
      }
      Spacer(minLength: 0)
    }
  }

  /// Current event (if any) plus the next rows by start time, three lines in
  /// all -- the leave strip takes the last line during the leave window.
  private var upcomingRows: [ConPawsEventSnapshot] {
    let capacity = (isLeave ? 2 : 3) - (current == nil ? 0 : 1)
    guard capacity > 0 else { return [] }
    return Array(
      convention.events
        .sorted { $0.startAtMs < $1.startAtMs }
        .filter { $0.startDate > entryDate }
        .prefix(capacity)
    )
  }

  private func nowRow(_ event: ConPawsEventSnapshot) -> some View {
    HStack(spacing: 8) {
      ConPawsRail()
      timeColumn(strings.happeningNowCaps)
      titleLine(event)
      Spacer(minLength: 0)
      if let pill = event.ageRating {
        ConPawsAgePill(label: pill)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.horizontal, 7)
    .padding(.vertical, 5)
    .background(ConPawsBrand.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
    .accessibilityElement(children: .combine)
  }

  private func eventRow(_ event: ConPawsEventSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 8) {
        timeColumn(
          conPawsTimeLabel(
            event.startDate,
            now: entryDate,
            timeZone: convention.timeZone,
            locale: locale
          )
        )
        titleLine(event)
        Spacer(minLength: 0)
        if let pill = event.ageRating {
          ConPawsAgePill(label: pill)
        }
      }
      if event.id == upcoming.id,
        let reminder = conPawsReminderAtLabel(event, timeZone: convention.timeZone, locale: locale, strings: strings)
      {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).padding(.leading, 62)
      }
    }
    .padding(.horizontal, 7)
    .accessibilityElement(children: .combine)
  }

  private func timeColumn(_ label: String) -> some View {
    Text(label)
      .font(.caption2.weight(.semibold))
      .monospacedDigit()
      .foregroundStyle(ConPawsBrand.smallText)
      .lineLimit(2)
      .fixedSize(horizontal: false, vertical: true)
      .minimumScaleFactor(0.85)
      .frame(width: 54, alignment: .leading)
      .widgetAccentable()
  }

  private func titleLine(_ event: ConPawsEventSnapshot) -> some View {
    var line = Text(event.title).fontWeight(.semibold)
    if let place = event.place {
      line = line + Text(" · \(place)").fontWeight(.regular).foregroundStyle(.secondary)
    }
    return line
      .font(.footnote)
      .lineLimit(1)
  }
}

// MARK: - systemLarge

private struct ConPawsLargeView: View {
  @Environment(\.locale) private var locale
  let entryDate: Date
  let convention: ConPawsConventionSnapshot
  let current: ConPawsEventSnapshot?
  let upcoming: ConPawsEventSnapshot
  let strings: ConPawsStrings
  let isLeave: Bool

  var body: some View {
    let today = todayRows
    VStack(alignment: .leading, spacing: 8) {
      ConPawsWidgetHeader(
        name: convention.name,
        trailing: conPawsDayLabel(
          entryDate,
          timeZone: convention.timeZone,
          locale: locale,
          wide: true
        )
      )
      if isLeave {
        ConPawsLeaveStrip(
          entryDate: entryDate,
          upcoming: upcoming,
          timeZone: convention.timeZone,
          strings: strings
        )
      }
      if today.shown.isEmpty {
        Spacer()
        allDone
        Spacer()
      } else {
        if let current {
          nowRow(current)
        }
        ForEach(today.shown.filter { $0.id != current?.id }) { event in
          eventRow(event)
        }
        Spacer(minLength: 0)
        if today.overflow > 0 {
          Divider()
          Text(strings.moreToday(today.overflow))
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  /// The day view's rows: the running event, then the next starred events by
  /// start time -- like medium, spilling past midnight once today is
  /// exhausted, so a late evening still fills the family instead of leaving a
  /// half-empty card. Cross-day rows carry a weekday prefix. The overflow
  /// counter stays scoped to today ("+N more today"), and today's events sort
  /// first, so the wording never counts tomorrow.
  private var todayRows: (shown: [ConPawsEventSnapshot], overflow: Int) {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = convention.timeZone
    let upcomingAll = convention.events
      .sorted { $0.startAtMs < $1.startAtMs }
      .filter { $0.startDate > entryDate }

    // The leave strip takes a row's worth of height, so the list gives one up.
    let capacity = isLeave ? 4 : 5
    var shown: [ConPawsEventSnapshot] = []
    if let current {
      shown.append(current)
    }
    let room = max(0, capacity - shown.count)
    shown.append(contentsOf: upcomingAll.prefix(room))
    let overflowToday = upcomingAll.dropFirst(room)
      .filter { calendar.isDate($0.startDate, inSameDayAs: entryDate) }
      .count
    return (shown, overflowToday)
  }

  @ViewBuilder
  private var allDone: some View {
    VStack(spacing: 8) {
      ConPawsMarkShape()
        .frame(width: 40, height: 40)
        .foregroundStyle(ConPawsBrand.primary)
        .widgetAccentable()
        .accessibilityHidden(true)
      Text(strings.allDoneTitle)
        .font(.headline)
        .multilineTextAlignment(.center)
      Text(allDoneDetail)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .lineLimit(3)
        .frame(maxWidth: 240)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .combine)
  }

  /// Names the next actionable thing: tomorrow's first event when that is
  /// what comes next, otherwise the softer "another day" note.
  private var allDoneDetail: String {
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = convention.timeZone
    if
      let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: entryDate)),
      calendar.isDate(upcoming.startDate, inSameDayAs: tomorrow)
    {
      return strings.firstTomorrow(
        upcoming.title,
        upcoming.startDate.formatted(conPawsClockStyle(convention.timeZone, locale: locale))
      )
    }
    return strings.noEventsTodayMessage
  }

  private func nowRow(_ event: ConPawsEventSnapshot) -> some View {
    HStack(alignment: .top, spacing: 8) {
      ConPawsRail()
      VStack(alignment: .leading, spacing: 1) {
        Text(strings.happeningNowCaps)
          .font(.caption2.weight(.semibold))
          .monospacedDigit()
          .foregroundStyle(ConPawsBrand.smallText)
          .lineLimit(1)
          .widgetAccentable()
        Text(event.title)
          .font(.footnote.weight(.semibold))
          .lineLimit(2)
        if let place = event.place {
          Text(place)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
      if let pill = event.ageRating {
        ConPawsAgePill(label: pill)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(8)
    .background(ConPawsBrand.primary.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
    .accessibilityElement(children: .combine)
  }

  private func eventRow(_ event: ConPawsEventSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(alignment: .top, spacing: 8) {
        // Day-prefixed once the list spills past midnight; large has the width
        // for a "Sat 10:00 AM" column that medium has to squeeze.
        Text(
          conPawsTimeLabel(
            event.startDate,
            now: entryDate,
            timeZone: convention.timeZone,
            locale: locale
          )
        )
        .font(.caption2.weight(.semibold))
        .monospacedDigit()
        .foregroundStyle(ConPawsBrand.smallText)
        .lineLimit(1)
        .minimumScaleFactor(0.85)
        .frame(width: 74, alignment: .leading)
        .widgetAccentable()
        VStack(alignment: .leading, spacing: 1) {
          Text(event.title)
            .font(.footnote.weight(.semibold))
            .lineLimit(1)
          if let place = event.place {
            Text(place)
              .font(.caption2)
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
        }
        Spacer(minLength: 0)
        if let pill = event.ageRating {
          ConPawsAgePill(label: pill)
        }
      }
      if event.id == upcoming.id,
        let reminder = conPawsReminderAtLabel(event, timeZone: convention.timeZone, locale: locale, strings: strings)
      {
        Text(reminder).font(.caption2).foregroundStyle(.secondary).padding(.leading, 82)
      }
    }
    .padding(.horizontal, 8)
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Empty

private struct ConPawsEmptyView: View {
  let family: WidgetFamily
  let title: String
  let hint: String
  var lastEnded: String?

  var body: some View {
    VStack(spacing: family == .systemSmall ? 6 : 8) {
      ConPawsMarkShape()
        .frame(
          width: family == .systemSmall ? 26 : 40,
          height: family == .systemSmall ? 26 : 40
        )
        .foregroundStyle(ConPawsBrand.primary)
        .widgetAccentable()
        .accessibilityHidden(true)
      Text(title)
        .font(.headline)
        .multilineTextAlignment(.center)
      if family != .systemSmall, let lastEnded {
        Text(lastEnded)
          .font(.caption)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }
      Text(hint)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .lineLimit(2)
    }
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Lock Screen

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

    case .leave(let convention, let current, let upcoming):
      // The reminder window is minutes wide, so this is the one ring that can
      // afford to move: it fills across the window itself, minutes at the
      // center, with a reminder bell beneath.
      Gauge(
        value: ConPawsCountdown.leaveProgress(
          from: entry.date,
          to: upcoming.startDate,
          windowMinutes: upcoming.reminderMinutes ?? 15
        )
      ) {
        Text(entry.strings.startsIn)
      } currentValueLabel: {
        VStack(spacing: -2) {
          Text(leaveCenter(to: upcoming.startDate, in: convention.timeZone))
            .font(.title3.weight(.semibold))
            .monospacedDigit()
            .minimumScaleFactor(0.5)
            .lineLimit(1)
          Image(systemName: "bell")
            .font(.caption2)
        }
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .accessibilityLabel(reminderSummary(current: current, upcoming: upcoming, in: convention, reminderWindow: true))

    case .next(let convention, let current, let upcoming):
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text(current == nil ? entry.strings.upNextCaps : entry.strings.happeningNowCaps)
            .font(.caption2.weight(.semibold))
            .lineLimit(1)
          Text(upcoming.startDate.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale)))
          .font(.caption2.weight(.semibold))
          .monospacedDigit()
          .minimumScaleFactor(0.6)
          .lineLimit(1)
          Text(initialLetter(of: upcoming.title))
            .font(.title3.weight(.bold))
        }
        .padding(4)
      }
      .accessibilityLabel(reminderSummary(current: current, upcoming: upcoming, in: convention, reminderWindow: false))

    case .current(let convention, let event):
      let until = ConPawsScheduleResolver.effectiveEnd(of: event)
        .formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text("\(entry.strings.happeningNowCaps) · \(entry.strings.text(entry.strings.untilCapsFormat, until))")
            .font(.caption2)
            .lineLimit(2)
          Text(initialLetter(of: event.title)).font(.title3.weight(.bold))
        }
        .padding(4)
      }
      .accessibilityLabel("\(entry.strings.happeningNowCaps), \(entry.strings.text(entry.strings.untilCapsFormat, until)), \(event.title), \(entry.strings.noLaterSavedEventsShort)")

    case .empty(let convention):
      let title = convention == nil
        ? entry.strings.noConventionComplication
        : entry.strings.noPicksComplication
      ZStack {
        AccessoryWidgetBackground()
        Text(title)
          .font(.caption2.weight(.semibold))
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.65)
          .lineLimit(3)
      }
      .accessibilityLabel(
        convention == nil
          ? "\(entry.strings.noConventionTitle). \(entry.strings.noConventionHint)"
          : "\(entry.strings.noPicksTitle). \(entry.strings.noPicksHint)"
      )

    case .finished:
      ZStack {
        AccessoryWidgetBackground()
        Text(entry.strings.finishedComplication)
          .font(.caption2.weight(.semibold))
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.65)
          .lineLimit(3)
      }
      .accessibilityLabel(entry.strings.finishedTitle)
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

  private func reminderSummary(
    current: ConPawsEventSnapshot?,
    upcoming: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot,
    reminderWindow: Bool
  ) -> String {
    if reminderWindow, current == nil {
      let start = entry.strings.text(
        entry.strings.startsForA11yFormat,
        upcoming.title,
        spoken(to: upcoming.startDate, in: convention.timeZone)
      )
      let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: entry.locale, strings: entry.strings)
        .map { ". \($0)" } ?? ""
      return start + reminder
    }
    let next = entry.strings.text(
      entry.strings.nextEventA11yFormat,
      upcoming.title,
      spoken(to: upcoming.startDate, in: convention.timeZone)
    )
    let currentLine = current.map { "\(entry.strings.happeningNowCaps): \($0.title). " } ?? ""
    let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: entry.locale, strings: entry.strings)
      .map { ". \($0)" } ?? ""
    return "\(currentLine)\(next)\(reminder)"
  }

  private func leaveCenter(to date: Date, in timeZone: TimeZone) -> String {
    guard let minutes = ConPawsCountdown.leaveMinutes(from: entry.date, to: date) else {
      return compact(to: date, in: timeZone)
    }
    return String(minutes)
  }

  private func initialLetter(of title: String) -> String {
    title.first(where: { !$0.isWhitespace }).map { String($0).uppercased() } ?? "·"
  }
}

@available(iOS 17.0, *)
private struct ConPawsRectangularView: View {
  let entry: ConPawsWidgetEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      switch entry.state {
      case .countdown(let convention):
        ConPawsAccessoryEyebrow(title: convention.name)
        Text(spoken(to: convention.startDate, in: convention.timeZone))
          .font(.headline)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        if !convention.dateRangeLabel.isEmpty {
          Text(convention.dateRangeLabel)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

      case .leave(let convention, let current, let upcoming):
        ConPawsAccessoryEyebrow(
          title: ConPawsCountdown.leaveLead(
            from: entry.date,
            to: upcoming.startDate,
            timeZone: convention.timeZone,
            strings: entry.strings
          ),
          symbol: "bell"
        )
        if let current {
          Text(current.title).font(.headline).lineLimit(1)
          Text("\(entry.strings.upNextCaps) · \(upcoming.title)")
            .font(.caption)
            .lineLimit(1)
        } else {
          Text(upcoming.title).font(.headline).lineLimit(1)
        }
        if let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: entry.locale, strings: entry.strings) {
          Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        Text(nextDetail(for: upcoming, in: convention)).font(.caption2).foregroundStyle(.secondary).lineLimit(1)

      case .next(let convention, let current, let upcoming):
        if let current {
          ConPawsAccessoryEyebrow(title: entry.strings.happeningNowCaps)
          Text(current.title).font(.headline).lineLimit(1)
          Text("\(entry.strings.upNextCaps) · \(upcoming.title)")
            .font(.caption)
            .lineLimit(1)
        } else {
          ConPawsAccessoryEyebrow(title: entry.strings.upNextCaps)
          Text(upcoming.title)
            .font(.headline)
            .lineLimit(1)
        }
        if let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: entry.locale, strings: entry.strings) {
          Text(reminder).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
        Text(nextDetail(for: upcoming, in: convention))
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)

      case .current(let convention, let event):
        let end = ConPawsScheduleResolver.effectiveEnd(of: event)
          .formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))
        ConPawsAccessoryEyebrow(
          title: "\(entry.strings.happeningNowCaps) · \(entry.strings.text(entry.strings.untilCapsFormat, end))"
        )
        Text(event.title).font(.headline).lineLimit(2)
        Text(entry.strings.noLaterSavedEvents).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        if let place = event.place { Text(place).font(.caption2).foregroundStyle(.secondary).lineLimit(1) }

      case .empty(let convention):
        if convention == nil {
          ConPawsAccessoryEyebrow(title: entry.strings.noConventionTitle)
          Text(entry.strings.noConventionHint).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        } else {
          ConPawsAccessoryEyebrow(title: entry.strings.noPicksTitle)
          Text(entry.strings.noPicksHint).font(.caption).foregroundStyle(.secondary).lineLimit(2)
        }
      case .finished(let convention):
        ConPawsAccessoryEyebrow(title: entry.strings.finishedComplication)
        Text(entry.strings.finishedTitle).font(.caption).foregroundStyle(.secondary).lineLimit(2)
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

  private func nextDetail(
    for event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> String {
    let time = conPawsTimeLabel(
      event.startDate,
      now: entry.date,
      timeZone: convention.timeZone,
      locale: entry.locale
    )
    guard let place = event.place else { return time }
    return "\(time) · \(place)"
  }
}

/// Mark (or the walk symbol, in the leave window) plus one line of context.
/// Vibrant rendering repaints both exactly like the text.
private struct ConPawsAccessoryEyebrow: View {
  let title: String
  var symbol: String?

  var body: some View {
    HStack(spacing: 4) {
      if let symbol {
        Image(systemName: symbol)
          .font(.caption2.weight(.semibold))
          .accessibilityHidden(true)
      } else {
        ConPawsMark(size: 11)
      }
      Text(title)
        .lineLimit(1)
    }
    .font(.caption2.weight(.semibold))
    .widgetAccentable()
  }
}

@available(iOS 17.0, *)
private struct ConPawsInlineView: View {
  let entry: ConPawsWidgetEntry

  /// Inline sits on one line beside the clock and truncates hard, so the part
  /// worth reading -- the countdown or the time -- always goes first.
  var body: some View {
    switch entry.state {
    case .countdown(let convention):
      Text("\(spoken(to: convention.startDate, in: convention.timeZone)) · \(convention.name)")
    case .leave(let convention, let current, let upcoming):
      Label(nextSummary(current: current, upcoming: upcoming, convention: convention, reminderWindow: true), systemImage: "bell")
    case .next(let convention, let current, let upcoming):
      Text(nextSummary(current: current, upcoming: upcoming, convention: convention, reminderWindow: false))
    case .current(let convention, let event):
      let end = ConPawsScheduleResolver.effectiveEnd(of: event)
        .formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))
      Text("\(entry.strings.happeningNowCaps) · \(entry.strings.text(entry.strings.untilCapsFormat, end)) · \(event.title) · \(entry.strings.noLaterSavedEventsShort)")
    case .empty(let convention):
      Text(convention == nil
        ? "\(entry.strings.noConventionTitle) · \(entry.strings.noConventionHint)"
        : "\(entry.strings.noPicksTitle) · \(entry.strings.noPicksHint)")
    case .finished:
      Text("\(entry.strings.finishedComplication) · \(entry.strings.finishedTitle)")
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

  private func nextSummary(
    current: ConPawsEventSnapshot?,
    upcoming: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    reminderWindow: Bool
  ) -> String {
    let start = reminderWindow
      ? ConPawsCountdown.leaveLead(from: entry.date, to: upcoming.startDate, timeZone: convention.timeZone, strings: entry.strings)
      : "\(entry.strings.upNextCaps) · \(upcoming.startDate.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale)))"
    let currentText = current.map { "\(entry.strings.happeningNowCaps) · \($0.title) · " } ?? ""
    let reminder = conPawsReminderAtLabel(upcoming, timeZone: convention.timeZone, locale: entry.locale, strings: entry.strings)
      .map { " · \($0)" } ?? ""
    return "\(currentText)\(start) · \(upcoming.title)\(reminder)"
  }
}

// MARK: - Snapshot conveniences

private extension ConPawsConventionSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date { Date(timeIntervalSince1970: endAtMs / 1_000) }
  var timeZone: TimeZone {
    TimeZone(identifier: timeZoneIdentifier) ?? .autoupdatingCurrent
  }

  static let sample = ConPawsConventionSnapshot(
    id: "preview",
    name: "ConPaws Preview Con",
    startAtMs: Date.now.addingTimeInterval(-3_600).timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(172_800).timeIntervalSince1970 * 1_000,
    timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
    dateRangeLabel: "Today – Sunday",
    events: [.sampleCurrent, .sample, .sampleLater]
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

  static let sampleCurrent = ConPawsEventSnapshot(
    id: "preview-current",
    title: "Community Stories 101",
    startAtMs: Date.now.addingTimeInterval(-1_800).timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(1_800).timeIntervalSince1970 * 1_000,
    location: "Game Hall",
    room: nil,
    reminderMinutes: nil,
    ageRating: nil
  )

  static let sample = ConPawsEventSnapshot(
    id: "preview-event",
    title: "Opening Ceremonies",
    startAtMs: Date.now.addingTimeInterval(3_600).timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(7_200).timeIntervalSince1970 * 1_000,
    location: "Main Ballroom",
    room: nil,
    reminderMinutes: 15,
    ageRating: nil
  )

  static let sampleLater = ConPawsEventSnapshot(
    id: "preview-later",
    title: "Dance Practice 101",
    startAtMs: Date.now.addingTimeInterval(9_000).timeIntervalSince1970 * 1_000,
    endAtMs: Date.now.addingTimeInterval(12_600).timeIntervalSince1970 * 1_000,
    location: "Community Room",
    room: nil,
    reminderMinutes: nil,
    ageRating: nil
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
