import SwiftUI

struct EmptyScheduleView: View {
  let title: String
  let message: String
  var systemImage = "calendar"

  var body: some View {
    // Scrollable at accessibility sizes for the same reason PreConventionView
    // is: the message — the only text telling the user how to recover —
    // clipped with no way to reach it.
    CenteredScrollView {
      VStack(spacing: 8) {
        Image(systemName: systemImage)
          .font(.title2)
          .foregroundStyle(Color.accentColor)
          .accessibilityHidden(true)
        Text(title)
          .font(.headline)
          .accessibilityAddTraits(.isHeader)
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity)
      .padding(.horizontal, 10)
      .accessibilityElement(children: .combine)
    }
  }
}
