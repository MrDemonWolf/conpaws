import SwiftUI

/// A time and a room: one line when both fit, stacked when they do not.
///
/// Always two Text views, never one string. Always On redacts the room and
/// must leave the time beside it readable; a joined "2:00 PM · Studio B"
/// could only hide both or neither.
struct TimeAndPlace: View {
  let time: String
  let place: String?

  var body: some View {
    if let place {
      ViewThatFits(in: .horizontal) {
        HStack(spacing: 4) {
          Text(time)
          Text(verbatim: "·")
            .accessibilityHidden(true)
          Text(place)
            .privacySensitive()
        }
        .lineLimit(1)

        VStack(alignment: .leading, spacing: 1) {
          Text(time)
          Text(place)
            .privacySensitive()
        }
      }
    } else {
      Text(time)
    }
  }
}
