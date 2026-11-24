import SwiftUI
import WidgetKit

/// The corner complication: the count or time curved along the outer edge
/// and a bar or the room along the inner one. With no label, as on a status
/// card, it is the large circle with the mark. What each state draws is
/// decided in targets/_shared (`ConPawsComplicationFace.corner`), where
/// swift-tests covers it; that is also where a redacted face trades the room
/// for a heading.
struct CornerComplicationView: View {
  @Environment(\.locale) private var locale
  @Environment(\.redactionReasons) private var redactionReasons
  let projection: ConPawsComplicationProjection
  let strings: ConPawsStrings
  let staleNotice: String?

  var body: some View {
    let redacted = redactionReasons.contains(.privacy)
    let face = ConPawsComplicationFace.corner(
      projection,
      strings: strings,
      locale: locale,
      redacted: redacted
    )
    Group {
      if face.label == .empty, !face.isStale {
        CornerContentView(content: face.content)
      } else {
        CornerContentView(content: face.content)
          .widgetLabel {
            CornerLabelView(label: face.label, isStale: face.isStale)
          }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      ConPawsComplicationSpeech.summary(
        projection,
        strings: strings,
        locale: locale,
        redacted: redacted,
        stale: staleNotice
      )
    )
  }
}
