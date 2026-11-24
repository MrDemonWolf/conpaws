import SwiftUI

/// A number or time over its unit, day or period: "18" over "min", "4:00"
/// over "PM". Rounded, as the face's own circular text is.
struct CircularStackText: View {
  let value: String
  let detail: String?
  /// A symbol drawn before the detail: the stale flag, when the circle has
  /// no room for it above the value.
  var flag: String?

  var body: some View {
    VStack(spacing: 0) {
      Text(value)
        .font(.system(.headline, design: .rounded).bold())
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      if let detail {
        detailText(detail)
          .font(.system(.caption2, design: .rounded))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
    }
  }

  private func detailText(_ detail: String) -> Text {
    guard let flag else { return Text(detail) }
    return Text("\(Image(systemName: flag)) \(detail)")
  }
}
