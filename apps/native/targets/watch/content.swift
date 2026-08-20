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

  var body: some View {
    NavigationStack {
      ZStack {
        Color.black.ignoresSafeArea()

        if snapshot.conventions.isEmpty {
          EmptyScheduleView(
            title: "No schedule yet",
            message: "Open ConPaws on your iPhone to sync a convention."
          )
        } else if let convention = schedule.convention {
          if now < convention.startDate {
            PreConventionView(
              convention: convention,
              now: now,
              isUsingSavedSchedule: isUsingSavedSchedule
            )
          } else {
            ScheduleHomeView(
              schedule: schedule,
              isUsingSavedSchedule: isUsingSavedSchedule
            )
          }
        } else {
          EmptyScheduleView(
            title: "Nothing upcoming",
            message: "Your saved conventions have ended."
          )
        }
      }
    }
  }
}

private struct PreConventionView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: "calendar.badge.clock")
          .font(.title2)
          .foregroundStyle(.cyan)
          .accessibilityHidden(true)

        Text(convention.name)
          .font(.headline)
          .multilineTextAlignment(.center)

        AdaptiveCountdownView(
          target: convention.startDate,
          now: now,
          timeZone: convention.timeZone
        )
        .font(.title2.bold())
        .foregroundStyle(.cyan)
        .monospacedDigit()

        Text("Until the convention")
          .font(.caption2)
          .foregroundStyle(.secondary)

        Text(convention.dateRangeLabel)
          .font(.caption)
          .multilineTextAlignment(.center)

        if isUsingSavedSchedule {
          SavedScheduleLabel()
        }
      }
      .padding(.horizontal, 8)
      .padding(.top, 10)
      .accessibilityElement(children: .combine)
    }
    .navigationTitle("Coming Up")
  }
}

private struct ScheduleHomeView: View {
  let schedule: WatchScheduleProjection
  let isUsingSavedSchedule: Bool

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
            label: "Now",
            event: current,
            convention: convention,
            detail: WatchFormat.timeRange(current, in: convention)
          )
        }

        if let next = schedule.nextEvent, let convention = schedule.convention {
          EventCard(
            label: schedule.isLeaveWindow ? "Leave in" : "Next",
            event: next,
            convention: convention
          ) {
            if schedule.isLeaveWindow {
              HStack(spacing: 4) {
                AdaptiveCountdownView(
                  target: next.startDate,
                  now: schedule.now,
                  timeZone: convention.timeZone
                )
                Text(
                  "• \(WatchFormat.nextEventTime(next.startDate, relativeTo: schedule.now, in: convention))"
                )
              }
            } else {
              Text(
                WatchFormat.nextEventTime(next.startDate, relativeTo: schedule.now, in: convention)
              )
            }
          }
        }

        if !schedule.laterEvents.isEmpty, let convention = schedule.convention {
          Text("Later")
            .font(.caption2.bold())
            .foregroundStyle(.secondary)
            .padding(.horizontal, 4)

          ForEach(schedule.laterEvents) { event in
            EventCard(
              label: WatchFormat.time(event.startDate, in: convention),
              event: event,
              convention: convention,
              detail: WatchFormat.location(event) ?? "Scheduled"
            )
          }
        }

        if let convention = schedule.convention {
          NavigationLink {
            TodayListView(events: schedule.todayEvents, convention: convention)
          } label: {
            HStack {
              Label("Today", systemImage: "list.bullet")
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
          .accessibilityLabel("Today, \(schedule.todayEvents.count) events")
        }

        if schedule.activeEvent == nil && schedule.nextEvent == nil {
          Text("No more events today")
            .font(.callout)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 44)
        }

        if isUsingSavedSchedule {
          SavedScheduleLabel()
            .frame(maxWidth: .infinity)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle("Schedule")
  }
}

private struct EventCard<Detail: View>: View {
  let label: String
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let detail: Detail

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    @ViewBuilder detail: () -> Detail
  ) {
    self.label = label
    self.event = event
    self.convention = convention
    self.detail = detail()
  }

  init(
    label: String,
    event: ConPawsEventSnapshot,
    convention: ConPawsConventionSnapshot,
    detail: String
  ) where Detail == Text {
    self.init(label: label, event: event, convention: convention) {
      Text(detail)
    }
  }

  var body: some View {
    NavigationLink {
      EventDetailView(event: event, convention: convention)
    } label: {
      VStack(alignment: .leading, spacing: 3) {
        Text(label.uppercased())
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
  let events: [ConPawsEventSnapshot]
  let convention: ConPawsConventionSnapshot

  var body: some View {
    Group {
      if events.isEmpty {
        EmptyScheduleView(
          title: "No events today",
          message: "Your next saved event is on another day."
        )
      } else {
        List(events) { event in
          NavigationLink {
            EventDetailView(event: event, convention: convention)
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(event.title)
                .font(.body.weight(.semibold))
                .lineLimit(2)
              Text(WatchFormat.timeRange(event, in: convention))
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            .frame(minHeight: 44, alignment: .leading)
          }
          .accessibilityLabel(
            "\(event.title), \(WatchFormat.timeRange(event, in: convention))"
          )
        }
        .listStyle(.carousel)
      }
    }
    .navigationTitle("Today")
  }
}

private struct EventDetailView: View {
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Text(event.title)
          .font(.headline)
          .fixedSize(horizontal: false, vertical: true)

        Label {
          Text(WatchFormat.timeRange(event, in: convention))
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
            Text("Leave reminder \(minutes) min before")
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
    .navigationTitle("Event")
  }
}

private struct AdaptiveCountdownView: View {
  let target: Date
  let now: Date
  let timeZone: TimeZone

  var body: some View {
    if target.timeIntervalSince(now) < 86_400, target > now {
      Text(timerInterval: now...target, countsDown: true)
        .accessibilityLabel(
          WatchFormat.countdownAccessibility(from: now, to: target, in: timeZone)
        )
    } else {
      Text(WatchFormat.countdown(from: now, to: target, in: timeZone))
        .accessibilityLabel(
          WatchFormat.countdownAccessibility(from: now, to: target, in: timeZone)
        )
    }
  }
}

private struct SavedScheduleLabel: View {
  var body: some View {
    Label("Saved schedule", systemImage: "iphone.and.arrow.forward")
      .font(.caption2)
      .foregroundStyle(.secondary)
      .accessibilityLabel("Showing the latest schedule saved from your iPhone")
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

  static func timeRange(
    _ event: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> String {
    guard let end = event.endDate else { return time(event.startDate, in: convention) }
    return "\(time(event.startDate, in: convention))–\(time(end, in: convention))"
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
  assert(
    WatchFormat.nextEventTime(
      now.addingTimeInterval(86_400),
      relativeTo: now,
      in: convention
    ).hasPrefix("Tomorrow · ")
  )
  assert(
    WatchFormat.countdown(from: now, to: now.addingTimeInterval(32 * 3_600), in: TimeZone(identifier: "UTC")!)
      == "1 D  8 H"
  )
}
#endif
