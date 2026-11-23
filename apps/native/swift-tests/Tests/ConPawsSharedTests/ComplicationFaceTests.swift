import Foundation
import Testing
@testable import ConPawsShared

/// What the circular, corner and inline complications draw for each state.
/// Each is a small slice of the rectangular card: a countdown ring where the
/// timeline moves it, a clock time where nothing would move it, and the
/// room only while the face is not redacted.
struct ComplicationFaceTests {
  private typealias Face = ConPawsComplicationFace
  private let strings = ConPawsStrings.english
  private let locale = FaceFixture.english

  private let talk = FaceFixture.event("Talk", from: FaceFixture.local(21, 16), room: "Hall B")
  private let openPlay = FaceFixture.event("Open Play", from: FaceFixture.local(21, 13), room: "Lounge")
  private let sundayBrunch = FaceFixture.event("Brunch", from: FaceFixture.local(22, 10))

  private func time(_ date: Date) -> String {
    ConPawsFormat.time(date, in: FaceFixture.convention(), locale: locale)
  }

  // MARK: Circular

  /// The week before a convention fills the ring; the centre is the wait as
  /// a number over its unit, the same ladder the card words.
  @Test func circularCountsDownToTheConventionOnAWeekLongRing() {
    let card = FaceFixture.projection([], at: FaceFixture.local(17, 9))
    let expected = Face.Circular.ring(
      progress: 1 - 63.0 / 168.0,
      count: .init(value: "3", unit: "d", text: "3d")
    )
    #expect(Face.circular(card, strings: strings, locale: locale) == expected)
  }

  @Test(arguments: [
    (FaceFixture.local(19, 23, 20), "<1", "h", "<1h"), // the final hour: never minutes
    (FaceFixture.local(19, 18), "6", "h", "6h"),
    (FaceFixture.local(19, 0), "1", "d", "1d"), // tomorrow
    (FaceFixture.local(1, 9, month: 9), "2", "mo", "2mo"),
  ])
  func circularUsesTheCardsLadder(now: Date, value: String, unit: String, text: String) throws {
    let card = FaceFixture.projection([], at: now)
    guard case .ring(_, let count) = Face.circular(card, strings: strings, locale: locale) else {
      Issue.record("expected a ring")
      return
    }
    #expect(count == .init(value: value, unit: unit, text: text))
  }

  @Test func circularRingIsEmptyMoreThanAWeekOut() {
    let card = FaceFixture.projection([], at: FaceFixture.local(1, 9, month: 9))
    guard case .ring(let progress, _) = Face.circular(card, strings: strings, locale: locale) else {
      Issue.record("expected a ring")
      return
    }
    #expect(progress == 0)
  }

  /// The leave window's ring fills from the reminder to the start, a minute
  /// at a time, which is how often the timeline redraws it.
  @Test func circularLeaveRingFillsOverTheReminderWindow() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    let expected = Face.Circular.ring(
      progress: 0.4,
      count: .init(value: "18", unit: "min", text: "18 min")
    )
    #expect(Face.circular(card, strings: strings, locale: locale) == expected)
  }

  @Test func circularLeaveCountsInTheAppsLanguage() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    guard case .ring(_, let count) = Face.circular(card, strings: .resolve("uk"), locale: locale) else {
      Issue.record("expected a ring")
      return
    }
    #expect(count == .init(value: "18", unit: "хв", text: "18 хв"))
  }

  /// Nothing redraws an up-next card between its state changes, so it shows
  /// when the panel starts, never a countdown that would sit there stale.
  @Test func circularShowsTheNextPanelsClockTime() {
    let card = FaceFixture.projection([talk], at: FaceFixture.local(21, 12))
    #expect(Face.circular(card, strings: strings, locale: locale) == .stack(.mark, value: "4:00", detail: "PM"))
    #expect(
      Face.circular(card, strings: .resolve("de"), locale: FaceFixture.german)
        == .stack(.mark, value: "16:00", detail: nil)
    )
  }

  @Test func circularNamesTheDayOfAPanelOnAnotherDay() {
    let card = FaceFixture.projection([sundayBrunch], at: FaceFixture.local(21, 20))
    #expect(
      Face.circular(card, strings: strings, locale: locale)
        == .stack(.mark, value: "10:00", detail: "Sun AM")
    )
  }

  /// A running panel with a published end fills a ring the system animates,
  /// because no timeline entry would move it; the centre is when it ends.
  @Test func circularFillsARunningPanelsRingTowardItsEnd() {
    let card = FaceFixture.projection([FaceFixture.artJam], at: FaceFixture.local(21, 13, 30))
    #expect(
      Face.circular(card, strings: strings, locale: locale)
        == .panelRing(
          FaceFixture.local(21, 13)...FaceFixture.local(21, 14, 30),
          end: .init(digits: "2:30", period: "PM")
        )
    )
  }

  /// Without a published end there is no end to fill toward, and none is
  /// invented: the card says it is on now and when it started.
  @Test func circularRunningPanelWithoutAnEndSaysNow() {
    let card = FaceFixture.projection([openPlay], at: FaceFixture.local(21, 13, 30))
    #expect(
      Face.circular(card, strings: strings, locale: locale)
        == .stack(.text("Now"), value: "1:00", detail: "PM")
    )
  }

  @Test(arguments: [
    (13.0, 13.0), // no length
    (13.0, 12.0), // ends before it starts
  ])
  func aPanelThatEndsBeforeItStartsHasNoRing(startHour: Double, endHour: Double) {
    let panel = FaceFixture.event(
      "Bad",
      from: FaceFixture.local(21, 0).addingTimeInterval(startHour * 3_600),
      until: FaceFixture.local(21, 0).addingTimeInterval(endHour * 3_600)
    )
    #expect(Face.publishedInterval(of: panel) == nil)
  }

  @Test func circularStatusIsTheMark() {
    let card = FaceFixture.projection([], at: FaceFixture.local(21, 12))
    #expect(Face.circular(card, strings: strings, locale: locale) == .glyph(.mark))
  }

  /// An old plan swaps the top of the circle (or the ring) for the stale
  /// symbol and keeps the number, as the card keeps its countdown.
  @Test func circularFlagsAStalePlanAndKeepsTheCount() {
    let now = FaceFixture.local(21, 13, 42)
    let card = FaceFixture.projection([FaceFixture.meetup], at: now, generatedAt: now.addingTimeInterval(-7_200))
    #expect(
      Face.circular(card, strings: strings, locale: locale)
        == .stack(.symbol(Face.staleSymbol), value: "18", detail: "min")
    )
    let status = FaceFixture.projection([], at: now, generatedAt: now.addingTimeInterval(-7_200))
    #expect(Face.circular(status, strings: strings, locale: locale) == .glyph(.symbol(Face.staleSymbol)))
  }

  // MARK: Circular bezel

  /// The Infograph top slot draws a label along the bezel: the panel's name
  /// and room while they may be shown, nothing wrist down.
  @Test func bezelNamesThePanelUntilTheFaceIsRedacted() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    #expect(Face.bezel(card, strings: strings, redacted: false) == "Fursuit Meetup · Hall A")
    #expect(Face.bezel(card, strings: strings, redacted: true) == nil)
  }

  @Test func bezelNamesTheConventionOrTheStatus() {
    let countdown = FaceFixture.projection([], at: FaceFixture.local(17, 9))
    #expect(Face.bezel(countdown, strings: strings, redacted: true) == "FurCon")
    let status = FaceFixture.projection([], at: FaceFixture.local(21, 12))
    #expect(Face.bezel(status, strings: strings, redacted: true) == "Add panels on iPhone")
  }

  // MARK: Corner

  @Test func cornerCountsDownWithACurvedGauge() {
    let countdown = FaceFixture.projection([], at: FaceFixture.local(17, 9))
    #expect(
      Face.corner(countdown, strings: strings, locale: locale, redacted: false)
        == .init(content: .text(["3d"]), label: .gauge(1 - 63.0 / 168.0), isStale: false)
    )
    let leave = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    #expect(
      Face.corner(leave, strings: strings, locale: locale, redacted: false)
        == .init(content: .text(["18 min"]), label: .gauge(0.4), isStale: false)
    )
  }

  @Test func cornerShowsTheNextPanelsTimeAndRoom() {
    let card = FaceFixture.projection([talk], at: FaceFixture.local(21, 12))
    let content = Face.Corner.Content.text([time(talk.startDate), "4:00"])
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: false)
        == .init(content: content, label: .text("Hall B", isPrivate: true), isStale: false)
    )
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: true)
        == .init(content: content, label: .text("UP NEXT", isPrivate: false), isStale: false)
    )
  }

  @Test func cornerKeepsTheDayOfAPanelOnAnotherDay() {
    let card = FaceFixture.projection([sundayBrunch], at: FaceFixture.local(21, 20))
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: false).content
        == .text(["Sun \(time(sundayBrunch.startDate))", "Sun 10:00"])
    )
  }

  @Test func cornerFillsARunningPanelTowardItsEnd() throws {
    let card = FaceFixture.projection([FaceFixture.artJam], at: FaceFixture.local(21, 13, 30))
    let end = try #require(FaceFixture.artJam.endDate)
    let until = FaceFixture.artJam.currentTimingLabel(timeZone: FaceFixture.zone, locale: locale, strings: strings)
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: false)
        == .init(
          content: .text([until, time(end), "2:30"]),
          label: .panel(FaceFixture.local(21, 13)...end),
          isStale: false
        )
    )
  }

  @Test func cornerRunningPanelWithoutAnEndShowsItsStartAndRoom() {
    let card = FaceFixture.projection([openPlay], at: FaceFixture.local(21, 13, 30))
    let content = Face.Corner.Content.text([time(openPlay.startDate), "1:00"])
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: false)
        == .init(content: content, label: .text("Lounge", isPrivate: true), isStale: false)
    )
    #expect(
      Face.corner(card, strings: strings, locale: locale, redacted: true)
        == .init(content: content, label: .text("NOW", isPrivate: false), isStale: false)
    )
  }

  @Test func cornerStatusIsTheMarkAndFlagsAStalePlan() {
    let now = FaceFixture.local(21, 12)
    let fresh = FaceFixture.projection([], at: now)
    #expect(
      Face.corner(fresh, strings: strings, locale: locale, redacted: false)
        == .init(content: .glyph(.mark), label: .none, isStale: false)
    )
    let stale = FaceFixture.projection([], at: now, generatedAt: now.addingTimeInterval(-7_200))
    #expect(Face.corner(stale, strings: strings, locale: locale, redacted: false).isStale)
  }

  // MARK: Inline

  @Test func inlineCountsDownToTheConvention() {
    let card = FaceFixture.projection([], at: FaceFixture.local(17, 9))
    #expect(
      Face.inline(card, strings: strings, locale: locale, redacted: false)
        == .init(symbol: "calendar", lines: ["In 3 days · FurCon", "In 3 days"])
    )
  }

  /// Longest first: the face shows the first line that fits its slot.
  @Test func inlineLeaveLinesShortenWithoutLosingTheCount() {
    let card = FaceFixture.projection([FaceFixture.meetup], at: FaceFixture.local(21, 13, 42))
    #expect(
      Face.inline(card, strings: strings, locale: locale, redacted: false)
        == .init(symbol: "bell", lines: ["Starts in 18 min · Hall A", "Starts in 18 min", "18 min"])
    )
    #expect(
      Face.inline(card, strings: strings, locale: locale, redacted: true)
        == .init(symbol: "bell", lines: ["Starts in 18 min", "18 min"])
    )
  }

  @Test func inlineNextIsTheTimeAndTheRoom() {
    let card = FaceFixture.projection([talk], at: FaceFixture.local(21, 12))
    let start = time(talk.startDate)
    #expect(
      Face.inline(card, strings: strings, locale: locale, redacted: false)
        == .init(symbol: "clock", lines: ["\(start) · Hall B", start])
    )
    #expect(
      Face.inline(card, strings: strings, locale: locale, redacted: true)
        == .init(symbol: "clock", lines: [start])
    )
  }

  @Test func inlineRunningPanelSaysUntilOrNow() {
    let withEnd = FaceFixture.projection([FaceFixture.artJam], at: FaceFixture.local(21, 13, 30))
    let until = FaceFixture.artJam.currentTimingLabel(timeZone: FaceFixture.zone, locale: locale, strings: strings)
    #expect(
      Face.inline(withEnd, strings: strings, locale: locale, redacted: false)
        == .init(symbol: "clock", lines: ["\(until) · Studio B", until])
    )
    let open = FaceFixture.projection([openPlay], at: FaceFixture.local(21, 13, 30))
    #expect(
      Face.inline(open, strings: strings, locale: locale, redacted: true)
        == .init(symbol: "clock", lines: ["Now"])
    )
  }

  @Test func inlineStatusIsItsTitleAndAStalePlanSwapsTheSymbol() {
    let now = FaceFixture.local(21, 12)
    let fresh = FaceFixture.projection([], at: now)
    #expect(
      Face.inline(fresh, strings: strings, locale: locale, redacted: false)
        == .init(symbol: nil, lines: ["Add panels on iPhone"])
    )
    let stale = FaceFixture.projection([talk], at: now, generatedAt: now.addingTimeInterval(-7_200))
    #expect(Face.inline(stale, strings: strings, locale: locale, redacted: false).symbol == Face.staleSymbol)
  }

  // MARK: Privacy

  /// Wrist down, no family may draw a panel's title or room, in any state.
  @Test(arguments: [
    FaceFixture.local(17, 9), // coming up
    FaceFixture.local(21, 12), // up next
    FaceFixture.local(21, 13, 20), // up next, Art Jam running
    FaceFixture.local(21, 13, 42), // leave
    FaceFixture.local(21, 14, 40), // happening now
    FaceFixture.local(25, 12), // ended
  ])
  func aRedactedFaceDrawsNoTitleOrRoom(now: Date) {
    let card = FaceFixture.projection([FaceFixture.artJam, FaceFixture.meetup], at: now)
    var drawn = Face.inline(card, strings: strings, locale: locale, redacted: true).lines
    let corner = Face.corner(card, strings: strings, locale: locale, redacted: true)
    if case .text(let lines) = corner.content { drawn += lines }
    if case .text(let label, _) = corner.label { drawn.append(label) }
    if let bezel = Face.bezel(card, strings: strings, redacted: true) { drawn.append(bezel) }
    for line in drawn {
      for secret in ["Art Jam", "Fursuit Meetup", "Hall A", "Studio B", "Center"] {
        #expect(line.contains(secret) == false, "\(line) names \(secret)")
      }
    }
  }

  // MARK: Compact units

  /// The circle stacks a count's number over its unit, so every compact
  /// format must put the number first, once, and leave a unit short enough
  /// to sit under it on a 41 mm circle.
  @Test(arguments: ConPawsLanguage.allCases)
  func everyCompactFormatSplitsIntoANumberAndAShortUnit(language: ConPawsLanguage) {
    let strings = ConPawsStrings.table(for: language)
    let formats = [
      strings.compactMinutesFormat,
      strings.compactHoursFormat,
      strings.compactDaysFormat,
      strings.compactMonthsFormat,
    ]
    for format in formats {
      #expect(format.hasPrefix("%@"), "\(language): \(format)")
      #expect(format.components(separatedBy: "%@").count == 2, "\(language): \(format)")
      let count = Face.Count(value: "12", format: format, strings: strings)
      #expect(count.text == strings.text(format, "12"))
      #expect(count.unit.isEmpty == false, "\(language): \(format)")
      #expect(count.unit.count <= 5, "\(language): \(count.unit) is too wide for the circle")
    }
  }

  @Test(arguments: [
    ("en_US", "2:00", "PM"),
    ("ja-JP-u-hc-h12", "2:00", "午後"), // the period comes first
    ("ko-KR", "2:00", "오후"),
    ("de_DE", "14:00", ""),
    ("en-US-u-hc-h23", "14:00", ""), // the app's 24-hour setting
  ])
  func clockSplitsTheDigitsFromTheDayPeriod(identifier: String, digits: String, period: String) {
    let clock = Face.clock(FaceFixture.local(21, 14), timeZone: FaceFixture.zone, locale: Locale(identifier: identifier))
    #expect(clock == .init(digits: digits, period: period))
  }
}
