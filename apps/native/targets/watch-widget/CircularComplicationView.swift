import SwiftUI
import WidgetKit

/// The circular complication: a countdown ring in the leave window and the
/// week before a convention, a running panel's ring toward its published
/// end, the next panel's clock time, or the mark. What each state draws is
/// decided in targets/_shared (`ConPawsComplicationFace.circular`), where
/// swift-tests covers it.
///
/// Nothing here names a panel or a room except the Infograph bezel label,
/// which is left out wrist down. Times and counts stay readable.
struct CircularComplicationView: View {
  @Environment(\.locale) private var locale
  @Environment(\.redactionReasons) private var redactionReasons
  @Environment(\.showsWidgetLabel) private var showsWidgetLabel
  let projection: ConPawsComplicationProjection
  let strings: ConPawsStrings
  let staleNotice: String?

  var body: some View {
    let redacted = redactionReasons.contains(.privacy)
    let face = ConPawsComplicationFace.circular(projection, strings: strings, locale: locale)
    let bezel = showsWidgetLabel
      ? ConPawsComplicationFace.bezel(projection, strings: strings, redacted: redacted)
      : nil
    Group {
      if let bezel {
        CircularFaceView(face: face)
          .widgetLabel {
            Text(bezel.text)
              .privacySensitive(bezel.isPrivate)
          }
      } else {
        CircularFaceView(face: face)
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
