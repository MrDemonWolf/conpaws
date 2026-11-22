import Foundation

// What the Watch app's Home and Today screens show, and where it can push.
// Foundation-only, so swift-tests covers it; the views that draw it stay in
// targets/watch. The complication compiles this folder too and ignores it.

/// Where the watch app can push.
///
/// Value-based, so a pushed screen belongs to the path rather than to the link
/// that opened it. With closure links, Up Next's card moving into the Happening
/// Now slot on the minute tick took its link -- and the reader's detail screen
/// -- with it, at the exact moment that screen mattered. The convention id
/// travels with the event id so the lookup is exact.
enum WatchRoute: Hashable, Sendable {
  case today
  case event(conventionID: String, eventID: String)
  /// An unsaved panel from "Other options this hour". Kept when the panel is
  /// added: the same screen then shows it as saved rather than popping.
  case option(conventionID: String, eventID: String)
}

extension WatchRoute {
  /// The stack a complication link opens. A panel the plan no longer holds,
  /// because a newer snapshot reached the app first, opens the home screen.
  static func path(opening link: ConPawsWatchLink, in snapshot: ConPawsSnapshot) -> [WatchRoute] {
    switch link {
    case .home:
      return []
    case .event(let conventionID, let eventID):
      guard snapshot.event(id: eventID, in: conventionID) != nil else { return [] }
      return [.event(conventionID: conventionID, eventID: eventID)]
    }
  }

  /// `path` without the screens a new schedule has left with nothing to show.
  ///
  /// A saved panel's screen goes once the panel does, including one removed
  /// from that screen: once the phone confirms, there is nothing left to
  /// show. An option's screen stays while the panel is either offered or
  /// saved, so adding it from there keeps the reader on it.
  static func pruned(_ path: [WatchRoute], against snapshot: ConPawsSnapshot) -> [WatchRoute] {
    path.filter { route in
      switch route {
      case .today:
        true
      case .event(let conventionID, let eventID):
        snapshot.event(id: eventID, in: conventionID) != nil
      case .option(let conventionID, let eventID):
        snapshot.event(id: eventID, in: conventionID) != nil
          || snapshot.option(id: eventID, in: conventionID) != nil
      }
    }
  }
}

/// The Home and Today screens' panels at one moment, projected once per tick
/// so every section reads the same answer.
struct WatchScheduleProjection {
  /// How many saved panels after Up Next the Home screen lists under Later.
  static let laterLimit = 2

  let now: Date
  let state: ConPawsScheduleState
  /// Up to `laterLimit` saved events after Up Next, soonest first.
  let laterEvents: [ConPawsEventSnapshot]
  /// Every saved event starting today in the convention's time zone, the ones
  /// already over included, soonest first.
  let todayEvents: [ConPawsEventSnapshot]

  var convention: ConPawsConventionSnapshot? { state.convention }
  var activeEvent: ConPawsEventSnapshot? { state.activeEvent }
  var nextEvent: ConPawsEventSnapshot? { state.nextEvent }

  /// Nothing picked, and the convention is over: every convention has ended
  /// and the resolver fell back to the one that ended last. "No panels
  /// picked" asked for picks for a convention that was over, indefinitely.
  /// The same test the complication's ended state makes.
  var isOverWithoutPicks: Bool {
    guard case .noPicks(let convention) = state else { return false }
    return convention.hasPassed(at: now)
  }

  init(snapshot: ConPawsSnapshot, now: Date) {
    let state = ConPawsScheduleResolver.resolve(
      snapshot: snapshot,
      selectedConventionID: nil,
      skipCountdown: false,
      now: now
    )
    self.now = now
    self.state = state

    guard let convention = state.convention else {
      laterEvents = []
      todayEvents = []
      return
    }
    let next = state.nextEvent
    let sorted = convention.events.sorted { $0.startAtMs < $1.startAtMs }
    // Up Next has its own card, so Later never repeats it.
    laterEvents = Array(
      sorted
        .filter { $0.startDate > now && $0.id != next?.id }
        .prefix(Self.laterLimit)
    )
    // The convention's day, not the watch's: a 23:30 panel at a convention in
    // another zone belongs to that convention's evening.
    let calendar = convention.calendar
    todayEvents = sorted.filter { calendar.isDate($0.startDate, inSameDayAs: now) }
  }
}

extension ConPawsSnapshot {
  /// A saved event and its convention, the lookup an event route resolves by.
  func event(
    id eventID: String,
    in conventionID: String
  ) -> (event: ConPawsEventSnapshot, convention: ConPawsConventionSnapshot)? {
    guard
      let convention = conventions.first(where: { $0.id == conventionID }),
      let event = convention.events.first(where: { $0.id == eventID })
    else { return nil }
    return (event, convention)
  }

  /// An unsaved option, from the whole window the phone sent rather than the
  /// current hour, so a detail screen outlives the hour that listed it.
  func option(
    id eventID: String,
    in conventionID: String
  ) -> (event: ConPawsEventSnapshot, convention: ConPawsConventionSnapshot)? {
    guard
      let convention = conventions.first(where: { $0.id == conventionID }),
      let option = convention.options?.first(where: { $0.id == eventID })
    else { return nil }
    return (option, convention)
  }
}
