import Foundation

/// When the Smart Stack should raise the complication: the date clues its
/// timeline provider's `relevance()` hands watchOS 11 and later. Apple's
/// "Increasing the visibility of widgets in Smart Stacks" says watchOS gathers
/// relevance through that callback; watchOS 10 has only the entries'
/// `TimelineEntryRelevance` scores. Foundation-only, so swift-tests covers
/// it; targets/watch-widget turns each window into a `RelevantContext`.
///
/// Every window is planned from the snapshot alone, never from the clock, so
/// one that has ended can be dropped from the clues the system already holds
/// and from a new set alike, and `needsRefresh` can compare the two.
enum ConPawsComplicationRelevance {
  enum Kind: String, Codable, Hashable, Sendable {
    /// Half an hour either side of a saved panel's start, the same stretch
    /// the timeline's entry scores cover: the card says what is next, when
    /// and where. Told to watchOS 26 as scheduled.
    case panel
    /// The first morning of a convention while the card names one of its
    /// saved panels. Told to watchOS 26 as informational, a little lower.
    case conventionStart
  }

  struct Window: Codable, Equatable, Sendable {
    let interval: DateInterval
    let kind: Kind
  }

  /// Apple: the system may use only some of the clues, so they are given
  /// soonest first and stop here. Overlapping panels share a window, so this
  /// covers a few busy convention days.
  static let maximumWindows = 24
  /// The phone sends a convention's start as the day alone, midnight where it
  /// happens, and raising the card then only showed a countdown turning over.
  /// The first morning, on the convention's own clock, is when the wearer is
  /// on the way to it.
  static let openingHour = 8
  static let openingLength: TimeInterval = 2 * 3_600

  /// The clues to give at `now`: every window not yet over, soonest first, at
  /// most `limit` of them. A window under way stays until it ends.
  static func windows(
    snapshot: ConPawsSnapshot,
    now: Date,
    limit: Int = maximumWindows
  ) -> [Window] {
    Array(plan(snapshot: snapshot).filter { $0.interval.end > now }.prefix(limit))
  }

  /// Whether the clues the system was last given (`given`, nil when none
  /// were) differ from what `windows` gives now, so the widget should ask the
  /// system to call `relevance()` again. Windows that have ended drop out of
  /// both, so time passing alone asks again only when the cap left a window
  /// out that now has room.
  static func needsRefresh(
    given: [Window]?,
    snapshot: ConPawsSnapshot,
    now: Date,
    limit: Int = maximumWindows
  ) -> Bool {
    guard let given else { return true }
    return given.filter { $0.interval.end > now } != windows(snapshot: snapshot, now: now, limit: limit)
  }

  /// Every window for `snapshot`, past ones included, sorted by start and
  /// never overlapping.
  static func plan(snapshot: ConPawsSnapshot) -> [Window] {
    let lift = ConPawsComplicationTimeline.relevanceWindow
    let panels = merged(
      snapshot.conventions.flatMap { convention in
        convention.events.compactMap { event -> DateInterval? in
          // A panel raises the card only if the card shows its convention
          // then: of two under way at once, it follows the one that began
          // first, and the other's panels never appear on it.
          guard follows(convention, at: event.startDate, in: snapshot) else { return nil }
          return DateInterval(
            start: event.startDate.addingTimeInterval(-lift),
            end: event.startDate.addingTimeInterval(lift)
          )
        }
      }
    )
    let mornings = snapshot.conventions
      .compactMap { openingWindow(of: $0, in: snapshot) }
      .flatMap { remainder(of: $0, outside: panels) }
    return (panels.map { Window(interval: $0, kind: .panel) }
      + mornings.map { Window(interval: $0, kind: .conventionStart) })
      .sorted { $0.interval.start < $1.interval.start }
  }

  /// The convention's first morning, from 8 AM on its own clock (or its
  /// start, if that is later) for two hours, while the card then names one of
  /// its saved panels. Without one it says "No panels saved", which is not
  /// worth the top of the stack.
  private static func openingWindow(
    of convention: ConPawsConventionSnapshot,
    in snapshot: ConPawsSnapshot
  ) -> DateInterval? {
    // The hour on the clock, not eight hours past midnight: those differ on
    // a day the clocks change.
    guard
      let morning = convention.calendar.date(
        bySettingHour: openingHour,
        minute: 0,
        second: 0,
        of: convention.startDate
      )
    else { return nil }
    let start = max(convention.startDate, morning)
    let shown = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: start
    )
    switch shown {
    case .next(let value, _, _), .currentOnly(let value, _):
      guard value.id == convention.id else { return nil }
      return DateInterval(start: start, duration: openingLength)
    case .noConvention, .countdown, .finished, .noPicks:
      return nil
    }
  }

  private static func follows(
    _ convention: ConPawsConventionSnapshot,
    at date: Date,
    in snapshot: ConPawsSnapshot
  ) -> Bool {
    ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: date
    ).convention?.id == convention.id
  }

  /// `intervals` sorted, with any that overlap or touch joined: two panels a
  /// quarter of an hour apart are one stretch the card stays up for.
  private static func merged(_ intervals: [DateInterval]) -> [DateInterval] {
    intervals.sorted { $0.start < $1.start }.reduce(into: []) { result, interval in
      if let last = result.last, interval.start <= last.end {
        result[result.count - 1] = DateInterval(start: last.start, end: max(last.end, interval.end))
      } else {
        result.append(interval)
      }
    }
  }

  /// The parts of `interval` that none of `covers` (sorted, not overlapping)
  /// reaches: a panel's own window wins over the morning around it.
  private static func remainder(
    of interval: DateInterval,
    outside covers: [DateInterval]
  ) -> [DateInterval] {
    var pieces: [DateInterval] = []
    var cursor = interval.start
    for cover in covers where cover.end > cursor && cover.start < interval.end {
      if cover.start > cursor { pieces.append(DateInterval(start: cursor, end: cover.start)) }
      cursor = max(cursor, cover.end)
    }
    if cursor < interval.end { pieces.append(DateInterval(start: cursor, end: interval.end)) }
    return pieces
  }

  // MARK: - What the system was given

  /// Where the widget extension keeps the clues its last `relevance()`
  /// answer gave, in its own defaults: only the extension reads them.
  static let givenKey = "conpaws.complication.relevance.v1"

  static func loadGiven(from defaults: UserDefaults = .standard) -> [Window]? {
    defaults.data(forKey: givenKey).flatMap { try? JSONDecoder().decode([Window].self, from: $0) }
  }

  static func saveGiven(_ windows: [Window], to defaults: UserDefaults = .standard) {
    guard let data = try? JSONEncoder().encode(windows) else { return }
    defaults.set(data, forKey: givenKey)
  }
}
