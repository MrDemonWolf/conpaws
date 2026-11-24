import SwiftUI
import WidgetKit

/// The corner's outer part: text curved along the edge, the longest line
/// that fits, or a glyph in the large circle.
struct CornerContentView: View {
  let content: ConPawsComplicationFace.Corner.Content

  var body: some View {
    switch content {
    case .text(let lines):
      // Curved only beside a label (watchOS 10): the face curves text, SF
      // Symbols and images, including a ViewThatFits's chosen line.
      ViewThatFits {
        ForEach(lines.indices, id: \.self) { index in
          Text(lines[index])
            .monospacedDigit()
            .lineLimit(1)
        }
      }
      .widgetCurvesContent()
    case .glyph(let glyph):
      ZStack {
        AccessoryWidgetBackground()
        ComplicationGlyphView(glyph: glyph, markSize: 24)
      }
    }
  }
}
