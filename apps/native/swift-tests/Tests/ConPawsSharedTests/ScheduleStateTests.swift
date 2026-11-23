import Foundation
import Testing
@testable import ConPawsShared

struct ScheduleStateTests {
  private let now = Date(timeIntervalSince1970: 1_800_000_000)

  @Test(arguments: ["current-next", "current-only", "next-only", "finished", "no-picks", "no-convention"])
  func resolvesScheduleStates(_ kind: String) {
    let current = event("current", from: now.addingTimeInterval(-600), until: now.addingTimeInterval(600))
    let upcoming = event("upcoming", from: now.addingTimeInterval(900), until: now.addingTimeInterval(1_800))
    let past = event("past", from: now.addingTimeInterval(-3_600), until: now.addingTimeInterval(-1))
    let events: [ConPawsEventSnapshot]
    switch kind {
    case "current-next": events = [current, upcoming]
    case "current-only": events = [current]
    case "next-only": events = [upcoming]
    case "finished": events = [past]
    case "no-picks": events = []
    default:
      #expect(isNoConvention(ConPawsScheduleResolver.resolve(snapshot: nil, selectedConventionID: nil, skipCountdown: false, now: now)))
      return
    }

    let saved = convention(events)
    let result = ConPawsScheduleResolver.resolve(
      snapshot: snapshot(saved),
      selectedConventionID: saved.id,
      skipCountdown: true,
      now: now
    )
    switch kind {
    case "current-next":
      if case .next(_, let resolvedCurrent, let resolvedUpcoming) = result {
        #expect(resolvedCurrent?.id == "current")
        #expect(resolvedUpcoming.id == "upcoming")
      } else { #expect(Bool(false)) }
    case "current-only":
      if case .currentOnly(_, let resolved) = result { #expect(resolved.id == "current") }
      else { #expect(Bool(false)) }
    case "next-only":
      if case .next(_, let resolvedCurrent, let resolvedUpcoming) = result {
        #expect(resolvedCurrent == nil)
        #expect(resolvedUpcoming.id == "upcoming")
      } else { #expect(Bool(false)) }
    case "finished":
      if case .finished = result {} else { #expect(Bool(false)) }
    case "no-picks":
      if case .noPicks = result {} else { #expect(Bool(false)) }
    default: break
    }
  }

  @Test func countdownCanBeSkipped() {
    let saved = convention(
      [event("upcoming", from: now.addingTimeInterval(7_200))],
      startsAt: now.addingTimeInterval(3_600)
    )
    let value = snapshot(saved)
    if case .countdown = ConPawsScheduleResolver.resolve(snapshot: value, selectedConventionID: saved.id, skipCountdown: false, now: now) {} else {
      #expect(Bool(false))
    }
    if case .next = ConPawsScheduleResolver.resolve(snapshot: value, selectedConventionID: saved.id, skipCountdown: true, now: now) {} else {
      #expect(Bool(false))
    }
  }

  @Test func reminderWindowIncludesItsBoundary() {
    let upcoming = event("upcoming", from: now.addingTimeInterval(600), reminderMinutes: 10)
    #expect(!ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now.addingTimeInterval(-1)))
    #expect(ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now))
    #expect(!ConPawsScheduleResolver.isInReminderWindow(upcoming, now: upcomingDate(upcoming)))
  }

  // The watch's Up Next card shows the reminder line while it is pending and a
  // ticking timer once the leave window opens; never both, never neither.
  @Test(arguments: [-60.0, -1, 0, 1, 600, 899])
  func reminderIsPendingExactlyUntilTheLeaveWindowOpens(offset: TimeInterval) {
    let upcoming = event("upcoming", from: now.addingTimeInterval(900), reminderMinutes: 15)
    let moment = now.addingTimeInterval(offset)
    #expect(
      ConPawsScheduleResolver.isReminderPending(upcoming, now: moment)
        != ConPawsScheduleResolver.isInReminderWindow(upcoming, now: moment)
    )
  }

  @Test func reminderPendingEdges() {
    let atStart = event("at-start", from: now.addingTimeInterval(60), reminderMinutes: 0)
    #expect(ConPawsScheduleResolver.isReminderPending(atStart, now: now))
    #expect(ConPawsScheduleResolver.isReminderPending(atStart, now: upcomingDate(atStart)) == false)
    let unset = event("unset", from: now.addingTimeInterval(900))
    #expect(ConPawsScheduleResolver.isReminderPending(unset, now: now) == false)
  }

  // A 60-minute reminder opens its window exactly an hour out. The eyebrow
  // (leave window) and the timer must agree on that first minute.
  @Test func hourLongLeaveWindowOpensOnATimer() {
    let upcoming = event("upcoming", from: now.addingTimeInterval(3_600), reminderMinutes: 60)
    #expect(ConPawsScheduleResolver.isInReminderWindow(upcoming, now: now))
    #expect(ConPawsCountdown.showsLiveTimer(from: now, to: upcomingDate(upcoming), within: 3_600))
  }

  @Test func unknownEndDefaultsToSixtyMinutes() {
    let recent = event("unknown", from: now.addingTimeInterval(-3_540))
    let ended = event("unknown", from: now.addingTimeInterval(-3_600))
    #expect(isCurrentOnly(resolve([recent])))
    #expect(isFinished(resolve([ended])))
  }

  @Test func latestStartedOverlappingEventIsCurrent() {
    let earlier = event("earlier", from: now.addingTimeInterval(-1_200), until: now.addingTimeInterval(1_200))
    let later = event("later", from: now.addingTimeInterval(-300), until: now.addingTimeInterval(900))
    let result = resolve([earlier, later])
    if case .currentOnly(_, let current) = result { #expect(current.id == "later") }
    else { #expect(Bool(false)) }
  }

  @Test func automaticSelectionKeepsTheMostRecentlyEndedPlanVisible() {
    let past = event("past", from: now.addingTimeInterval(-1_800), until: now.addingTimeInterval(-1_200))
    let older = convention([past], id: "older", endsAt: now.addingTimeInterval(-3_600))
    let recent = convention([past], id: "recent", endsAt: now.addingTimeInterval(-600))
    let result = ConPawsScheduleResolver.resolve(
      snapshot: snapshot([older, recent]),
      selectedConventionID: nil,
      skipCountdown: true,
      now: now
    )
    if case .finished(let selected) = result { #expect(selected.id == "recent") }
    else { #expect(Bool(false)) }
  }

  @Test func unknownSelectedConventionResolvesToNoConvention() {
    let value = snapshot(convention([]))
    let result = ConPawsScheduleResolver.resolve(
      snapshot: value,
      selectedConventionID: "missing",
      skipCountdown: true,
      now: now
    )
    #expect(isNoConvention(result))
  }

  @Test func emptyConventionOnTheSameDatesDoesNotOutrankSavedPanels() {
    let empty = convention([], id: "empty")
    let planned = convention(
      [event("upcoming", from: now.addingTimeInterval(900), until: now.addingTimeInterval(1_800))],
      id: "planned"
    )
    let result = ConPawsScheduleResolver.resolve(
      snapshot: snapshot([empty, planned]),
      selectedConventionID: nil,
      skipCountdown: true,
      now: now
    )
    if case .next(let selected, _, let upcoming) = result {
      #expect(selected.id == "planned")
      #expect(upcoming.id == "upcoming")
    } else { #expect(Bool(false)) }
  }

  @Test func futureConventionWithPicksDoesNotDisplaceTheOneUnderway() {
    let underway = convention([], id: "underway")
    let later = convention(
      [event("later-panel", from: now.addingTimeInterval(61 * 86_400))],
      startsAt: now.addingTimeInterval(60 * 86_400),
      id: "later",
      endsAt: now.addingTimeInterval(63 * 86_400)
    )
    let result = ConPawsScheduleResolver.resolve(
      snapshot: snapshot([underway, later]),
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
    if case .noPicks(let selected) = result { #expect(selected.id == "underway") }
    else { #expect(Bool(false)) }
  }

  /// The phone sends a convention's end as the midnight after its last day,
  /// so a closing-night panel can run past it. With the next convention
  /// already saved, the Watch still follows the running panel until it ends.
  @Test func aPanelRunningPastTheEndKeepsItsConventionUntilThePanelEnds() {
    let end = now
    let closing = event("closing", from: end.addingTimeInterval(-3_600), until: end.addingTimeInterval(2_700))
    let first = convention(
      [closing],
      startsAt: end.addingTimeInterval(-3 * 86_400),
      id: "first",
      endsAt: end
    )
    let next = convention(
      [],
      startsAt: end.addingTimeInterval(26 * 86_400),
      id: "next",
      endsAt: end.addingTimeInterval(29 * 86_400)
    )
    let value = snapshot([first, next])

    let during = resolveAutomatically(value, at: end.addingTimeInterval(60))
    if case .currentOnly(let shown, let running) = during {
      #expect(shown.id == "first")
      #expect(running.id == "closing")
    } else { Issue.record("expected the running panel, got \(during)") }

    let after = resolveAutomatically(value, at: end.addingTimeInterval(2_700.001))
    if case .countdown(let shown) = after { #expect(shown.id == "next") }
    else { Issue.record("expected the next convention's countdown, got \(after)") }
  }

  /// Seconds after the convention's end at which it stops counting as active,
  /// for one saved panel from `start` to `end` (nil: none, or no end time).
  @Test(arguments: [
    (nil, nil, 0),
    (-7_200, -3_600, 0),
    (-3_600, 2_700, 2_700),
    (-1_800, nil, 1_800),
    // A bad end time holds the convention a day from the panel's start at most.
    (-3_600, 30 * 86_400, 82_800),
    // A panel saved for after the convention still counts until it ends.
    (2 * 86_400, 2 * 86_400 + 3_600, 2 * 86_400 + 3_600),
  ] as [(TimeInterval?, TimeInterval?, TimeInterval)])
  func lastActiveMomentFollowsTheLatestSavedPanelsEnd(
    start: TimeInterval?,
    end: TimeInterval?,
    expected: TimeInterval
  ) {
    let events = start.map { start in
      [event("panel", from: now.addingTimeInterval(start), until: end.map { now.addingTimeInterval($0) })]
    } ?? []
    let saved = convention(events, endsAt: now)
    #expect(
      ConPawsScheduleResolver.lastActiveMs(of: saved)
        == now.addingTimeInterval(expected).timeIntervalSince1970 * 1_000
    )
  }

  private func resolveAutomatically(_ snapshot: ConPawsSnapshot, at moment: Date) -> ConPawsScheduleState {
    ConPawsScheduleResolver.resolve(
      snapshot: snapshot, selectedConventionID: nil, skipCountdown: false, now: moment
    )
  }

  private func resolve(_ events: [ConPawsEventSnapshot]) -> ConPawsScheduleState {
    let saved = convention(events)
    return ConPawsScheduleResolver.resolve(
      snapshot: snapshot(saved), selectedConventionID: saved.id, skipCountdown: true, now: now
    )
  }

  private func convention(
    _ events: [ConPawsEventSnapshot],
    startsAt start: Date? = nil,
    id: String = "con",
    endsAt end: Date? = nil
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: id,
      name: "Convention",
      startAtMs: (start ?? now.addingTimeInterval(-3_600)).timeIntervalSince1970 * 1_000,
      endAtMs: (end ?? now.addingTimeInterval(86_400)).timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: "UTC",
      dateRangeLabel: "",
      events: events,
      options: nil
    )
  }

  private func snapshot(_ convention: ConPawsConventionSnapshot) -> ConPawsSnapshot {
    snapshot([convention])
  }

  private func snapshot(_ conventions: [ConPawsConventionSnapshot]) -> ConPawsSnapshot {
    ConPawsSnapshot(schemaVersion: 2, generatedAtMs: now.timeIntervalSince1970 * 1_000, localeIdentifier: "en", conventions: conventions)
  }

  private func event(
    _ id: String,
    from start: Date,
    until end: Date? = nil,
    reminderMinutes: Int? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: id,
      title: "Panel \(id)",
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.map { $0.timeIntervalSince1970 * 1_000 },
      location: nil,
      room: nil,
      reminderMinutes: reminderMinutes,
      ageRating: nil,
      summary: nil
    )
  }

  private func upcomingDate(_ event: ConPawsEventSnapshot) -> Date {
    Date(timeIntervalSince1970: event.startAtMs / 1_000)
  }

  private func isNoConvention(_ state: ConPawsScheduleState) -> Bool {
    if case .noConvention = state { return true }
    return false
  }

  private func isCurrentOnly(_ state: ConPawsScheduleState) -> Bool {
    if case .currentOnly = state { return true }
    return false
  }

  private func isFinished(_ state: ConPawsScheduleState) -> Bool {
    if case .finished = state { return true }
    return false
  }
}

struct StringsPlaceholderParityTests {
  @Test func formatPlaceholdersMatchEnglishAcrossLanguages() {
    let english = placeholders(in: ConPawsStrings.table(for: .en))
    for language in ConPawsLanguage.allCases {
      #expect(placeholders(in: ConPawsStrings.table(for: language)) == english, "\(language.rawValue) format placeholders differ")
    }
  }

  @Test func everyCapsFieldIsNonEmpty() {
    for language in ConPawsLanguage.allCases {
      let emptyCaps = Mirror(reflecting: ConPawsStrings.table(for: language)).children.compactMap { child -> String? in
        guard let name = child.label, name.hasSuffix("Caps"), let value = child.value as? String else { return nil }
        return value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? name : nil
      }
      #expect(emptyCaps.isEmpty, "\(language.rawValue) has empty caps fields: \(emptyCaps)")
    }
  }

  /// Every countdown template must carry its number: "Stunden" without "%@"
  /// would draw "In Stunden" and pass every other check.
  @Test(arguments: ConPawsLanguage.allCases)
  func everyPluralTemplateCarriesOneNumber(language: ConPawsLanguage) {
    for (name, value) in pluralTemplates(in: ConPawsStrings.table(for: language)) {
      #expect(placeholderCounts(in: value) == ["%@": 1], "\(language.rawValue) \(name): \(value)")
    }
  }

  /// Format strings by field, and each plural template as "hoursUnit.one" and
  /// so on, so the English comparison covers the units too.
  private func placeholders(in strings: ConPawsStrings) -> [String: [String: Int]] {
    let fields = Mirror(reflecting: strings).children.compactMap { child -> (String, String)? in
      guard let name = child.label, let value = child.value as? String else { return nil }
      return (name, value)
    }
    return (fields + pluralTemplates(in: strings)).reduce(into: [:]) { result, field in
      let counts = placeholderCounts(in: field.1)
      if !counts.isEmpty { result[field.0] = counts }
    }
  }

  /// The six templates of every `ConPawsPluralUnit` field.
  private func pluralTemplates(in strings: ConPawsStrings) -> [(String, String)] {
    Mirror(reflecting: strings).children.flatMap { child -> [(String, String)] in
      guard let name = child.label, let unit = child.value as? ConPawsPluralUnit else { return [] }
      return Mirror(reflecting: unit).children.compactMap { form in
        guard let formName = form.label, let template = form.value as? String else { return nil }
        return ("\(name).\(formName)", template)
      }
    }
  }

  private func placeholderCounts(in value: String) -> [String: Int] {
    let expression = try! NSRegularExpression(pattern: "%[0-9]+\\$@|%@")
    let matches = expression.matches(
      in: value,
      range: NSRange(value.startIndex..., in: value)
    ).compactMap { match in
      Range(match.range, in: value).map { String(value[$0]) }
    }
    return Dictionary(matches.map { ($0, 1) }, uniquingKeysWith: +)
  }
}
