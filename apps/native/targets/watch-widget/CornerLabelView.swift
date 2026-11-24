import SwiftUI
import WidgetKit

/// The corner's inner curve: a bar filling toward a start or a running
/// panel's end, or a short line. A stale plan puts the stale symbol before
/// the line, or in place of the bar, which would otherwise present the old
/// plan's timing as current.
struct CornerLabelView: View {
  let label: ConPawsComplicationFace.Corner.Label
  let isStale: Bool

  var body: some View {
    switch label {
    case .gauge(let progress):
      if isStale {
        StaleSymbolText()
      } else {
        Gauge(value: progress) {
          EmptyView()
        }
        .tint(Color.accentColor)
        .widgetAccentable()
      }
    case .panel(let interval):
      if isStale {
        StaleSymbolText()
      } else {
        ProgressView(timerInterval: interval, countsDown: false) {
          EmptyView()
        } currentValueLabel: {
          EmptyView()
        }
        .tint(Color.accentColor)
        .widgetAccentable()
      }
    case .text(let text, let isPrivate):
      // One Text, so the face keeps the symbol and the words together. A
      // room is privacy-sensitive; wrist down the plan gives a heading
      // instead, so redaction never has to hide the symbol with it.
      Group {
        if isStale {
          Text("\(Image(systemName: ConPawsComplicationFace.staleSymbol)) \(text)")
        } else {
          Text(text)
        }
      }
      .privacySensitive(isPrivate)
    case .empty:
      if isStale {
        StaleSymbolText()
      }
    }
  }
}

/// The stale symbol alone, as curved label text.
private struct StaleSymbolText: View {
  var body: some View {
    Text("\(Image(systemName: ConPawsComplicationFace.staleSymbol))")
  }
}
