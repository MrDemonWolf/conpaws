import SwiftUI

struct AdaptiveCountdownView: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  let target: Date
  let now: Date
  let timeZone: TimeZone
  /// Decided by the caller, once, so an eyebrow that reads STARTS IN and this
  /// view can never disagree about which form is showing.
  let showsTimer: Bool
  let strings: ConPawsStrings

  var body: some View {
    if showsTimer, target > now {
      // Inside its window the app keeps a live timer. Unlike a widget it is
      // on screen and refreshing, so it can honour per-second precision --
      // and this is the stretch where that precision is worth having.
      Text(timerInterval: now...target, countsDown: true)
        .accessibilityLabel(
          strings.remaining(
            ConPawsFormat.countdownDuration(from: now, to: target, in: timeZone, strings: strings)
          )
        )
    } else {
      // Further out, read the same ladder the complication and the iPhone
      // Lock Screen read. The app used to say "12 D 9 H" here while its own
      // complication said "In 12 days" about the same wait.
      //
      // Words wrap rather than truncate: callers hold the line to one for
      // the timer, but "2 kuukauden kuluttua" cannot fit one line on a 41 mm
      // screen even shrunk, least of all at accessibility sizes.
      Text(ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings))
        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
    }
  }
}
