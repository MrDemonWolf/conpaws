import Foundation

/// What the circular, corner and inline complications draw, resolved from the
/// same projection as the rectangular card. Foundation-only, so swift-tests
/// covers it; the views in targets/watch-widget only lay it out.
///
/// Each family is a slice of the rectangular card sized to its slot:
///
/// - A ring only where the timeline redraws it: every minute in the leave
///   window, daily then hourly before a convention. An up-next card has no
///   entries between its state changes, so it shows a clock time, which never
///   goes stale, rather than a countdown that would.
/// - A running panel's ring is filled by the system between its published
///   start and end; no entry would move it, and no end is ever invented.
/// - A panel's title and room are drawn only while the face is not redacted
///   (`redacted`), because the inline family is a single line of text and
///   cannot mark part of it `privacySensitive`.
/// - Times and countdowns are never hidden.
enum ConPawsComplicationFace {
  /// The symbol every family draws for a plan that may be out of date, the
  /// same one the rectangular card's eyebrow trails.
  static let staleSymbol = "exclamationmark.arrow.circlepath"

  // MARK: Pieces

  /// A wait as a number and its unit, "18" and "min", and as the one line
  /// the compact format writes, "18 min". From the compact formats the app
  /// already words its countdowns with, so a circle and a corner agree.
  struct Count: Equatable, Sendable {
    let value: String
    let unit: String
    let text: String

    init(value: String, unit: String, text: String) {
      self.value = value
      self.unit = unit
      self.text = text
    }

    /// Splits a number-first compact format ("%@ min", "%@時間") around its
    /// number. swift-tests checks every language's formats are number-first.
    init(value: String, format: String, strings: ConPawsStrings) {
      self.value = value
      unit = format.replacingOccurrences(of: "%@", with: "").trimmingCharacters(in: .whitespaces)
      text = strings.text(format, value)
    }
  }

  /// A clock time split into its digits and its day period, "2:00" and
  /// "PM", so a circle can stack them. The period is empty on a 24-hour
  /// clock, and comes from the locale wherever it sits ("午後2:00").
  struct Clock: Equatable, Sendable {
    let digits: String
    let period: String
  }

  /// What sits alone in a circle or a corner, or tops a stacked circle.
  enum Glyph: Equatable, Sendable {
    /// The ConPaws mark, at 16 points or more.
    case mark
    case symbol(String)
    case text(String)
  }

  // MARK: Circular

  enum Circular: Equatable, Sendable {
    /// A ring filling toward a start, with the wait stacked in its centre.
    case ring(progress: Double, count: Count)
    /// A running panel's ring, filled by the system from its published start
    /// to its published end; the centre is the end time.
    case panelRing(ClosedRange<Date>, end: Clock)
    /// A glyph over a value over an optional detail line.
    case stack(Glyph, value: String, detail: String?)
    /// Only a glyph: nothing to count and no panel to time.
    case glyph(Glyph)
  }

  static func circular(
    _ projection: ConPawsComplicationProjection,
    strings: ConPawsStrings,
    locale: Locale
  ) -> Circular {
    let now = projection.now
    let stale = projection.isStale
    switch projection.state {
    case .comingUp(let convention):
      guard
        let parts = ConPawsCountdown.compactParts(
          from: now,
          to: convention.startDate,
          timeZone: convention.timeZone,
          strings: strings
        )
      else { return .glyph(stale ? .symbol(staleSymbol) : .mark) }
      let count = Count(value: parts.value, format: parts.format, strings: strings)
      if stale { return .stack(.symbol(staleSymbol), value: count.value, detail: count.unit) }
      return .ring(progress: ConPawsCountdown.ringProgress(from: now, to: convention.startDate), count: count)
    case .leave(_, let next, _):
      let parts = ConPawsCountdown.leaveParts(from: now, to: next.startDate, strings: strings)
      let count = Count(value: parts.value, format: parts.format, strings: strings)
      if stale { return .stack(.symbol(staleSymbol), value: count.value, detail: count.unit) }
      let progress = ConPawsCountdown.leaveProgress(
        from: now,
        to: next.startDate,
        windowMinutes: next.reminderMinutes ?? 0
      )
      return .ring(progress: progress, count: count)
    case .next(_, let event, let convention):
      let start = clock(event.startDate, timeZone: convention.timeZone, locale: locale)
      let day = weekday(event.startDate, relativeTo: now, in: convention, locale: locale)
      let detail = [day, start.period].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
      return .stack(
        stale ? .symbol(staleSymbol) : .mark,
        value: start.digits,
        detail: detail.isEmpty ? nil : detail
      )
    case .current(let event, let convention):
      let interval = publishedInterval(of: event)
      if let interval, !stale {
        return .panelRing(interval, end: clock(interval.upperBound, timeZone: convention.timeZone, locale: locale))
      }
      // Stale, the ring gives its place to the flag and the end time stays;
      // without a published end the card says it is on now and since when.
      let shown = clock(interval?.upperBound ?? event.startDate, timeZone: convention.timeZone, locale: locale)
      return .stack(
        stale ? .symbol(staleSymbol) : .text(strings.compactNow),
        value: shown.digits,
        detail: shown.period.isEmpty ? nil : shown.period
      )
    case .finished, .noPicks, .ended, .noConvention:
      return .glyph(stale ? .symbol(staleSymbol) : .mark)
    }
  }

  /// Text along the bezel above the Infograph face's top circle.
  struct Bezel: Equatable, Sendable {
    let text: String
    /// Whether it names a panel, which the view marks `privacySensitive`.
    let isPrivate: Bool
  }

  /// The label the Infograph face's top circle draws along the bezel, or nil
  /// for none. Nearly half the bezel, so it names what the circle cannot:
  /// the panel and its room, never wrist down, or the convention or status.
  static func bezel(
    _ projection: ConPawsComplicationProjection,
    strings: ConPawsStrings,
    redacted: Bool
  ) -> Bezel? {
    switch projection.state {
    case .comingUp(let convention):
      return Bezel(text: convention.name, isPrivate: false)
    case .leave(_, let event, _), .next(_, let event, _), .current(let event, _):
      guard !redacted else { return nil }
      let text = [event.title, event.shortPlace].compactMap { $0 }.joined(separator: " · ")
      return Bezel(text: text, isPrivate: true)
    case .finished, .noPicks, .ended, .noConvention:
      return projection.status(strings: strings).map { Bezel(text: $0.title, isPrivate: false) }
    }
  }

  // MARK: Corner

  /// A corner draws its content along the outer curve and its label along
  /// the inner one.
  struct Corner: Equatable, Sendable {
    enum Content: Equatable, Sendable {
      /// Lines longest first; the face draws the first that fits.
      case text([String])
      case glyph(Glyph)
    }

    enum Label: Equatable, Sendable {
      /// No inner curve: the content fills the large corner circle.
      case empty
      /// A curved bar filled to this fraction.
      case gauge(Double)
      /// A curved bar the system fills from a panel's start to its end.
      case panel(ClosedRange<Date>)
      /// Curved text; `isPrivate` for a room, which the view also marks
      /// `privacySensitive`.
      case text(String, isPrivate: Bool)
    }

    let content: Content
    let label: Label
    /// Whether the label carries the stale symbol: before its text, or in
    /// place of a bar.
    let isStale: Bool
  }

  static func corner(
    _ projection: ConPawsComplicationProjection,
    strings: ConPawsStrings,
    locale: Locale,
    redacted: Bool
  ) -> Corner {
    let now = projection.now
    let stale = projection.isStale
    switch projection.state {
    case .comingUp(let convention):
      guard
        let parts = ConPawsCountdown.compactParts(
          from: now,
          to: convention.startDate,
          timeZone: convention.timeZone,
          strings: strings
        )
      else { return Corner(content: .glyph(.mark), label: .empty, isStale: stale) }
      return Corner(
        content: .text([strings.text(parts.format, parts.value)]),
        label: .gauge(ConPawsCountdown.ringProgress(from: now, to: convention.startDate)),
        isStale: stale
      )
    case .leave(_, let next, _):
      let parts = ConPawsCountdown.leaveParts(from: now, to: next.startDate, strings: strings)
      return Corner(
        content: .text([strings.text(parts.format, parts.value)]),
        label: .gauge(
          ConPawsCountdown.leaveProgress(from: now, to: next.startDate, windowMinutes: next.reminderMinutes ?? 0)
        ),
        isStale: stale
      )
    case .next(_, let event, let convention):
      let time = ConPawsFormat.time(event.startDate, in: convention, locale: locale)
      let digits = clock(event.startDate, timeZone: convention.timeZone, locale: locale).digits
      // Another day keeps its day in every line: a bare "10:00 AM" reads as
      // today.
      let lines = weekday(event.startDate, relativeTo: now, in: convention, locale: locale)
        .map { day in ["\(day) \(time)", "\(day) \(digits)"] } ?? [time, digits]
      return Corner(
        content: .text(lines),
        label: roomLabel(event, redacted: redacted, fallback: strings.upNextCaps),
        isStale: stale
      )
    case .current(let event, let convention):
      let zone = convention.timeZone
      guard let interval = publishedInterval(of: event) else {
        let time = ConPawsFormat.time(event.startDate, in: convention, locale: locale)
        return Corner(
          content: .text([time, clock(event.startDate, timeZone: zone, locale: locale).digits]),
          label: roomLabel(event, redacted: redacted, fallback: strings.compactNow.uppercased(with: locale)),
          isStale: stale
        )
      }
      let end = interval.upperBound
      return Corner(
        content: .text([
          event.currentTimingLabel(timeZone: zone, locale: locale, strings: strings),
          ConPawsFormat.time(end, in: convention, locale: locale),
          clock(end, timeZone: zone, locale: locale).digits,
        ]),
        label: .panel(interval),
        isStale: stale
      )
    case .finished, .noPicks, .ended, .noConvention:
      return Corner(content: .glyph(.mark), label: .empty, isStale: stale)
    }
  }

  /// The room while it may be shown, otherwise a heading that names no one.
  private static func roomLabel(
    _ event: ConPawsEventSnapshot,
    redacted: Bool,
    fallback: String
  ) -> Corner.Label {
    guard !redacted, let room = event.shortPlace else { return .text(fallback, isPrivate: false) }
    return .text(room, isPrivate: true)
  }

  // MARK: Inline

  /// One line of text with an optional symbol, as the face draws it: above
  /// the time, along the dial, or across the bottom.
  struct Inline: Equatable, Sendable {
    let symbol: String?
    /// Longest first; the face draws the first that fits its slot. Each
    /// shorter line drops the room before anything that says when.
    let lines: [String]
  }

  static func inline(
    _ projection: ConPawsComplicationProjection,
    strings: ConPawsStrings,
    locale: Locale,
    redacted: Bool
  ) -> Inline {
    let now = projection.now
    let symbol: String?
    let lines: [String]
    switch projection.state {
    case .comingUp(let convention):
      let label = ConPawsCountdown.label(
        from: now,
        to: convention.startDate,
        timeZone: convention.timeZone,
        strings: strings
      )
      symbol = "calendar"
      lines = ["\(label) · \(convention.name)", label]
    case .leave(_, let next, let convention):
      let lead = ConPawsCountdown.leaveLead(
        from: now,
        to: next.startDate,
        timeZone: convention.timeZone,
        strings: strings
      )
      symbol = "bell"
      lines = withRoom(lead.text, next, redacted: redacted) + [lead.minutes].compactMap { $0 }
    case .next(_, let event, let convention):
      let time = ConPawsFormat.nextEventTime(
        event.startDate,
        relativeTo: now,
        in: convention,
        locale: locale,
        strings: strings
      )
      symbol = "clock"
      lines = withRoom(time, event, redacted: redacted)
    case .current(let event, let convention):
      let timing = publishedInterval(of: event) == nil
        ? strings.now
        : event.currentTimingLabel(timeZone: convention.timeZone, locale: locale, strings: strings)
      symbol = "clock"
      lines = withRoom(timing, event, redacted: redacted)
    case .noPicks:
      symbol = nil
      lines = [strings.noPicksComplication, strings.complication.inlineNoPicks]
    case .finished:
      symbol = nil
      lines = [strings.finishedComplication, strings.complication.inlineFinished]
    case .ended, .noConvention:
      symbol = nil
      lines = projection.status(strings: strings).map { [$0.title] } ?? []
    }
    return Inline(symbol: projection.isStale ? staleSymbol : symbol, lines: lines)
  }

  /// "2:00 PM · Hall A" then "2:00 PM", or the time alone when the room may
  /// not be shown or there is none.
  private static func withRoom(_ lead: String, _ event: ConPawsEventSnapshot, redacted: Bool) -> [String] {
    guard !redacted, let room = event.shortPlace else { return [lead] }
    return ["\(lead) · \(room)", lead]
  }

  // MARK: Dates

  /// A panel's published start to end, or nil without a published end, or
  /// with one that is not after the start, where a range would trap.
  static func publishedInterval(of event: ConPawsEventSnapshot) -> ClosedRange<Date>? {
    guard let end = event.endDate, end > event.startDate else { return nil }
    return event.startDate...end
  }

  /// `date`'s time in `locale` and the convention's zone, split into digits
  /// and day period.
  static func clock(_ date: Date, timeZone: TimeZone, locale: Locale) -> Clock {
    let style = Date.FormatStyle(
      date: .omitted,
      time: .shortened,
      locale: locale,
      calendar: ConPawsCalendar.convention(in: timeZone),
      timeZone: timeZone
    )
    let formatted = date.formatted(style.attributed)
    var digits = ""
    var period = ""
    for (field, range) in formatted.runs[\.dateField] {
      let text = String(formatted[range].characters)
      if field == .amPM { period += text } else { digits += text }
    }
    return Clock(
      digits: digits.trimmingCharacters(in: .whitespaces),
      period: period.trimmingCharacters(in: .whitespaces)
    )
  }

  /// "Sun" for a date on another day in the convention's zone; nil for today.
  private static func weekday(
    _ date: Date,
    relativeTo now: Date,
    in convention: ConPawsConventionSnapshot,
    locale: Locale
  ) -> String? {
    guard !convention.calendar.isDate(date, inSameDayAs: now) else { return nil }
    let style = Date.FormatStyle(locale: locale, calendar: convention.calendar, timeZone: convention.timeZone)
      .weekday(.abbreviated)
    return date.formatted(style)
  }
}
