import Foundation

/// One row of the Watch app's Today list: a live saved panel, or one the
/// convention withdrew, which the list draws struck through and labelled.
enum WatchTodayRow: Identifiable, Hashable, Sendable {
  case saved(ConPawsEventSnapshot)
  case withdrawn(ConPawsWithdrawnEvent)

  var id: String { event.id }

  var event: ConPawsEventSnapshot {
    switch self {
    case .saved(let event): event
    case .withdrawn(let withdrawn): withdrawn.event
    }
  }

  /// What the feed did to the panel; nil for a live one.
  var status: ConPawsWithdrawnEvent.Status? {
    switch self {
    case .saved: nil
    case .withdrawn(let withdrawn): withdrawn.status
    }
  }

  /// Both lists as one, by start. At the same start a live panel comes
  /// first, and each list keeps its own order otherwise.
  static func merging(
    saved: [ConPawsEventSnapshot],
    withdrawn: [ConPawsWithdrawnEvent]
  ) -> [WatchTodayRow] {
    let rows = saved.map(WatchTodayRow.saved) + withdrawn.map(WatchTodayRow.withdrawn)
    return rows.enumerated()
      .sorted { lhs, rhs in
        lhs.element.event.startAtMs != rhs.element.event.startAtMs
          ? lhs.element.event.startAtMs < rhs.element.event.startAtMs
          : lhs.offset < rhs.offset
      }
      .map(\.element)
  }
}
