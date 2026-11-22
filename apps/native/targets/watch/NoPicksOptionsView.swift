import SwiftUI

/// No saved panels yet, but some running this hour: the empty state's title,
/// then the options to add from.
struct NoPicksOptionsView: View {
  let convention: ConPawsConventionSnapshot
  let options: [ConPawsEventSnapshot]
  let now: Date
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

        OtherOptionsSection(convention: convention, options: options, strings: strings)

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: now)
            .padding(.horizontal, WatchMetrics.cardInset)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
  }
}
