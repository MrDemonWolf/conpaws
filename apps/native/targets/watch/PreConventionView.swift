import SwiftUI

struct PreConventionView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    let showsTimer = ConPawsCountdown.showsLiveTimer(
      from: now,
      to: convention.startDate,
      within: ConPawsCountdown.conventionTimerWindow
    )
    // Centered when it fits, scrollable for large Dynamic Type. A decorative
    // mark used to sit above the title and pushed the date range off the
    // bottom of a 46mm screen -- it was already hidden from VoiceOver, so it
    // cost a line and carried nothing.
    CenteredScrollView {
      VStack(spacing: 8) {
        Text(convention.name)
          .font(.headline)

        VStack(spacing: 2) {
          AdaptiveCountdownView(
            target: convention.startDate,
            now: now,
            timeZone: convention.timeZone,
            showsTimer: showsTimer,
            strings: strings
          )
          .font(.title2.bold())
          .foregroundStyle(Color.accentColor)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)

          // Only under the ticking timer. Beside "In 12 days" or "Tomorrow"
          // it read as the same thing said twice.
          if showsTimer {
            Text(strings.untilTheConvention)
              .font(.caption2)
              .foregroundStyle(.secondary)
          }
        }

        Text(convention.dateRangeLabel)
          .font(.caption)

        if isUsingSavedSchedule {
          SavedScheduleLabel(
            strings: strings,
            snapshotDate: snapshotDate,
            now: now,
            alignment: .center
          )
        }
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, 8)
      .accessibilityElement(children: .combine)
    }
    .navigationTitle(strings.comingUpTitle)
  }
}
