import SwiftUI

/// A label between cards, inset to the cards' text edge.
struct SectionLabel: View {
  let title: String

  var body: some View {
    Text(title)
      .font(.caption2.bold())
      .foregroundStyle(.secondary)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.top, 2)
      .accessibilityAddTraits(.isHeader)
  }
}
