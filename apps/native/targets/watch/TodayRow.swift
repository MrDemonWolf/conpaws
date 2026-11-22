import SwiftUI

struct TodayRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let event: ConPawsEventSnapshot
  let timeRange: String
  let isRunning: Bool
  let hasEnded: Bool

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
          .font(.body.weight(.semibold))
          .foregroundStyle(hasEnded ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.primary)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
        HStack(spacing: 3) {
          // Ended rows carry a check as well as the dimmer title, by the same
          // rule as the running bar: state is never shown by color alone.
          if hasEnded {
            Image(systemName: "checkmark")
              .accessibilityHidden(true)
          }
          Text(timeRange)
        }
        .font(.caption2)
        .foregroundStyle(isRunning ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.secondary))
        if let place = event.shortPlace {
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
