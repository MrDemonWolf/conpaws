import SwiftUI

/// The card that answers "what now": the next event, or the running one when
/// nothing follows it. Tinted so it stands apart from the Later cards.
struct HeroCard<Value: View, Detail: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let eyebrow: String
  let event: ConPawsEventSnapshot
  let conventionID: String
  @ViewBuilder var value: Value
  @ViewBuilder var detail: Detail

  var body: some View {
    NavigationLink(value: WatchRoute.event(conventionID: conventionID, eventID: event.id)) {
      VStack(alignment: .leading, spacing: 2) {
        Text(eyebrow)
          .font(.caption2.bold())
          .foregroundStyle(Color.accentColor)
        // Directly under its eyebrow, so "STARTS IN" and its timer read as
        // one phrase instead of having the title between them.
        value
          .font(.title3.bold())
          .monospacedDigit()
          .foregroundStyle(Color.accentColor)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(event.title)
          .font(.headline)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 3)
          .privacySensitive()
          .padding(.top, 1)
        VStack(alignment: .leading, spacing: 1) {
          detail
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 9)
      .cardBackground(Color.accentColor.opacity(0.22))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}
