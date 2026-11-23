import Foundation

/// The parts of the complication's VoiceOver labels that change with time.
///
/// WidgetKit keeps each timeline entry's accessibility label with its pixels
/// until the next entry, and the timeline places entries only where the drawn
/// wording changes (`ConPawsCountdown.changePoints` and `leaveChangePoints`).
/// So a spoken countdown moves in the same steps as the drawn one: a label
/// worked out to the minute at a midnight entry was still read out, unchanged,
/// at eight that evening. Foundation-only, so swift-tests covers it.
enum ConPawsComplicationSpeech {
  /// "Coming up, FurCon, in 11 days": the ladder the card draws, cased for
  /// the middle of a sentence.
  static func comingUp(
    _ convention: ConPawsConventionSnapshot,
    now: Date,
    strings: ConPawsStrings
  ) -> String {
    let countdown = ConPawsCountdown.label(
      from: now,
      to: convention.startDate,
      timeZone: convention.timeZone,
      strings: strings
    )
    return strings.text(
      strings.comingUpA11yFormat,
      convention.name,
      strings.midSentenceCountdown(countdown)
    )
  }

  /// The wait for the leave card's "Starts in %@": whole minutes in the final
  /// hour, the count the card draws and the timeline ticks every minute, and
  /// whole hours above it, where the timeline ticks hourly. In the case the
  /// sentence's preposition takes, and never "0 hours".
  static func leaveCountdown(from now: Date, to start: Date, strings: ConPawsStrings) -> String {
    if let minutes = ConPawsCountdown.leaveMinutes(from: now, to: start) {
      return strings.minutes(minutes, oblique: true)
    }
    return strings.hours(Int(start.timeIntervalSince(now) / 3_600), oblique: true)
  }

  /// The sentence VoiceOver adds to every state while the plan is stale, or
  /// nil while it is fresh. It names no age: the timeline adds an entry where
  /// the plan turns stale and then only at state changes, so an age worked
  /// out at that entry said "30 min. ago" for the rest of the night. The
  /// Watch app redraws every minute and keeps its age.
  ///
  /// The eyebrow draws its symbol from this too, so the drawn flag, the
  /// spoken one and the entry the timeline places all follow the
  /// projection's state-dependent rule.
  static func staleNotice(_ snapshot: ConPawsSnapshot, now: Date) -> String? {
    guard ConPawsComplicationProjection(snapshot: snapshot, now: now).isStale else { return nil }
    return snapshot.strings.staleNoticeA11y
  }

  /// "Starts in 18 minutes for Fursuit Meetup, at 2:00 PM.", with the panel
  /// still running named when there is one.
  static func leave(
    current: ConPawsEventSnapshot?,
    next: ConPawsEventSnapshot,
    now: Date,
    startTime: String,
    strings: ConPawsStrings
  ) -> String {
    let countdown = leaveCountdown(from: now, to: next.startDate, strings: strings)
    if let current {
      return strings.text(
        strings.startsWithCurrentA11yFormat,
        countdown,
        current.title,
        next.title,
        startTime
      )
    }
    return strings.text(strings.startsA11yFormat, countdown, next.title, startTime)
  }
}
