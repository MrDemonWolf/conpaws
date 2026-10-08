import Foundation
import SwiftUI

struct ContentView: View {
  @ObservedObject var store: WatchScheduleStore

  var body: some View {
    // NavigationStack OUTSIDE the TimelineView: with the stack inside, the
    // minute tick that changed the root branch (con started, snapshot
    // emptied) rebuilt the stack and popped the reader out of a detail
    // screen. `.everyMinute` aligns ticks to the minute boundary and is the
    // cadence the system throttles correctly in Always On.
    NavigationStack {
      TimelineView(.everyMinute) { context in
        WatchRootView(
          snapshot: store.snapshot,
          now: context.date,
          isUsingSavedSchedule: store.isUsingSavedSchedule(at: context.date),
          snapshotDate: store.snapshotDate
        )
      }
    }
  }
}

private struct WatchRootView: View {
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  let snapshot: ConPawsSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  let snapshotDate: Date?

  private var schedule: WatchScheduleProjection {
    WatchScheduleProjection(snapshot: snapshot, now: now)
  }

  /// The app's language, which is a setting on the phone rather than a setting
  /// on this watch. It arrives with the schedule and is threaded down by hand
  /// so no view can quietly fall back to the watch's own language.
  private var strings: ConPawsStrings { snapshot.strings }

  var body: some View {
    Group {
      switch schedule.state {
      case .noConvention:
        EmptyScheduleView(
          title: strings.noConventionTitle,
          message: strings.noConventionWatchMessage
        )
      case .countdown(let convention):
        PreConventionView(
          convention: convention,
          now: now,
          isUsingSavedSchedule: isUsingSavedSchedule,
          snapshotDate: snapshotDate,
          strings: strings
        )
      case .noPicks:
        EmptyScheduleView(
          title: strings.noPicksTitle,
          message: strings.noPicksWatchMessage
        )
      case .next, .currentOnly, .finished:
        ScheduleHomeView(
          schedule: schedule,
          isUsingSavedSchedule: isUsingSavedSchedule,
          snapshotDate: snapshotDate,
          strings: strings
        )
      }
    }
    // Always On: soften everything but keep the countdown legible. Event
    // titles and rooms are readable at a glance in a crowded hall, so they
    // redact on the dimmed wrist-down display.
    .opacity(isLuminanceReduced ? 0.7 : 1)
    .privacySensitive(isLuminanceReduced)
    .environment(\.locale, snapshot.locale)
  }
}

private struct PreConventionView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    // Kept scrollable for large Dynamic Type, but the content is sized to
    // fit without scrolling at default sizes. A decorative mark used to sit
    // above the title and pushed the date range off the bottom of a 46mm
    // screen -- it was already hidden from VoiceOver, so it cost a line and
    // carried nothing.
    ScrollView {
      VStack(spacing: 8) {
        Text(convention.name)
          .font(.headline)
          .multilineTextAlignment(.center)

        AdaptiveCountdownView(
          target: convention.startDate,
          now: now,
          timeZone: convention.timeZone,
          strings: strings
        )
        .font(.title2.bold())
        .foregroundStyle(Color.accentColor)
        .monospacedDigit()

        Text(strings.untilTheConvention)
          .font(.caption2)
          .foregroundStyle(.secondary)

        Text(convention.dateRangeLabel)
          .font(.caption)
          .multilineTextAlignment(.center)

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: now)
        }
      }
      .padding(.horizontal, 8)
      .padding(.top, 10)
      .accessibilityElement(children: .combine)
    }
    .navigationTitle(strings.comingUpTitle)
  }
}

private struct ScheduleHomeView: View {
  @Environment(\.locale) private var locale
  let schedule: WatchScheduleProjection
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 8) {
        if let convention = schedule.convention {
          Text(convention.name)
            .font(.caption.bold())
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .padding(.horizontal, 4)
        }

        if let current = schedule.activeEvent, let convention = schedule.convention {
          let label = schedule.nextEvent == nil
            ? "\(strings.happeningNowCaps) · \(strings.text(strings.untilCapsFormat, WatchFormat.time(ConPawsScheduleResolver.effectiveEnd(of: current), in: convention, locale: locale)))"
            : strings.happeningNowCaps
          EventCard(
            label: label,
            event: current,
            convention: convention,
            strings: strings,
            detail: schedule.nextEvent == nil
              ? strings.noLaterSavedEvents
              : WatchFormat.timeRange(current, in: convention, locale: locale)
          )
        }

        if let next = schedule.nextEvent, let convention = schedule.convention {
          EventCard(
            label: schedule.isLeaveWindow ? strings.startsInCaps : strings.upNextCaps,
            event: next,
            convention: convention,
            strings: strings
          ) {
            VStack(alignment: .leading, spacing: 1) {
              if schedule.isLeaveWindow {
                AdaptiveCountdownView(
                  target: next.startDate,
                  now: schedule.now,
                  timeZone: convention.timeZone,
                  strings: strings
                )
                .font(.title3.bold())
                .monospacedDigit()
                .foregroundStyle(Color.accentColor)
              } else {
                Text(nextEventTime(next, in: convention))
              }
              if let reminder = WatchFormat.reminderAt(next, in: convention, locale: locale, strings: strings) {
                Text(reminder)
              }
            }
          }
        }

        if !schedule.laterEvents.isEmpty, let convention = schedule.convention {
          Text(strings.laterLabel)
            .font(.caption2.bold())
            .foregroundStyle(.secondary)
            .padding(.horizontal, 4)

          ForEach(schedule.laterEvents) { event in
            EventCard(
              label: WatchFormat.time(event.startDate, in: convention, locale: locale),
              event: event,
              convention: convention,
              strings: strings,
              accented: false,
              detail: WatchFormat.location(event) ?? strings.scheduledLabel
            )
          }
        }

        if let convention = schedule.convention {
          NavigationLink {
            TodayListView(
              events: schedule.todayEvents,
              convention: convention,
              activeEventID: schedule.activeEvent?.id,
              scheduleState: schedule.state,
              strings: strings
            )
          } label: {
            HStack {
              Label(strings.today, systemImage: "list.bullet")
              Spacer()
              Text("\(schedule.todayEvents.count)")
                .foregroundStyle(.secondary)
            }
            .font(.body)
            .frame(minHeight: 44)
            .padding(.horizontal, 10)
            .background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
          }
          .buttonStyle(.plain)
          .accessibilityLabel("\(strings.today), \(strings.events(schedule.todayEvents.count))")
        }

        if case .finished = schedule.state {
          VStack(spacing: 2) {
            Text(strings.finishedComplication)
            Text(strings.finishedTitle)
          }
            .font(.callout)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 44)
        }

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: schedule.now)
            .frame(maxWidth: .infinity)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
  }

  private func nextEventTime(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> String {
    WatchFormat.nextEventTime(
      event.startDate,
      relativeTo: schedule.now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }
}

private struct EventCard<Detail: View>: View {
  let label: String
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings
  let accented: Bool
  let detail: Detail

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    strings: ConPawsStrings,
    accented: Bool = true,
    @ViewBuilder detail: () -> Detail
  ) {
    self.label = label
    self.event = event
    self.convention = convention
    self.strings = strings
    self.accented = accented
    self.detail = detail()
  }

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    strings: ConPawsStrings,
    accented: Bool = true,
    detail: String
  ) where Detail == Text {
    self.init(
      label: label,
      event: event,
      convention: convention,
      strings: strings,
      accented: accented
    ) {
      Text(detail)
    }
  }

  var body: some View {
    NavigationLink {
      EventDetailView(event: event, convention: convention, strings: strings)
    } label: {
      VStack(alignment: .leading, spacing: 3) {
        // Callers hand this over in the case it is drawn in. Upper-casing here
        // instead would also hit the clock times the later-event cards use as
        // their label, and would do it with the wrong language's casing rules.
        Text(label)
          .font(.caption2.bold())
          .foregroundStyle(Color.accentColor)
        Text(event.title)
          .font(.headline)
          .lineLimit(2)
        detail
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, 10)
      .padding(.vertical, 7)
      .background(.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}

private struct TodayListView: View {
  @Environment(\.locale) private var locale
  let events: [ConPawsEventSnapshot]
  let convention: ConPawsConventionSnapshot
  var activeEventID: String?
  let scheduleState: ConPawsScheduleState
  let strings: ConPawsStrings

  var body: some View {
    Group {
      if events.isEmpty {
        switch scheduleState {
        case .noConvention:
          EmptyScheduleView(title: strings.noConventionTitle, message: strings.noConventionWatchMessage)
        case .noPicks:
          EmptyScheduleView(title: strings.noPicksTitle, message: strings.noPicksWatchMessage)
        case .finished:
          EmptyScheduleView(title: strings.finishedComplication, message: strings.finishedTitle)
        case .next, .countdown:
          EmptyScheduleView(title: strings.noEventsTodayTitle, message: strings.noEventsTodayMessage)
        case .currentOnly:
          EmptyScheduleView(title: strings.happeningNowCaps, message: strings.noLaterSavedEvents)
        }
      } else {
        List(events) { event in
          NavigationLink {
            EventDetailView(event: event, convention: convention, strings: strings)
          } label: {
            HStack(spacing: 6) {
              if event.id == activeEventID {
                // Mockup frame 2: the running event is marked, not styled by
                // color alone — a bar plus the accent both carry it.
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                  .fill(Color.accentColor)
                  .frame(width: 3)
                  .accessibilityHidden(true)
              }
              VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                  .font(.body.weight(.semibold))
                  .lineLimit(2)
                Text(WatchFormat.timeRange(event, in: convention, locale: locale))
                  .font(.caption2)
                  .foregroundStyle(
                    event.id == activeEventID
                      ? AnyShapeStyle(Color.accentColor)
                      : AnyShapeStyle(.secondary)
                  )
              }
            }
            .frame(minHeight: 44, alignment: .leading)
          }
          .accessibilityLabel(
            "\(event.title), \(WatchFormat.timeRange(event, in: convention, locale: locale))"
          )
        }
        // ponytail: plain, not .carousel — carousel scales rows toward the
        // screen center, so a single-event day renders as an oversized slab.
        .listStyle(.plain)
      }
    }
    .navigationTitle(strings.today)
  }
}

private struct EventDetailView: View {
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Text(event.title)
          .font(.headline)
          .fixedSize(horizontal: false, vertical: true)

        Label {
          Text(WatchFormat.timeRange(event, in: convention, locale: locale))
        } icon: {
          Image(systemName: "clock")
            .accessibilityHidden(true)
        }

        if let location = WatchFormat.location(event) {
          Label {
            Text(location)
          } icon: {
            Image(systemName: "mappin.and.ellipse")
              .accessibilityHidden(true)
          }
        }

        if let reminder = WatchFormat.reminderAt(event, in: convention, locale: locale, strings: strings) {
          Label {
            Text(reminder)
          } icon: {
            Image(systemName: "bell")
              .accessibilityHidden(true)
          }
        }
      }
      .font(.callout)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
    }
    .navigationTitle(strings.eventTitle)
  }
}

private struct AdaptiveCountdownView: View {
  let target: Date
  let now: Date
  let timeZone: TimeZone
  let strings: ConPawsStrings

  var body: some View {
    if target.timeIntervalSince(now) < 86_400, target > now {
      // Inside the last day the app keeps a live timer. Unlike a widget it is
      // on screen and refreshing, so it can honour per-second precision -- and
      // this is the stretch where that precision is worth having.
      Text(timerInterval: now...target, countsDown: true)
        .accessibilityLabel(
          strings.remaining(
            WatchFormat.countdownDuration(from: now, to: target, in: timeZone, strings: strings)
          )
        )
    } else {
      // Further out, read the same ladder the complication and the iPhone
      // Lock Screen read. The app used to say "12 D 9 H" here while its own
      // complication said "In 12 days" about the same wait.
      Text(ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings))
        .accessibilityLabel(
          ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings)
        )
    }
  }
}

private struct SavedScheduleLabel: View {
  @Environment(\.locale) private var locale
  let strings: ConPawsStrings
  var snapshotDate: Date?
  let now: Date

  private var updatedText: String? {
    guard let snapshotDate else { return nil }
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = locale
    formatter.unitsStyle = .short
    return formatter.localizedString(for: snapshotDate, relativeTo: now)
  }

  var body: some View {
    // Modifiers go on the stack: an `if` is not a view to modify.
    if let updatedText {
      VStack(alignment: .leading, spacing: 1) {
        Text(strings.text(strings.lastUpdatedFormat, updatedText))
        Text("\(strings.staleHintShort) · \(strings.openOnIphone)")
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(strings.text(strings.staleA11yFormat, updatedText))
    }
  }
}

private struct EmptyScheduleView: View {
  let title: String
  let message: String

  var body: some View {
    // Scrollable for the same reason PreConventionView is: at accessibility
    // type sizes the message — the only text telling the user how to recover
    // — clipped with no way to reach it.
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: "calendar")
          .font(.title2)
          .foregroundStyle(Color.accentColor)
          .accessibilityHidden(true)
        Text(title)
          .font(.headline)
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
      }
      .padding(.horizontal, 10)
      .accessibilityElement(children: .combine)
    }
  }
}

private struct WatchScheduleProjection {
  let now: Date
  let state: ConPawsScheduleState

  var convention: ConPawsConventionSnapshot? {
    switch state {
    case .noConvention: nil
    case .countdown(let convention), .finished(let convention), .noPicks(let convention): convention
    case .next(let convention, _, _), .currentOnly(let convention, _): convention
    }
  }

  var activeEvent: ConPawsEventSnapshot? {
    switch state {
    case .next(_, let current, _): current
    case .currentOnly(_, let event): event
    case .noConvention, .countdown, .finished, .noPicks: nil
    }
  }

  var nextEvent: ConPawsEventSnapshot? {
    if case .next(_, _, let upcoming) = state { return upcoming }
    return nil
  }

  var laterEvents: [ConPawsEventSnapshot] {
    guard let convention else { return [] }
    return Array(
      convention.events
        .filter { $0.startDate > now && $0.id != nextEvent?.id }
        .sorted { $0.startAtMs < $1.startAtMs }
        .prefix(2)
    )
  }

  var todayEvents: [ConPawsEventSnapshot] {
    guard let convention else { return [] }
    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = convention.timeZone
    return convention.events
      .filter { calendar.isDate($0.startDate, inSameDayAs: now) }
      .sorted { $0.startAtMs < $1.startAtMs }
  }

  var isLeaveWindow: Bool {
    guard let nextEvent else { return false }
    return ConPawsScheduleResolver.isInReminderWindow(nextEvent, now: now)
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    self.now = now
    state = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
  }
}

private enum WatchFormat {
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

  static func location(_ event: ConPawsEventSnapshot) -> String? {
    let values = [event.room, event.location]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    if values.count == 2, values[0] == values[1] { return values[0] }
    return values.isEmpty ? nil : values.joined(separator: " • ")
  }

  /// How long the wait is, spoken as two units.
  ///
  /// Deliberately without "remaining" or its equivalents: several languages
  /// phrase that as a prefix rather than a suffix, so the caller wraps it.
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

#if DEBUG
func runWatchScheduleSelfCheck() {
  let now = Date(timeIntervalSince1970: 2_000_000_000)
  let current = ConPawsEventSnapshot(
    id: "current",
    title: "Current",
    startAtMs: now.addingTimeInterval(-600).timeIntervalSince1970 * 1_000,
    endAtMs: now.addingTimeInterval(600).timeIntervalSince1970 * 1_000,
    location: nil,
    room: nil,
    reminderMinutes: nil,
    ageRating: nil
  )
  let next = ConPawsEventSnapshot(
    id: "next",
    title: "Next",
    startAtMs: now.addingTimeInterval(1_200).timeIntervalSince1970 * 1_000,
    endAtMs: nil,
    location: nil,
    room: nil,
    reminderMinutes: 30,
    ageRating: nil
  )
  let convention = ConPawsConventionSnapshot(
    id: "con",
    name: "Convention",
    startAtMs: now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000,
    endAtMs: now.addingTimeInterval(86_400).timeIntervalSince1970 * 1_000,
    timeZoneIdentifier: "UTC",
    dateRangeLabel: "Today",
    events: [current, next]
  )
  let schedule = WatchScheduleProjection(
    snapshot: ConPawsSnapshot(
      schemaVersion: 1,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [convention]
    ),
    now: now
  )
  assert(schedule.activeEvent?.id == "current")
  assert(schedule.nextEvent?.id == "next")
  assert(schedule.isLeaveWindow)
  let deepLink = ConPawsSnapshotStore.appURL(conventionID: "con /?#")
  let deepLinkComponents = deepLink.flatMap {
    URLComponents(url: $0, resolvingAgainstBaseURL: false)
  }
  // The id travels as a query item, not a path segment, because the route it
  // opens is /schedule reading a conventionId param. Round-tripping an id full
  // of URL metacharacters is what this checks: percent encoding on the way out,
  // the original string on the way back.
  assert(deepLinkComponents?.host == "schedule")
  assert(
    deepLinkComponents?.queryItems?.first { $0.name == "conventionId" }?.value == "con /?#"
  )
  assert(
    WatchFormat.nextEventTime(
      now.addingTimeInterval(86_400),
      relativeTo: now,
      in: convention,
      // Pinned rather than read from the device: the prefix compared below is
      // English, so a tester on a German Mac would fail this for the wrong
      // reason.
      locale: Locale(identifier: "en_US"),
      strings: .english
    ).hasPrefix("Tomorrow · ")
  )
  // Beyond a day out the app reads the shared ladder, not its own wording.
  assert(
    ConPawsCountdown.label(
      from: now,
      to: now.addingTimeInterval(32 * 3_600),
      timeZone: TimeZone(identifier: "UTC")!,
      strings: .english
    ) == "Tomorrow"
  )
  // The same wait, in the language the snapshot asked for rather than the
  // watch's. This is the whole point of carrying localeIdentifier across.
  assert(
    ConPawsCountdown.label(
      from: now,
      to: now.addingTimeInterval(32 * 3_600),
      timeZone: TimeZone(identifier: "UTC")!,
      strings: ConPawsStrings.resolve("sv")
    ) == "I morgon"
  )
}
#endif
