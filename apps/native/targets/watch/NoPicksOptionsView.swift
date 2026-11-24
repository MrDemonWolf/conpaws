import SwiftUI

/// No live saved panels, but something to tap: the empty state's title, then
/// the saved panels the convention withdrew and the options to add from.
struct NoPicksOptionsView: View {
  let convention: ConPawsConventionSnapshot
  let schedule: WatchScheduleProjection
  let options: [ConPawsEventSnapshot]
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: WatchMetrics.cardSpacing) {
        // The title alone: "Choose panels in ConPaws on your iPhone" sent the
        // wearer to the phone from directly above panels they can add here.
        Text(strings.noPicksTitle)
          .font(.headline)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity)
          .padding(.horizontal, 6)
          .accessibilityAddTraits(.isHeader)

        // Nothing to add here, so the phone is still the way to pick.
        if options.isEmpty {
          Text(strings.noPicksWatchMessage)
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 6)
        }

        // Withdrawn panels only, on this screen: struck through on Today.
        let todayCount = schedule.todayRows.count
        if todayCount > 0 {
          TodayLinkRow(count: todayCount, strings: strings)
        }

        WithdrawnNoticeRow(schedule: schedule, strings: strings)

        OtherOptionsSection(convention: convention, options: options, strings: strings)

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: schedule.now)
            .padding(.horizontal, WatchMetrics.cardInset)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
  }
}
