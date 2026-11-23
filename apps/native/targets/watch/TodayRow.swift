import SwiftUI

struct TodayRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let event: ConPawsEventSnapshot
  let timeRange: String
  let isRunning: Bool
  let hasEnded: Bool
  /// "Cancelled" or "Off the schedule" for a panel the convention withdrew;
  /// nil for a live one.
  var withdrawnLabel: String?

  private var isWithdrawn: Bool { withdrawnLabel != nil }

  var body: some View {
    HStack(spacing: 6) {
      if isRunning {
        // Mockup frame 2: the running event is marked, not styled by
        // color alone — a bar plus the accent both carry it.
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
          .fill(Color.accentColor)
          .frame(width: 3)
          .accessibilityHidden(true)
      }
      VStack(alignment: .leading, spacing: 2) {
        Text(event.title)
          // Struck through as well as labelled below, so a withdrawn panel
          // never reads as one still on.
          .strikethrough(isWithdrawn)
          .font(.body.weight(.semibold))
          .foregroundStyle(
            hasEnded || isWithdrawn ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.primary
          )
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
        if let withdrawnLabel {
          // The status in words beside its symbol, and readable wrist-down:
          // it says nothing about which panel it was.
          Label {
            Text(withdrawnLabel)
          } icon: {
            Image(systemName: "xmark.circle")
              .accessibilityHidden(true)
          }
          .font(.caption2.bold())
        }
        HStack(spacing: 3) {
          // Ended rows carry a check as well as the dimmer title, by the same
          // rule as the running bar: state is never shown by color alone. A
          // withdrawn panel never ran, so it gets none.
          if hasEnded, !isWithdrawn {
            Image(systemName: "checkmark")
              .accessibilityHidden(true)
          }
          Text(timeRange)
        }
        .font(.caption2)
        .foregroundStyle(isRunning ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.secondary))
        // A withdrawn panel's room is nowhere to go; its detail screen still
        // names it.
        if !isWithdrawn, let place = event.shortPlace {
          Text(place)
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .privacySensitive()
        }
      }
    }
    .frame(minHeight: 44, alignment: .leading)
  }
}
