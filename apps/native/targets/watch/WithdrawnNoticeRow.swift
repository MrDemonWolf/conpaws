import SwiftUI

/// "A saved panel is off the schedule", the phone's banner line, as a row on
/// the Home screen. It leads to the soonest such panel and shows only while
/// one is still to come, so a cancelled panel never vanishes from the wrist
/// unannounced.
///
/// Readable wrist-down: it names no panel.
struct WithdrawnNoticeRow: View {
  let schedule: WatchScheduleProjection
  let strings: ConPawsStrings

  var body: some View {
    if let route = schedule.withdrawnNoticeRoute {
      NavigationLink(value: route) {
        Label {
          Text(strings.withdrawnStrings.notice(count: schedule.upcomingWithdrawn.count))
            .fixedSize(horizontal: false, vertical: true)
        } icon: {
          Image(systemName: "xmark.circle")
            .accessibilityHidden(true)
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, WatchMetrics.cardInset)
        .padding(.vertical, 4)
        .cardBackground(.quaternary)
        .contentShape(.rect)
      }
      .buttonStyle(.plain)
    }
  }
}

#if DEBUG
/// A convention day with one panel cancelled and one off the schedule.
private enum WithdrawnPreviewFixtures {
  static let now = Date()

  private static func event(_ id: String, _ title: String, minutes: Double) -> ConPawsEventSnapshot {
    let start = now.addingTimeInterval(minutes * 60)
    return ConPawsEventSnapshot(
      id: id,
      title: title,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: start.addingTimeInterval(3_600).timeIntervalSince1970 * 1_000,
      location: "ConPaws Convention Center",
      room: "Hall B",
      reminderMinutes: nil,
      ageRating: nil,
      summary: nil
    )
  }

  static var snapshot: ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: now.timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "preview-convention",
          name: "ConPaws Preview Con",
          startAtMs: now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(3 * 86_400).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
          dateRangeLabel: "Preview dates",
          events: [
            event("running", "Fursuit Parade Staging", minutes: -30),
            event("later", "Art Show Tour", minutes: 120),
          ],
          options: nil,
          withdrawn: [
            ConPawsWithdrawnEvent(event: event("art-jam", "Art Jam", minutes: 45), status: .cancelled),
            ConPawsWithdrawnEvent(event: event("meetup", "Pokémon Meetup", minutes: 90), status: .removed),
          ]
        ),
      ]
    )
  }

  static var schedule: WatchScheduleProjection {
    WatchScheduleProjection(snapshot: snapshot, now: now)
  }
}

#Preview("Today · Withdrawn") {
  NavigationStack {
    TodayListView(schedule: WithdrawnPreviewFixtures.schedule, strings: .english)
  }
}

#Preview("Detail · Cancelled") {
  let snapshot = WithdrawnPreviewFixtures.snapshot
  let convention = snapshot.conventions[0]
  NavigationStack {
    EventDetailView(
      event: convention.withdrawn?[0].event ?? convention.events[0],
      convention: convention,
      now: WithdrawnPreviewFixtures.now,
      strings: .english,
      planAction: WatchPlanAction(kind: .remove, isPending: false) {},
      withdrawnStatus: .cancelled
    )
  }
}

#Preview("Home notice") {
  NavigationStack {
    ScrollView {
      WithdrawnNoticeRow(schedule: WithdrawnPreviewFixtures.schedule, strings: .english)
        .padding(.horizontal, 4)
    }
  }
}

#Preview("Today · Withdrawn, Always On") {
  NavigationStack {
    TodayListView(schedule: WithdrawnPreviewFixtures.schedule, strings: .english)
  }
  .environment(\.isLuminanceReduced, true)
  .environment(\.redactionReasons, .privacy)
}
#endif
