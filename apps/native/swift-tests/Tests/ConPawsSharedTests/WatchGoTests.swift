import Foundation
import Testing
@testable import ConPawsShared

/// The Watch app's Go card: Up Next while its reminder's leave window is open.
/// It opens and closes on the complication's leave card's moments exactly, so
/// the face and the app never disagree about whether it is time to go. The
/// convention is in Chicago; times are its wall clock in November 2026.
struct WatchGoTests {
  // MARK: The window

  /// Every 30 seconds from the eve of the convention to the small hours of
  /// day two, and a second either side of every opening and start: the app's
  /// Go card and the complication's leave card name the same panel, or
  /// neither does.
  @Test func theGoCardFollowsTheComplicationsLeaveCard() {
    let value = snapshot(dayOne)
    var moments: [Date] = []
    var date = local(19, 18)
    while date < local(21, 2) {
      moments.append(date)
      date = date.addingTimeInterval(30)
    }
    for event in dayOne {
      let edges = [WatchGoWindow.opening(of: event), event.startDate].compactMap(\.self)
      moments += edges.flatMap { [$0.addingTimeInterval(-1), $0, $0.addingTimeInterval(1)] }
    }

    var goMoments = 0
    for moment in moments {
      let go = WatchScheduleProjection(snapshot: value, now: moment).goEvent?.id
      let leave = leaveEventID(ConPawsComplicationProjection(snapshot: value, now: moment))
      #expect(go == leave, "at \(moment)")
      if go != nil { goMoments += 1 }
    }
    // Not a match of two empty answers.
    #expect(goMoments > 100)
  }

  /// The same day, spelled out, so the app and the complication cannot drift
  /// together without a test noticing.
  @Test(arguments: [
    (local(19, 19, 29, 59), nil), // still counting down to the convention
    (local(19, 19, 30), "eve-meetup"), // its 30-minute reminder ends the countdown
    (local(20, 8, 44, 59), nil),
    (local(20, 8, 45), "opening"),
    (local(20, 8, 59, 59), "opening"),
    // Art Jam is Up Next from 9:00; Trivia's hour-long window is open from
    // 9:30, but Trivia is not Up Next until Art Jam starts.
    (local(20, 9, 45), nil),
    (local(20, 9, 50), "art-jam"),
    (local(20, 10), "trivia"),
    (local(20, 10, 30), nil), // Trivia has started; no reminder on the next
    (local(20, 12, 59), nil),
    (local(20, 14, 59, 59), nil), // a reminder at the start opens no window
    (local(20, 15, 55, 29), nil),
    (local(20, 15, 55, 30), "on-the-half-minute"),
    (local(20, 23, 59), "late-show"), // across the convention's midnight
  ] as [(Date, String?)])
  func theGoCardShowsUpNextInsideItsWindow(at moment: Date, expected: String?) {
    let schedule = WatchScheduleProjection(snapshot: snapshot(dayOne), now: moment)
    #expect(schedule.goEvent?.id == expected)
    if let expected {
      // Always the Up Next panel, never another panel whose window is open.
      #expect(schedule.nextEvent?.id == expected)
    }
  }

  /// The window opens where the complication's leave card starts counting:
  /// the reminder's own moment, not a minute later.
  @Test(arguments: [1, 5, 10, 15, 30, 45, 60, 120])
  func theOpeningIsTheReminderMoment(minutes: Int) throws {
    let panel = event("panel", from: local(20, 14), reminderMinutes: minutes)
    let opening = try #require(WatchGoWindow.opening(of: panel))
    #expect(opening == local(20, 14).addingTimeInterval(-Double(minutes) * 60))
    #expect(ConPawsScheduleResolver.isInReminderWindow(panel, now: opening))
    #expect(
      ConPawsScheduleResolver.isInReminderWindow(panel, now: opening.addingTimeInterval(-0.001))
        == false
    )
  }

  /// No reminder, or one at the start time, has no leave window: the
  /// complication shows Up Next then, not a leave countdown.
  @Test(arguments: [nil, 0, -5] as [Int?])
  func aPanelWithoutALeadTimeHasNoWindow(minutes: Int?) {
    let panel = event("panel", from: local(20, 14), reminderMinutes: minutes)
    #expect(WatchGoWindow.opening(of: panel) == nil)
    let schedule = WatchScheduleProjection(
      snapshot: snapshot([panel]),
      now: local(20, 13, 59)
    )
    #expect(schedule.nextEvent?.id == "panel")
    #expect(schedule.goEvent == nil)
    #expect(schedule.goAnnouncement == nil)
  }

  // MARK: The haptic

  /// Home waits for Up Next's window to open, wherever that is in the day.
  @Test func theAnnouncementIsUpNextsOpening() {
    let schedule = WatchScheduleProjection(snapshot: snapshot(dayOne), now: local(20, 9, 10))
    #expect(
      schedule.goAnnouncement
        == WatchGoWindow.Announcement(eventID: "art-jam", opening: local(20, 9, 50))
    )
  }

  /// Trivia's window opened at 9:30 while Art Jam was Up Next. When Art Jam
  /// starts at 10:00 the Go card moves to Trivia without a buzz: that window
  /// did not open now.
  @Test func aWindowThatOpenedBehindAnotherPanelNeverBuzzes() throws {
    let schedule = WatchScheduleProjection(snapshot: snapshot(dayOne), now: local(20, 10))
    #expect(schedule.goEvent?.id == "trivia")
    let announcement = try #require(schedule.goAnnouncement)
    #expect(announcement.opening == local(20, 9, 30))
    #expect(WatchGoWindow.isOnTime(announcement, at: local(20, 10)) == false)
  }

  /// The countdown screen hands over to Home at the very moment the first
  /// panel's window opens, so Home appears on time to announce it.
  @Test func theCountdownHandoverAnnouncesOnTime() throws {
    let moment = local(19, 19, 30)
    #expect(
      ConPawsScheduleResolver.countdownEnd(of: snapshot(dayOne).conventions[0]) == moment
    )
    let announcement = try #require(
      WatchScheduleProjection(snapshot: snapshot(dayOne), now: moment).goAnnouncement
    )
    #expect(announcement.eventID == "eve-meetup")
    #expect(WatchGoWindow.isOnTime(announcement, at: moment))
  }

  /// Seconds after the opening. A wake much later than that is an app coming
  /// back from the background or launched mid-window, not a window opening
  /// in front of the wearer, and the iPhone's reminder has had its own tap.
  @Test(arguments: [
    (-5.0, false),
    (-1.0, true),
    (0.0, true),
    (9.9, true),
    (WatchGoWindow.announcementTolerance, false),
    (60.0, false),
  ])
  func onlyAnOnTimeWakeBuzzes(secondsAfterOpening: TimeInterval, buzzes: Bool) {
    let announcement = WatchGoWindow.Announcement(eventID: "panel", opening: local(20, 14))
    #expect(
      WatchGoWindow.isOnTime(
        announcement,
        at: local(20, 14).addingTimeInterval(secondsAfterOpening)
      ) == buzzes
    )
  }

  // MARK: Fixtures

  /// A pre-convention meet-up, back-to-back panels with overlapping windows,
  /// panels with no lead time, one starting on the half minute and one
  /// across midnight.
  private var dayOne: [ConPawsEventSnapshot] {
    [
      event("eve-meetup", from: local(19, 20), until: local(19, 21), reminderMinutes: 30),
      event("opening", from: local(20, 9), until: local(20, 10), reminderMinutes: 15),
      event("art-jam", from: local(20, 10), until: local(20, 10, 45), reminderMinutes: 10),
      event("trivia", from: local(20, 10, 30), until: local(20, 11, 30), reminderMinutes: 60),
      event("no-reminder", from: local(20, 13), until: local(20, 14)),
      event("at-start", from: local(20, 15), until: local(20, 15, 30), reminderMinutes: 0),
      event(
        "on-the-half-minute",
        from: local(20, 16, 0, 30),
        until: local(20, 17),
        reminderMinutes: 5
      ),
      event("late-show", from: local(21, 0, 15), until: local(21, 1), reminderMinutes: 45),
    ]
  }

  private func leaveEventID(_ projection: ConPawsComplicationProjection) -> String? {
    if case .leave(_, let upcoming, _) = projection.state { return upcoming.id }
    return nil
  }

  private func snapshot(_ events: [ConPawsEventSnapshot]) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: local(19, 18).timeIntervalSince1970 * 1_000,
      localeIdentifier: "en",
      conventions: [
        ConPawsConventionSnapshot(
          id: "con",
          name: "con",
          startAtMs: local(20, 8).timeIntervalSince1970 * 1_000,
          endAtMs: local(23, 18).timeIntervalSince1970 * 1_000,
          timeZoneIdentifier: chicago.identifier,
          dateRangeLabel: "",
          events: events,
          options: nil
        ),
      ]
    )
  }

  private func event(
    _ id: String,
    from start: Date,
    until end: Date? = nil,
    reminderMinutes: Int? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: id,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.map { $0.timeIntervalSince1970 * 1_000 },
      location: nil,
      room: "Hall A",
      reminderMinutes: reminderMinutes,
      ageRating: nil,
      summary: nil
    )
  }
}

// File scope, so the test arguments, which are built before any suite
// instance exists, can name moments too.
private let chicago = TimeZone(identifier: "America/Chicago")!

/// A wall-clock moment in Chicago in November 2026.
private func local(_ day: Int, _ hour: Int, _ minute: Int = 0, _ second: Int = 0) -> Date {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = chicago
  return calendar.date(
    from: DateComponents(
      year: 2026, month: 11, day: day, hour: hour, minute: minute, second: second
    )
  )!
}
