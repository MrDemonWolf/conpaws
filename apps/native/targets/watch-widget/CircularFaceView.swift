import SwiftUI
import WidgetKit

/// One circular layout, drawn from the shared plan.
struct CircularFaceView: View {
  let face: ConPawsComplicationFace.Circular

  var body: some View {
    switch face {
    case let .ring(progress, count):
      // The ring and its count are the accented group on a tinted face; the
      // timeline redraws both together, a minute or an hour at a time.
      Gauge(value: progress) {
        Text(count.text)
      } currentValueLabel: {
        CircularStackText(value: count.value, detail: count.unit)
      }
      .gaugeStyle(.accessoryCircularCapacity)
      .tint(Color.accentColor)
      .widgetAccentable()
    case let .panelRing(interval, end):
      // Filled by the system: no timeline entry falls inside a running
      // panel, so a Gauge would sit at its first value until the end.
      ProgressView(timerInterval: interval, countsDown: false) {
        EmptyView()
      } currentValueLabel: {
        Text(end.digits)
          .font(.system(.body, design: .rounded).bold())
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.5)
      }
      .progressViewStyle(.circular)
      .tint(Color.accentColor)
      .widgetAccentable()
    case let .stack(glyph, value, detail):
      ZStack {
        AccessoryWidgetBackground()
        // The glyph goes first when a larger text size leaves no room for
        // all three lines; the time and its day or period always stay.
        ViewThatFits(in: .vertical) {
          VStack(spacing: 0) {
            ComplicationGlyphView(glyph: glyph)
            CircularStackText(value: value, detail: detail)
          }
          CircularStackText(value: value, detail: detail)
        }
      }
    case let .glyph(glyph):
      ZStack {
        AccessoryWidgetBackground()
        ComplicationGlyphView(glyph: glyph, markSize: 24)
      }
    }
  }
}
