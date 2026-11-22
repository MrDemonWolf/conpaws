import SwiftUI

struct EventCard<Detail: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let eyebrow: String
  let event: ConPawsEventSnapshot
  let conventionID: String
  var accented = true
  /// Where the card leads; a saved event's detail unless told otherwise.
  var route: WatchRoute?
  @ViewBuilder var detail: Detail

  var body: some View {
    NavigationLink(value: route ?? WatchRoute.event(conventionID: conventionID, eventID: event.id)) {
      VStack(alignment: .leading, spacing: 3) {
        // Callers hand this over in the case it is drawn in. Upper-casing here
        // instead would also hit the clock times the later-event cards use as
        // their label, and would do it with the wrong language's casing rules.
        Text(eyebrow)
          .font(.caption2.bold())
          .foregroundStyle(accented ? AnyShapeStyle(Color.accentColor) : AnyShapeStyle(.secondary))
        Text(event.title)
          .font(.headline)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
        VStack(alignment: .leading, spacing: 1) {
          detail
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
        .lineLimit(2)
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 8)
      .cardBackground(.quaternary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .combine)
  }
}
