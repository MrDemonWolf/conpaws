import SwiftUI

/// Up Next while its reminder's leave window is open (`WatchGoWindow`), first
/// on Home: the live wait, then where to go in large type, then what it is.
/// Home draws it in place of that panel's Up Next card.
///
/// The room and the title are `privacySensitive` one by one, never the card,
/// which holds the timer: wrist-down the eyebrow and the timer stay readable.
struct GoCard<Value: View>: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let eyebrow: String
  let event: ConPawsEventSnapshot
  let conventionID: String
  /// Whether Double Tap opens the panel. A scene has one primary action, so
  /// only while Home is on top: a pushed screen keeps the gesture for itself.
  let opensOnDoubleTap: Bool
  @ViewBuilder var value: Value

  var body: some View {
    NavigationLink(value: WatchRoute.event(conventionID: conventionID, eventID: event.id)) {
      VStack(alignment: .leading, spacing: 2) {
        // The bell the complication's leave card draws: the reminder has
        // fired, and this is the panel it was for.
        HStack(spacing: 3) {
          Image(systemName: "bell")
            .accessibilityHidden(true)
          Text(eyebrow)
        }
        .font(.caption2.bold())
        .foregroundStyle(Color.accentColor)
        // Directly under its eyebrow, as on the Up Next card, so "STARTS IN"
        // and the timer read as one phrase.
        value
          .font(.title3.bold())
          .monospacedDigit()
          .foregroundStyle(Color.accentColor)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        // The room is what a glance across a hall needs, so it is the
        // largest line. A long one wraps before it shrinks.
        if let place = event.shortPlace {
          Text(place)
            .font(.title2.bold())
            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
            .minimumScaleFactor(0.7)
            .privacySensitive()
        }
        Text(event.title)
          .font(.headline)
          .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
          .privacySensitive()
      }
      .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
      .padding(.horizontal, WatchMetrics.cardInset)
      .padding(.vertical, 9)
      .cardBackground(Color.accentColor.opacity(0.22))
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .modifier(DoubleTapOpens(isEnabled: opensOnDoubleTap))
    // The highlight Double Tap draws follows the control's shape.
    .clipShape(.rect(cornerRadius: WatchMetrics.cornerRadius, style: .continuous))
    .accessibilityElement(children: .combine)
  }
}

/// Double Tap, on watchOS 11 and an Apple Watch Series 9, Ultra 2 or later,
/// opens the card as a tap would. Earlier systems and watches see no change.
private struct DoubleTapOpens: ViewModifier {
  let isEnabled: Bool

  func body(content: Content) -> some View {
    if #available(watchOS 11.0, *) {
      content.handGestureShortcut(.primaryAction, isEnabled: isEnabled)
    } else {
      content
    }
  }
}

#if DEBUG
#Preview("Go card · Long room · AX1") {
  // The longest a 41 mm card has to hold: a two-line room and title at the
  // first accessibility size. "Home · Always On" shows it wrist-down.
  let start = Date().addingTimeInterval(12 * 60)
  // In a stack, as on Home, so the value link has somewhere to go.
  NavigationStack {
    ScrollView {
      GoCard(
        eyebrow: ConPawsStrings.english.startsInCaps,
        event: ConPawsEventSnapshot(
          id: "go",
          title: "Fursuit Photoshoot Meetup",
          startAtMs: start.timeIntervalSince1970 * 1_000,
          endAtMs: start.addingTimeInterval(3_600).timeIntervalSince1970 * 1_000,
          location: "ConPaws Convention Center",
          room: "Grand Ballroom Salon A-D",
          reminderMinutes: 15,
          ageRating: nil,
          summary: nil
        ),
        conventionID: "preview",
        opensOnDoubleTap: true
      ) {
        Text(timerInterval: Date()...start, countsDown: true)
      }
      .padding(.horizontal, 4)
    }
  }
  .environment(\.dynamicTypeSize, .accessibility1)
}
#endif
