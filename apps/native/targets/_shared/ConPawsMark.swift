import SwiftUI

/// The ConPaws compass-paw mark, drawn as one fillable path.
///
/// A `Shape` rather than an asset-catalog image on purpose: whatever style
/// paints it — a brand `foregroundStyle`, the accented pass on a tinted Home
/// Screen, the vibrant pass on the Lock Screen — recolors every part of the
/// mark exactly like the text beside it, which is the whole point of shipping
/// a monochrome mark instead of the app icon. The ring is a stroked circle
/// converted to a fillable outline so the entire glyph stays a single path.
///
/// Geometry mirrors the 24×24 vector in `docs/widget-redesign-2026-08.html`:
/// a compass ring with four cardinal points around a four-toed paw.
struct ConPawsMarkShape: Shape {
  func path(in rect: CGRect) -> Path {
    let scale = min(rect.width, rect.height) / 24
    let offsetX = rect.midX - 12 * scale
    let offsetY = rect.midY - 12 * scale

    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: offsetX + x * scale, y: offsetY + y * scale)
    }
    func box(cx: CGFloat, cy: CGFloat, rx: CGFloat, ry: CGFloat) -> CGRect {
      CGRect(
        x: offsetX + (cx - rx) * scale,
        y: offsetY + (cy - ry) * scale,
        width: rx * 2 * scale,
        height: ry * 2 * scale
      )
    }

    var path = Path()

    // Compass ring.
    var ring = Path()
    ring.addEllipse(in: box(cx: 12, cy: 12, rx: 7.2, ry: 7.2))
    path.addPath(ring.strokedPath(StrokeStyle(lineWidth: 1.6 * scale)))

    // Cardinal points: north, south, west, east.
    let triangles: [[CGPoint]] = [
      [point(12, 1.2), point(13.6, 4.8), point(10.4, 4.8)],
      [point(12, 22.8), point(10.4, 19.2), point(13.6, 19.2)],
      [point(1.2, 12), point(4.8, 10.4), point(4.8, 13.6)],
      [point(22.8, 12), point(19.2, 13.6), point(19.2, 10.4)],
    ]
    for corners in triangles {
      path.move(to: corners[0])
      path.addLine(to: corners[1])
      path.addLine(to: corners[2])
      path.closeSubpath()
    }

    // Toes.
    path.addEllipse(in: box(cx: 10.4, cy: 9.9, rx: 0.95, ry: 1.3))
    path.addEllipse(in: box(cx: 13.6, cy: 9.9, rx: 0.95, ry: 1.3))
    path.addEllipse(in: box(cx: 8.9, cy: 12, rx: 0.85, ry: 1.15))
    path.addEllipse(in: box(cx: 15.1, cy: 12, rx: 0.85, ry: 1.15))

    // Pad.
    var pad = Path()
    pad.move(to: point(12, 11.4))
    pad.addCurve(to: point(9, 14.3), control1: point(10.4, 11.4), control2: point(9, 12.9))
    pad.addCurve(to: point(10.65, 15.9), control1: point(9, 15.25), control2: point(9.75, 15.9))
    pad.addCurve(to: point(12, 15.65), control1: point(11.2, 15.9), control2: point(11.6, 15.65))
    pad.addCurve(to: point(13.35, 15.9), control1: point(12.4, 15.65), control2: point(12.8, 15.9))
    pad.addCurve(to: point(15, 14.3), control1: point(14.25, 15.9), control2: point(15, 15.25))
    pad.addCurve(to: point(12, 11.4), control1: point(15, 12.9), control2: point(13.6, 11.4))
    pad.closeSubpath()
    path.addPath(pad)

    return path
  }
}

/// The mark at a fixed square size, decorative by default — every layout that
/// uses it puts the same information in the text beside it.
struct ConPawsMark: View {
  var size: CGFloat = 12

  var body: some View {
    ConPawsMarkShape()
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }
}
