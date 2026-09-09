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
  case current(ConPawsConventionSnapshot, event: ConPawsEventSnapshot, next: ConPawsEventSnapshot?)
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
    case .countdown(let convention),
      .next(let convention, _, _),
      .current(let convention, _, _):
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
    // A pin that no longer resolves falls through to automatic rather than
    // rendering an error. Automatic is the watch's rule: keep a convention
    // whose window is still open or whose events reach into the future, then
    // take the earliest-starting one -- the active convention when there is
    // one, else the nearest upcoming.
    let convention = configuration.convention.flatMap { selected in
      snapshot.conventions.first { $0.id == selected.id }
    } ?? snapshot.conventions
      .filter { $0.isCurrentOrUpcoming(at: date) }
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

    let plan = ConPawsPlanTimeline(events: convention.events, now: date)
    let current = plan.currentEvent
    let upcoming = plan.nextEvent

    if let current {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        locale: locale,
        strings: strings,
        state: .current(convention, event: current, next: upcoming)
      )
    }

    guard let upcoming else {
      return ConPawsWidgetEntry(
        date: date,
        configuration: configuration,
        locale: locale,
        strings: strings,
        state: .empty(convention)
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
    case .next, .current, .empty:
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
    case .current(let convention, let event, let next):
      let plan = ConPawsPlanTimeline(events: convention.events, now: entry.date)
      if let currentEnd = plan.currentEventEnd {
        candidates.append(currentEnd)
      }
      if let next {
        candidates.append(next.startDate)
      }
      candidates.append(convention.endDate)
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
      scheduleBody(convention: convention, current: current, upcoming: upcoming)
    case .current(let convention, let event, _):
      if family == .systemSmall {
        ConPawsSmallCurrentView(
          event: event,
          convention: convention,
          strings: entry.strings
        )
      } else {
        scheduleBody(
          convention: convention,
          current: event,
          upcoming: event
        )
      }
    case .empty(let convention):
      ConPawsEmptyView(convention: convention, family: family, strings: entry.strings)
    }
  }

  @ViewBuilder
  private func scheduleBody(
    convention: ConPawsConventionSnapshot,
    current: ConPawsEventSnapshot?,
    upcoming: ConPawsEventSnapshot
  ) -> some View {
    switch family {
    case .systemMedium:
      ConPawsMediumView(
        entryDate: entry.date,
        convention: convention,
        current: current,
        upcoming: upcoming,
        strings: entry.strings
      )
    case .systemLarge:
      ConPawsLargeView(
        entryDate: entry.date,
        convention: convention,
        current: current,
        upcoming: upcoming,
        strings: entry.strings
      )
    default:
      ConPawsSmallNextView(
        entryDate: entry.date,
        upcoming: upcoming,
        convention: convention,
        strings: entry.strings
      )
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
    .description("Convention countdowns, current stops, chosen leave times, and next events.")
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
  let upcoming: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(strings.nextCaps)
        .font(.caption2.weight(.bold))
        .foregroundStyle(ConPawsBrand.smallText)
        .widgetAccentable()
      Spacer(minLength: 2)
      Text(
        conPawsTimeLabel(
          upcoming.startDate,
          now: entryDate,
          timeZone: convention.timeZone,
          locale: locale
        )
      )
      .font(.footnote.weight(.semibold))
      .monospacedDigit()
      .foregroundStyle(ConPawsBrand.smallText)
      .widgetAccentable()
      Text(upcoming.title)
        .font(.footnote.weight(.semibold))
        .lineLimit(1)
      if let place = upcoming.place {
        Text(place)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 2)
      Text(convention.name)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct ConPawsSmallCurrentView: View {
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(event.hasPersonalEnd ? leaveLabel : strings.now)
        .font(.caption2.weight(.bold))
        .foregroundStyle(ConPawsBrand.smallText)
        .lineLimit(1)
        .widgetAccentable()
      Spacer(minLength: 2)
      Text(event.title)
        .font(.headline)
        .lineLimit(2)
      if let place = event.place {
        Text(place)
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 2)
      Text(convention.name)
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .accessibilityElement(children: .combine)
  }

  private var leaveLabel: String {
    guard let end = event.endDate else { return strings.now }
    return strings.text(
      strings.inlineLeaveFormat,
      end.formatted(conPawsClockStyle(convention.timeZone, locale: locale))
    )
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
      if let current {
        nowRow(current)
      }
      ForEach(upcomingRows) { event in
        eventRow(event)
      }
      Spacer(minLength: 0)
    }
  }

  /// Current event (if any) plus the next rows by personal start time.
  private var upcomingRows: [ConPawsEventSnapshot] {
    let capacity = 3 - (current == nil ? 0 : 1)
    guard capacity > 0 else { return [] }
    return Array(
      ConPawsPlanTimeline(events: convention.events, now: entryDate).events
        .filter { $0.startDate > entryDate }
        .prefix(capacity)
    )
  }

  private func nowRow(_ event: ConPawsEventSnapshot) -> some View {
    HStack(spacing: 8) {
      ConPawsRail()
      timeColumn(nowLabel(event))
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

  private func nowLabel(_ event: ConPawsEventSnapshot) -> String {
    guard let end = event.endDate, event.hasPersonalEnd else { return strings.now }
    return strings.text(
      strings.inlineLeaveFormat,
      end.formatted(conPawsClockStyle(convention.timeZone, locale: locale))
    )
  }

  private func eventRow(_ event: ConPawsEventSnapshot) -> some View {
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
    .padding(.horizontal, 7)
    .accessibilityElement(children: .combine)
  }

  private func timeColumn(_ label: String) -> some View {
    Text(label)
      .font(.caption2.weight(.semibold))
      .monospacedDigit()
      .foregroundStyle(ConPawsBrand.smallText)
      .lineLimit(1)
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
    let upcomingAll = ConPawsPlanTimeline(events: convention.events, now: entryDate).events
      .filter { $0.startDate > entryDate }

    let capacity = 5
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
        Text(nowLabel(event))
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

  private func nowLabel(_ event: ConPawsEventSnapshot) -> String {
    guard let end = event.endDate else { return strings.now }
    let clock = end.formatted(conPawsClockStyle(convention.timeZone, locale: locale))
    let endLabel = event.hasPersonalEnd
      ? strings.text(strings.inlineLeaveFormat, clock)
      : strings.ends(clock)
    return "\(strings.now) · \(endLabel)"
  }

  private func eventRow(_ event: ConPawsEventSnapshot) -> some View {
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
    .padding(.horizontal, 8)
    .accessibilityElement(children: .combine)
  }
}

// MARK: - Empty

private struct ConPawsEmptyView: View {
  let convention: ConPawsConventionSnapshot?
  let family: WidgetFamily
  let strings: ConPawsStrings

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
      Text(emptyTitle)
        .font(.headline)
        .multilineTextAlignment(.center)
      Text(emptyMessage)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
        .lineLimit(2)
    }
    .accessibilityElement(children: .combine)
  }

  private var emptyTitle: String {
    guard let convention else { return strings.noScheduleTitle }
    return convention.events.isEmpty ? strings.noUpcomingEvents : strings.allDoneTitle
  }

  private var emptyMessage: String {
    guard let convention else { return strings.noScheduleMessage }
    return convention.events.isEmpty ? strings.starHint : strings.noMoreEventsToday
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

    case .next(let convention, _, let upcoming):
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text(
            upcoming.startDate.formatted(
              conPawsClockStyle(convention.timeZone, locale: entry.locale)
            )
          )
          .font(.caption2.weight(.semibold))
          .monospacedDigit()
          .minimumScaleFactor(0.6)
          .lineLimit(1)
          Text(initialLetter(of: upcoming.title))
            .font(.title3.weight(.bold))
        }
        .padding(4)
      }
      .accessibilityLabel(
        entry.strings.text(
          entry.strings.nextA11yFormat,
          upcoming.title,
          spoken(to: upcoming.startDate, in: convention.timeZone)
        )
      )

    case .current(let convention, let event, _):
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Text(entry.strings.now)
            .font(.caption2.weight(.semibold))
          Text(initialLetter(of: event.title))
            .font(.title3.weight(.bold))
        }
        .padding(4)
      }
      .accessibilityLabel(
        "\(entry.strings.now), \(event.title), \(currentDetail(event, convention: convention))"
      )

    case .empty(let convention):
      ZStack {
        AccessoryWidgetBackground()
        ConPawsMarkShape()
          .padding(9)
      }
      .accessibilityLabel(
        convention == nil
          ? entry.strings.noScheduleMessage
          : convention?.events.isEmpty == true
            ? entry.strings.starHint
            : entry.strings.allDoneTitle
      )
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

  private func initialLetter(of title: String) -> String {
    title.first(where: { !$0.isWhitespace }).map { String($0).uppercased() } ?? "·"
  }

  private func currentDetail(
    _ event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot
  ) -> String {
    guard let end = event.endDate else { return event.place ?? convention.name }
    let clock = end.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))
    return event.hasPersonalEnd
      ? entry.strings.text(entry.strings.inlineLeaveFormat, clock)
      : entry.strings.ends(clock)
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

      case .next(let convention, let current, let upcoming):
        ConPawsAccessoryEyebrow(title: convention.name)
        // A running event owns the headline -- what is happening now beats
        // what comes later; the next event keeps the detail line either way.
        if let current {
          Text("\(entry.strings.now) · \(current.title)")
            .font(.headline)
            .lineLimit(1)
        } else {
          Text(upcoming.title)
            .font(.headline)
            .lineLimit(1)
        }
        Text(nextDetail(for: upcoming, in: convention))
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)

      case .current(let convention, let event, let next):
        ConPawsAccessoryEyebrow(title: convention.name)
        Text("\(entry.strings.now) · \(event.title)")
          .font(.headline)
          .lineLimit(1)
        Text(currentDetail(for: event, next: next, in: convention))
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)

      case .empty(let convention):
        ConPawsAccessoryEyebrow(title: convention?.name ?? "ConPaws")
        Text(
          convention == nil
            ? entry.strings.noScheduleMessage
            : convention?.events.isEmpty == true
              ? entry.strings.starHint
              : entry.strings.allDoneTitle
        )
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

  private func currentDetail(
    for event: ConPawsEventSnapshot,
    next: ConPawsEventSnapshot?,
    in convention: ConPawsConventionSnapshot
  ) -> String {
    if let end = event.endDate {
      let clock = end.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))
      let timing = event.hasPersonalEnd
        ? entry.strings.text(entry.strings.inlineLeaveFormat, clock)
        : entry.strings.ends(clock)
      if let next { return "\(timing) · \(next.title)" }
      return timing
    }
    return event.place ?? convention.name
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
    case .next(let convention, _, let upcoming):
      Text(
        "\(upcoming.startDate.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale))) · \(upcoming.title)"
      )
    case .current(let convention, let event, _):
      if let end = event.endDate, event.hasPersonalEnd {
        Label(
          "\(entry.strings.text(entry.strings.inlineLeaveFormat, end.formatted(conPawsClockStyle(convention.timeZone, locale: entry.locale)))) · \(event.title)",
          systemImage: "figure.walk"
        )
      } else {
        Text("\(entry.strings.now) · \(event.title)")
      }
    case .empty(let convention):
      Text(
        convention == nil
          ? entry.strings.noScheduleTitle
          : convention?.events.isEmpty == true
            ? entry.strings.noUpcomingEvents
            : entry.strings.allDoneTitle
      )
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
  var startDate: Date { plannedStartDate }
  var endDate: Date? { plannedEndDate }
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

  // The redesign's composed strings, in the exact wording the mocks carry.
  assert(ConPawsStrings.english.moreToday(3) == "+3 more today")
  assert(ConPawsStrings.english.starred(8) == "8 events starred")
  assert(ConPawsStrings.english.ends("1:00 AM") == "ends 1:00 AM")
  assert(
    ConPawsStrings.english.firstTomorrow("Fursuit Care Workshop", "9:00 AM")
      == "First event tomorrow: Fursuit Care Workshop, 9:00 AM."
  )

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
