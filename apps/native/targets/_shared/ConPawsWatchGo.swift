import Foundation

// The Watch app's Go card: Up Next while its reminder's leave window is open,
// first on Home with the room in large type. Foundation-only, so swift-tests
// covers it; the card itself is targets/watch/GoCard.swift. The complication
// compiles this folder too and ignores it.

/// When Home shows the Go card, and when it taps the wrist about it.
///
/// The window is the complication's leave card's, decided by the same
/// `ConPawsScheduleResolver.isInReminderWindow` on the same resolved state, so
/// it opens and closes on the complication's moments to the second. Home
/// redraws on `TimelineView(.everyMinute)`, so it draws the card on the
/// minute tick that reaches the opening, and taps the wrist on that tick too:
/// the card and Double Tap are there when the wrist buzzes. Like the
/// complication, only Up Next counts: a later panel whose longer reminder has
/// already fired waits until it is Up Next itself.
enum WatchGoWindow {
  /// How late after the window opens Home may still tap the wrist.
  ///
  /// Home sleeps until the opening and checks the clock when it wakes. A wake
  /// much later than this is an app coming back from the background, or
  /// launched mid-window, often from the iPhone's own reminder, which has
  /// already tapped the wrist once.
  static let announcementTolerance: TimeInterval = 10

  /// One window's opening, which Home taps the wrist for at most once.
  struct Announcement: Equatable, Sendable {
    let eventID: String
    /// The minute tick that first draws the Go card: the opening itself when
    /// it falls on the minute, else up to 59 seconds after it.
    let tick: Date
  }

  /// The panel the Go card is for at `now`: Up Next while its leave window is
  /// open, nil otherwise.
  static func event(in state: ConPawsScheduleState, now: Date) -> ConPawsEventSnapshot? {
    guard
      let upcoming = state.nextEvent,
      ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now)
    else { return nil }
    return upcoming
  }

  /// When `event`'s leave window opens: the moment its reminder fires. Nil
  /// without a lead time (no reminder, or one at the start), which has no
  /// window, exactly as `isInReminderWindow` reads it.
  static func opening(of event: ConPawsEventSnapshot) -> Date? {
    guard let minutes = event.reminderMinutes, minutes > 0 else { return nil }
    return event.startDate.addingTimeInterval(-Double(minutes) * 60)
  }

  /// The opening Home waits for: Up Next's, whether still to come or already
  /// passed, on the tick that draws its card. A passed one is never on time,
  /// so it stays quiet.
  static func announcement(in state: ConPawsScheduleState) -> Announcement? {
    guard let upcoming = state.nextEvent, let opening = opening(of: upcoming) else { return nil }
    return Announcement(eventID: upcoming.id, tick: firstTick(atOrAfter: opening))
  }

  /// The first minute tick at or after `date`, where Home's
  /// `TimelineView(.everyMinute)` draws. The reference date and every current
  /// time zone offset are whole minutes, so the ticks are whole minutes of
  /// absolute time.
  static func firstTick(atOrAfter date: Date) -> Date {
    let minutes = (date.timeIntervalSinceReferenceDate / 60).rounded(.up)
    return Date(timeIntervalSinceReferenceDate: minutes * 60)
  }

  /// Whether a wake at `now` is the Go card appearing in front of the wearer.
  /// A second early still counts, for a clock that settles while Home sleeps.
  static func isOnTime(_ announcement: Announcement, at now: Date) -> Bool {
    let lateness = now.timeIntervalSince(announcement.tick)
    return lateness >= -1 && lateness < announcementTolerance
  }
}

extension WatchScheduleProjection {
  /// Up Next while its leave window is open; Home draws it as the Go card.
  var goEvent: ConPawsEventSnapshot? {
    WatchGoWindow.event(in: state, now: now)
  }

  /// The window opening Home waits to tap the wrist for.
  var goAnnouncement: WatchGoWindow.Announcement? {
    WatchGoWindow.announcement(in: state)
  }
}
