import Foundation
import SwiftUI

struct ContentView: View {
  @ObservedObject var store: WatchScheduleStore

  var body: some View {
    TimelineView(.periodic(from: .now, by: 60)) { context in
      WatchRootView(
        snapshot: store.snapshot,
        now: context.date,
        isUsingSavedSchedule: store.isUsingSavedSchedule
      )
    }
    .preferredColorScheme(.dark)
  }
}

private struct WatchRootView: View {
  let snapshot: ConPawsSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool

  private var schedule: WatchScheduleProjection {
    WatchScheduleProjection(snapshot: snapshot, now: now)
  }

  /// The app's language, which is a setting on the phone rather than a setting
  /// on this watch. It arrives with the schedule and is threaded down by hand
  /// so no view can quietly fall back to the watch's own language.
  private var strings: ConPawsStrings { snapshot.strings }

  var body: some View {
    NavigationStack {
      ZStack {
        Color.black.ignoresSafeArea()

        if snapshot.conventions.isEmpty {
          EmptyScheduleView(
            title: strings.noScheduleTitle,
            message: strings.noScheduleMessage
          )
        } else if let convention = schedule.convention {
          if now < convention.startDate {
            PreConventionView(
              convention: convention,
              now: now,
              isUsingSavedSchedule: isUsingSavedSchedule,
              strings: strings
            )
          } else {
            ScheduleHomeView(
              schedule: schedule,
              isUsingSavedSchedule: isUsingSavedSchedule,
              strings: strings
            )
          }
        } else {
          EmptyScheduleView(
            title: strings.nothingUpcomingTitle,
            message: strings.nothingUpcomingMessage
          )
        }
      }
    }
    .environment(\.locale, snapshot.locale)
  }
}

private struct PreConventionView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
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
        .foregroundStyle(.cyan)
        .monospacedDigit()

        Text(strings.untilTheConvention)
          .font(.caption2)
          .foregroundStyle(.secondary)

        Text(convention.dateRangeLabel)
          .font(.caption)
          .multilineTextAlignment(.center)

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings)
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
          EventCard(
            label: strings.nowCaps,
            event: current,
            convention: convention,
            strings: strings,
            detail: WatchFormat.timeRange(current, in: convention, locale: locale)
          )
        }

        if let next = schedule.nextEvent, let convention = schedule.convention {
          EventCard(
            label: schedule.isLeaveWindow ? strings.leaveInCaps : strings.nextCaps,
            event: next,
            convention: convention,
            strings: strings
          ) {
            if schedule.isLeaveWindow {
              HStack(spacing: 4) {
                AdaptiveCountdownView(
                  target: next.startDate,
                  now: schedule.now,
                  timeZone: convention.timeZone,
                  strings: strings
                )
                Text("• \(nextEventTime(next, in: convention))")
              }
            } else {
              Text(nextEventTime(next, in: convention))
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
              detail: WatchFormat.location(event) ?? strings.scheduledLabel
            )
          }
        }

        if let convention = schedule.convention {
          NavigationLink {
            TodayListView(
              events: schedule.todayEvents,
              convention: convention,
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
            .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
          }
          .buttonStyle(.plain)
          .accessibilityLabel("\(strings.today), \(strings.events(schedule.todayEvents.count))")
        }

        if schedule.activeEvent == nil && schedule.nextEvent == nil {
          Text(strings.noMoreEventsToday)
            .font(.callout)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 44)
        }

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings)
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
  let detail: Detail

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    strings: ConPawsStrings,
    @ViewBuilder detail: () -> Detail
  ) {
    self.label = label
    self.event = event
    self.convention = convention
    self.strings = strings
    self.detail = detail()
  }

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    strings: ConPawsStrings,
    detail: String
  ) where Detail == Text {
    self.init(label: label, event: event, convention: convention, strings: strings) {
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
          .foregroundStyle(.cyan)
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
      .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
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
  let strings: ConPawsStrings

  var body: some View {
    Group {
      if events.isEmpty {
        EmptyScheduleView(
          title: strings.noEventsTodayTitle,
          message: strings.noEventsTodayMessage
        )
      } else {
        List(events) { event in
          NavigationLink {
            EventDetailView(event: event, convention: convention, strings: strings)
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(event.title)
                .font(.body.weight(.semibold))
                .lineLimit(2)
              Text(WatchFormat.timeRange(event, in: convention, locale: locale))
                .font(.caption2)
                .foregroundStyle(.secondary)
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

        if let minutes = event.reminderMinutes {
          Label {
            Text(
              strings.text(
                strings.leaveReminderFormat,
                strings.text(strings.minutesBeforeFormat, String(minutes))
              )
            )
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
  let strings: ConPawsStrings

  var body: some View {
    Label(strings.savedSchedule, systemImage: "iphone.and.arrow.forward")
      .font(.caption2)
      .foregroundStyle(.secondary)
      .accessibilityLabel(strings.savedScheduleA11y)
  }
}

private struct EmptyScheduleView: View {
  let title: String
  let message: String

  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "calendar")
        .font(.title2)
        .foregroundStyle(.cyan)
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

private struct WatchScheduleProjection {
  let now: Date
  let convention: ConPawsConventionSnapshot?
  let activeEvent: ConPawsEventSnapshot?
  let nextEvent: ConPawsEventSnapshot?
  let laterEvents: [ConPawsEventSnapshot]
  let todayEvents: [ConPawsEventSnapshot]
  let nextLeaveDate: Date?

  var isLeaveWindow: Bool {
    guard let nextEvent, let nextLeaveDate else { return false }
    return nextLeaveDate <= now && now < nextEvent.startDate
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
      nextEvent = nil
      laterEvents = []
      todayEvents = []
      nextLeaveDate = nil
      return
    }

    let events = selected.events.sorted { $0.startAtMs < $1.startAtMs }
    activeEvent = events.enumerated().compactMap { index, event in
      guard event.startDate <= now else { return nil }
      let nextStart = events.indices.contains(index + 1) ? events[index + 1].startDate : nil
      let fallbackEnd = min(nextStart ?? .distantFuture, event.startDate.addingTimeInterval(3_600))
      let effectiveEnd = event.endDate ?? fallbackEnd
      return now < effectiveEnd ? event : nil
    }.last

    let upcoming = events.filter { $0.startDate > now }
    nextEvent = upcoming.first
    laterEvents = Array(upcoming.dropFirst().prefix(2))

    var calendar = Calendar.autoupdatingCurrent
    calendar.timeZone = selected.timeZone
    todayEvents = events.filter { calendar.isDate($0.startDate, inSameDayAs: now) }

    if let next = upcoming.first, let minutes = next.reminderMinutes {
      nextLeaveDate = next.startDate.addingTimeInterval(-Double(minutes) * 60)
    } else {
      nextLeaveDate = nil
    }
  }
}

private enum WatchFormat {
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
    reminderMinutes: nil
  )
  let next = ConPawsEventSnapshot(
    id: "next",
    title: "Next",
    startAtMs: now.addingTimeInterval(1_200).timeIntervalSince1970 * 1_000,
    endAtMs: nil,
    location: nil,
    room: nil,
    reminderMinutes: 30
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
