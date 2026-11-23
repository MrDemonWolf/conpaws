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

  // MARK: Whole summaries

  /// What VoiceOver reads for the card at the projection's moment, whichever
  /// family draws it: each draws a slice of the same card, so all of them
  /// speak this. `redacted` is the face's privacy redaction (wrist down with
  /// sensitive complications hidden): the label replaces the drawn children,
  /// so `privacySensitive` on them never reaches VoiceOver, and the summary
  /// itself must leave out titles and rooms. `stale` is `staleNotice`.
  static func summary(
    _ projection: ConPawsComplicationProjection,
    strings: ConPawsStrings,
    locale: Locale,
    redacted: Bool,
    stale: String?
  ) -> String {
    let now = projection.now
    let spoken: String
    switch projection.state {
    case .comingUp(let convention):
      spoken = comingUp(convention, now: now, strings: strings)
    case .leave(let current, let next, let convention):
      let startTime = ConPawsFormat.nextEventTime(
        next.startDate,
        relativeTo: now,
        in: convention,
        locale: locale,
        strings: strings
      )
      if redacted {
        let lead = ConPawsCountdown.leaveLead(
          from: now,
          to: next.startDate,
          timeZone: convention.timeZone,
          strings: strings
        )
        spoken = leaveRedacted(lead: lead, startTime: startTime)
      } else {
        spoken = leave(current: current, next: next, now: now, startTime: startTime, strings: strings)
      }
    case .next(let current, let event, let convention):
      spoken = next(
        current: current,
        event: event,
        startTime: ConPawsFormat.nextEventTime(
          event.startDate,
          relativeTo: now,
          in: convention,
          locale: locale,
          strings: strings
        ),
        reminder: ConPawsFormat.reminderAt(event, in: convention, locale: locale, strings: strings),
        redacted: redacted,
        strings: strings
      )
    case .current(let event, let convention):
      spoken = current(
        event,
        timeRange: ConPawsFormat.timeRange(event, in: convention, locale: locale),
        redacted: redacted,
        strings: strings
      )
    case .finished, .noPicks, .ended, .noConvention:
      spoken = projection.status(strings: strings).map(status) ?? ""
    }
    return withStale(spoken, stale: stale)
  }

  /// The leave card wrist down: "Starts in 18 min, 2:00 PM.", only the lead
  /// and the clock time, which stay drawn.
  static func leaveRedacted(lead: ConPawsCountdown.LeaveLead, startTime: String) -> String {
    "\(lead.text), \(startTime)."
  }

  /// "Next event: Fursuit Meetup, starts 2:00 PM, Hall A. Reminder at
  /// 1:50 PM · 10 min before.", with the running panel first when there is
  /// one. Redacted: "UP NEXT, 2:00 PM." and the reminder, without the panel,
  /// the running one or the place.
  static func next(
    current: ConPawsEventSnapshot?,
    event: ConPawsEventSnapshot,
    startTime: String,
    reminder: String?,
    redacted: Bool,
    strings: ConPawsStrings
  ) -> String {
    let reminderText = reminder.map { ". \($0)" } ?? ""
    if redacted {
      return "\(strings.upNextCaps), \(startTime)\(reminderText)."
    }
    let next = strings.text(strings.nextEventA11yFormat, event.title, startTime)
    let currentText = current.map { "\(strings.happeningNowCaps), \($0.title). " } ?? ""
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(currentText)\(next)\(place)\(reminderText)."
  }

  /// "HAPPENING NOW, Art Jam, 1:00 PM–2:30 PM, Studio B. No later saved
  /// events." Redacted: the heading, the times and the closing sentence.
  static func current(
    _ event: ConPawsEventSnapshot,
    timeRange: String,
    redacted: Bool,
    strings: ConPawsStrings
  ) -> String {
    if redacted {
      return "\(strings.happeningNowCaps), \(timeRange). \(strings.noLaterSavedEventsShort)."
    }
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(strings.happeningNowCaps), \(event.title), \(timeRange)\(place). \(strings.noLaterSavedEventsShort)."
  }

  /// A status card's heading and the line under it.
  static func status(_ status: ConPawsComplicationProjection.Status) -> String {
    "\(status.title), \(status.detail)"
  }

  /// `summary` with the stale sentence after it, or unchanged while the plan
  /// is fresh.
  static func withStale(_ summary: String, stale: String?) -> String {
    guard let stale else { return summary }
    let endsSentence = summary.last.map { ".。!?！？".contains($0) } ?? true
    return endsSentence ? "\(summary) \(stale)" : "\(summary). \(stale)"
  }
}
