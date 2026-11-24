import Foundation
import SwiftUI
import WidgetKit

#if DEBUG
// One preview per family, each stepping through the same states: the leave
// countdown (the gallery's sample), up next, a running panel, a stale plan,
// the countdown to a convention and no plan. Wrist-down redaction and tinted
// faces are switched in the canvas's device settings.

#Preview("Circular", as: .accessoryCircular) {
  ConPawsWatchWidget()
} timeline: {
  ConPawsWatchEntry.preview
  ConPawsWatchEntry.previewUpNext
  ConPawsWatchEntry.previewHappeningNow
  ConPawsWatchEntry.previewStale
  ConPawsWatchEntry.previewCountdown
  ConPawsWatchEntry.previewNoPlan
}

#Preview("Corner", as: .accessoryCorner) {
  ConPawsWatchWidget()
} timeline: {
  ConPawsWatchEntry.preview
  ConPawsWatchEntry.previewUpNext
  ConPawsWatchEntry.previewHappeningNow
  ConPawsWatchEntry.previewStale
  ConPawsWatchEntry.previewCountdown
  ConPawsWatchEntry.previewNoPlan
}

#Preview("Inline", as: .accessoryInline) {
  ConPawsWatchWidget()
} timeline: {
  ConPawsWatchEntry.preview
  ConPawsWatchEntry.previewUpNext
  ConPawsWatchEntry.previewHappeningNow
  ConPawsWatchEntry.previewStale
  ConPawsWatchEntry.previewCountdown
  ConPawsWatchEntry.previewNoPlan
}

#Preview("Rectangular", as: .accessoryRectangular) {
  ConPawsWatchWidget()
} timeline: {
  ConPawsWatchEntry.preview
  ConPawsWatchEntry.previewUpNext
  ConPawsWatchEntry.previewHappeningNow
  ConPawsWatchEntry.previewStale
  ConPawsWatchEntry.previewCountdown
  ConPawsWatchEntry.previewNoPlan
}

private extension ConPawsWatchEntry {
  /// A saved panel two hours out, no reminder: the next panel's clock time.
  static var previewUpNext: ConPawsWatchEntry {
    sample(startsIn: 7_200, length: 3_600)
  }

  /// A panel that started 20 minutes ago and ends in 40, nothing after it.
  static var previewHappeningNow: ConPawsWatchEntry {
    sample(startsIn: -1_200, length: 3_600)
  }

  /// Up next from a plan the phone sent two hours ago.
  static var previewStale: ConPawsWatchEntry {
    sample(startsIn: 7_200, length: 3_600, planAge: 7_200)
  }

  /// Three days before the convention, nothing saved yet.
  static var previewCountdown: ConPawsWatchEntry {
    sample(conventionStartsIn: 3 * 86_400)
  }

  static var previewNoPlan: ConPawsWatchEntry {
    ConPawsWatchEntry(date: .now, snapshot: .empty)
  }

  /// A convention under way (or starting `conventionStartsIn` from now) with
  /// one saved panel, worded in the watch's language like the gallery.
  static func sample(
    startsIn: TimeInterval? = nil,
    length: TimeInterval? = nil,
    planAge: TimeInterval = 60,
    conventionStartsIn: TimeInterval = -86_400
  ) -> ConPawsWatchEntry {
    let now = Date.now
    let localeIdentifier = ConPawsSnapshot.deviceLocaleIdentifier()
    let strings = ConPawsStrings.resolve(localeIdentifier)
    let events: [ConPawsEventSnapshot] = startsIn.map { offset in
      let start = now.addingTimeInterval(offset)
      return [
        ConPawsEventSnapshot(
          id: "preview-panel",
          title: strings.previewEventTitle,
          startAtMs: start.timeIntervalSince1970 * 1_000,
          endAtMs: length.map { start.addingTimeInterval($0).timeIntervalSince1970 * 1_000 },
          location: nil,
          room: strings.previewRoom,
          reminderMinutes: nil,
          ageRating: nil,
          summary: nil
        ),
      ]
    } ?? []
    let conventionStart = now.addingTimeInterval(conventionStartsIn)
    let convention = ConPawsConventionSnapshot(
      id: "preview-convention",
      name: "ConPaws",
      startAtMs: conventionStart.timeIntervalSince1970 * 1_000,
      endAtMs: conventionStart.addingTimeInterval(3 * 86_400).timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
      dateRangeLabel: strings.today,
      events: events,
      options: nil
    )
    return ConPawsWatchEntry(
      date: now,
      snapshot: ConPawsSnapshot(
        schemaVersion: 2,
        generatedAtMs: now.addingTimeInterval(-planAge).timeIntervalSince1970 * 1_000,
        localeIdentifier: localeIdentifier,
        conventions: [convention]
      )
    )
  }
}
#endif
