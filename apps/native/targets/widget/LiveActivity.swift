import ActivityKit
import SwiftUI
import WidgetKit

enum ConPawsActivityPhase: String, Codable, Hashable, Sendable {
  case upcoming
  case current
  case leave
  case finished
}

struct ConPawsActivityAttributes: ActivityAttributes, Sendable {
  struct ContentState: Codable, Hashable, Sendable {
    var phase: ConPawsActivityPhase
    let localeIdentifier: String
    let timeZoneIdentifier: String
    let conventionName: String
    let eventId: String
    let eventTitle: String
    let room: String?
    let publishedStartAtMs: Double
    let publishedEndAtMs: Double?
    let attendanceStartAtMs: Double
    let attendanceEndAtMs: Double?
    let attendanceNeedsReview: Bool
    let hasPersonalStart: Bool
    let hasPersonalEnd: Bool
    let nextEventTitle: String?
    let nextRoom: String?
    let nextAttendanceStartAtMs: Double?
  }

  let conventionId: String
}

private extension ConPawsActivityAttributes.ContentState {
  var strings: ConPawsStrings { .resolve(localeIdentifier) }
  var locale: Locale { Locale(identifier: localeIdentifier) }
  var timeZone: TimeZone { TimeZone(identifier: timeZoneIdentifier) ?? .autoupdatingCurrent }
  var attendanceStartDate: Date { Date(timeIntervalSince1970: attendanceStartAtMs / 1_000) }
  var attendanceEndDate: Date? { attendanceEndAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) } }
  var nextAttendanceStartDate: Date? { nextAttendanceStartAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) } }

  /// ActivityKit can mark one content update stale at its next boundary even
  /// while the app is suspended. Use that boundary to advance truthful copy:
  /// upcoming becomes current at the chosen join time, and current/leave
  /// becomes finished at the chosen end. Later app or push updates can then
  /// provide the next boundary; no background JavaScript countdown is needed.
  func displayed(isStale: Bool) -> Self {
    guard isStale else { return self }
    var displayed = self
    switch phase {
    case .upcoming:
      displayed.phase = .current
    case .current, .leave:
      displayed.phase = .finished
    case .finished:
      break
    }
    return displayed
  }

  var cue: String {
    switch phase {
    case .upcoming: strings.startingSoon
    case .current: hasPersonalEnd ? strings.leaveIn : strings.nowCaps
    case .leave: strings.leaveCaps
    case .finished: strings.allDoneTitle
    }
  }
}

private struct ConPawsActivityTimer: View {
  let content: ConPawsActivityAttributes.ContentState
  var compact = false

  @ViewBuilder
  var body: some View {
    Group {
      switch content.phase {
      case .upcoming:
        Text(content.attendanceStartDate, style: .timer)
      case .current:
        if content.hasPersonalEnd, let end = content.attendanceEndDate {
          Text(end, style: .timer)
        } else {
          Text(content.strings.now)
        }
      case .leave:
        Text(content.strings.now)
      case .finished:
        Image(systemName: "checkmark")
      }
    }
    .font(compact ? .caption : .headline)
    .fontWeight(.semibold)
    .monospacedDigit()
    .lineLimit(1)
  }
}

private struct ConPawsLiveActivityView: View {
  let content: ConPawsActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 12) {
        Label(content.conventionName, systemImage: "pawprint.fill")
          .font(.caption)
          .fontWeight(.semibold)
          .lineLimit(1)
        Spacer(minLength: 8)
        VStack(alignment: .trailing, spacing: 2) {
          Text(content.cue)
            .font(.caption2)
            .foregroundStyle(.secondary)
          ConPawsActivityTimer(content: content)
        }
      }

      Text(content.eventTitle)
        .font(.headline)
        .lineLimit(2)
      if let room = content.room, !room.isEmpty {
        Label(room, systemImage: "mappin.and.ellipse")
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }

      if content.phase == .upcoming, content.hasPersonalStart {
        Label {
          Text(content.attendanceStartDate, style: .time)
        } icon: {
          Image(systemName: "person.badge.clock")
        }
        .font(.caption)
      } else if content.hasPersonalEnd, let end = content.attendanceEndDate {
        Label {
          Text(end, style: .time)
        } icon: {
          Image(systemName: "rectangle.portrait.and.arrow.right")
        }
        .font(.caption)
      }

      if content.attendanceNeedsReview {
        Image(systemName: "exclamationmark.triangle.fill")
          .foregroundStyle(.orange)
          .accessibilityLabel(content.strings.scheduleTitle)
      }

      if let nextTitle = content.nextEventTitle {
        Divider()
        HStack(spacing: 6) {
          Text(content.strings.nextCaps)
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(.secondary)
          VStack(alignment: .leading, spacing: 1) {
            Text(nextTitle)
              .font(.caption)
              .fontWeight(.semibold)
              .lineLimit(1)
            if let nextRoom = content.nextRoom, !nextRoom.isEmpty {
              Text(nextRoom)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
          Spacer(minLength: 4)
          if let nextStart = content.nextAttendanceStartDate {
            Text(nextStart, style: .time)
              .font(.caption)
              .monospacedDigit()
          }
        }
      }
    }
    .padding()
    .environment(\.locale, content.locale)
    .environment(\.timeZone, content.timeZone)
    .accessibilityElement(children: .combine)
  }
}

struct ConPawsLiveActivityWidget: Widget {
  private let appURL = URL(string: "conpaws://schedule")

  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ConPawsActivityAttributes.self) { context in
      ConPawsLiveActivityView(content: context.state.displayed(isStale: context.isStale))
        .activityBackgroundTint(Color(uiColor: .secondarySystemBackground))
        .activitySystemActionForegroundColor(.primary)
        .widgetURL(appURL)
    } dynamicIsland: { context in
      let content = context.state.displayed(isStale: context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(content.cue, systemImage: "pawprint.fill")
            .font(.caption)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ConPawsActivityTimer(content: content)
        }
        DynamicIslandExpandedRegion(.center) {
          VStack(spacing: 2) {
            Text(content.eventTitle)
              .font(.headline)
              .lineLimit(1)
            if let room = content.room, !room.isEmpty {
              Text(room)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          if let nextTitle = content.nextEventTitle {
            HStack(spacing: 6) {
              Text(content.strings.nextCaps)
                .font(.caption2)
                .foregroundStyle(.secondary)
              VStack(alignment: .leading, spacing: 1) {
                Text(nextTitle)
                  .font(.caption)
                  .lineLimit(1)
                if let nextRoom = content.nextRoom, !nextRoom.isEmpty {
                  Text(nextRoom)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                }
              }
              Spacer(minLength: 4)
              if let nextStart = content.nextAttendanceStartDate {
                Text(nextStart, style: .time)
                  .font(.caption)
                  .monospacedDigit()
              }
            }
          }
        }
      } compactLeading: {
        Image(systemName: "pawprint.fill")
      } compactTrailing: {
        ConPawsActivityTimer(content: content, compact: true)
      } minimal: {
        Image(systemName: content.phase == .finished ? "checkmark" : "pawprint.fill")
      }
      .widgetURL(appURL)
      .keylineTint(.accentColor)
      .environment(\.locale, content.locale)
      .environment(\.timeZone, content.timeZone)
    }
  }
}
