import SwiftUI

struct TodayLinkRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let count: Int
  let strings: ConPawsStrings

  var body: some View {
    // At accessibility sizes the count drops under the label instead of
    // squeezing "Today" down to a few letters.
    let layout = dynamicTypeSize.isAccessibilitySize
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
      : AnyLayout(HStackLayout(spacing: 6))

    NavigationLink(value: WatchRoute.today) {
      layout {
        Label(strings.today, systemImage: "list.bullet")
          .frame(maxWidth: .infinity, alignment: .leading)
        Text("\(count)")
          .foregroundStyle(.secondary)
      }
      .font(.body)
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 4)
      .cardBackground(.quaternary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel("\(strings.today), \(strings.events(count))")
  }
}
