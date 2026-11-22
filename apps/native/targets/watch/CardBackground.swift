import SwiftUI

/// A card's or a pill's platter, dropped in Always On as Apple's Always On
/// guidance asks: on the dimmed display a filled card reads as a lit slab, and
/// the text alone carries the layout. Reading `isLuminanceReduced` here, in a
/// leaf modifier, keeps the wrist-down switch from invalidating the whole
/// screen.
private struct CardBackground<Style: ShapeStyle, Platter: Shape>: ViewModifier {
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  let style: Style
  let shape: Platter

  func body(content: Content) -> some View {
    content.background {
      if !isLuminanceReduced {
        shape.fill(style)
      }
    }
  }
}

extension View {
  func cardBackground<Style: ShapeStyle>(_ style: Style) -> some View {
    cardBackground(
      style,
      in: RoundedRectangle(cornerRadius: WatchMetrics.cornerRadius, style: .continuous)
    )
  }

  func cardBackground<Style: ShapeStyle, Platter: Shape>(
    _ style: Style,
    in shape: Platter
  ) -> some View {
    modifier(CardBackground(style: style, shape: shape))
  }
}
