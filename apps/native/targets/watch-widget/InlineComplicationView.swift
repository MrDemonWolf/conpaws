import SwiftUI
import WidgetKit

/// The inline complication: one line, above the time, along the dial or
/// across the bottom of the face, which draws it in its own font and color.
/// Lines come longest first from targets/_shared
/// (`ConPawsComplicationFace.inline`), and the face shows the first that
/// fits its slot without truncating.
///
/// A single line of text cannot mark part of itself `privacySensitive`, and
/// marking the whole line would hide the time with the room. So the plan
/// reads the face's redaction and leaves the room out wrist down.
struct InlineComplicationView: View {
  @Environment(\.locale) private var locale
  @Environment(\.redactionReasons) private var redactionReasons
  let projection: ConPawsComplicationProjection
  let strings: ConPawsStrings
  let staleNotice: String?

  var body: some View {
    let redacted = redactionReasons.contains(.privacy)
    let face = ConPawsComplicationFace.inline(
      projection,
      strings: strings,
      locale: locale,
      redacted: redacted
    )
    ViewThatFits {
      ForEach(face.lines.indices, id: \.self) { index in
        InlineLineView(text: face.lines[index], symbol: face.symbol)
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
