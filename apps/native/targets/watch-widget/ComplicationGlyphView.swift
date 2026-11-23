import SwiftUI
import WidgetKit

/// The mark, a symbol or a short word, alone in a slot or topping a circle.
/// Accented on a tinted face, like the rectangular card's eyebrow, and
/// decorative: every family speaks the whole card as one label.
struct ComplicationGlyphView: View {
  let glyph: ConPawsComplicationFace.Glyph
  /// The mark's size. Never below 16 points: its compass ring blurs there.
  var markSize: CGFloat = 16

  var body: some View {
    Group {
      switch glyph {
      case .mark:
        ConPawsMark(size: max(16, markSize))
      case .symbol(let name):
        Image(systemName: name)
          .font(.caption2.bold())
          .accessibilityHidden(true)
      case .text(let text):
        Text(text)
          .font(.caption2.bold())
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
    }
    .foregroundStyle(Color.accentColor)
    .widgetAccentable()
  }
}
