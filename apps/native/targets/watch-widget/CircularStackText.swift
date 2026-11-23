import SwiftUI

/// A number or time over its unit, day or period: "18" over "min", "4:00"
/// over "PM". Rounded, as the face's own circular text is.
struct CircularStackText: View {
  let value: String
  let detail: String?

  var body: some View {
    VStack(spacing: 0) {
      Text(value)
        .font(.system(.headline, design: .rounded).bold())
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      if let detail {
        Text(detail)
          .font(.system(.caption2, design: .rounded))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
    }
  }
}
