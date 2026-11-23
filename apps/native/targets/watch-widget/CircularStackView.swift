import SwiftUI

/// One stacked circle layout from `ConPawsComplicationFace.stackLayouts`:
/// the glyph, when there is room for it, over the value and its detail.
struct CircularStackView: View {
  let layout: ConPawsComplicationFace.StackLayout

  var body: some View {
    VStack(spacing: 0) {
      if let glyph = layout.glyph {
        ComplicationGlyphView(glyph: glyph)
      }
      CircularStackText(value: layout.value, detail: layout.detail, flag: layout.flag)
    }
  }
}
