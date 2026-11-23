// App Intents brings RelevanceKit, where `RelevantContext` lives from the
// watchOS 26 SDK on; Apple's RelevanceKit page says to import it this way.
import AppIntents
import Foundation
import WidgetKit

/// The complication's Smart Stack clues on watchOS 11 and later, which
/// gathers them through the provider's `relevance()`; watchOS 10 has only the
/// entries' scores. What the windows are is planned and tested in
/// targets/_shared/ConPawsComplicationRelevance.swift; this only hands them
/// to the system and asks for them to be read again when they change.
@available(watchOS 11.0, *)
enum ConPawsWatchRelevance {
  /// The clues for the stored snapshot, soonest first, as Apple asks: the
  /// system may use only the first few. Remembers what it gave, so the
  /// timeline can tell when a new snapshot changed them.
  static func current(now: Date = .now) -> WidgetRelevance<Void> {
    let windows = ConPawsComplicationRelevance.windows(
      snapshot: ConPawsSnapshotStore.load(),
      now: now
    )
    ConPawsComplicationRelevance.saveGiven(windows)
    return WidgetRelevance(windows.map { WidgetRelevanceAttribute(context: context(for: $0)) })
  }

  /// Asks the system to call `relevance()` again when the clues it holds no
  /// longer match `snapshot`: a panel was saved, moved or removed, or the cap
  /// left out a window that now has room. The timeline runs this, because a
  /// new snapshot reloads it; otherwise the system re-reads the clues only
  /// when it chooses to.
  static func refreshIfChanged(snapshot: ConPawsSnapshot, now: Date) {
    guard
      ConPawsComplicationRelevance.needsRefresh(
        given: ConPawsComplicationRelevance.loadGiven(),
        snapshot: snapshot,
        now: now
      )
    else { return }
    WidgetCenter.shared.invalidateRelevance(ofKind: ConPawsWidgetKind.watchComplication)
  }

  /// A panel is scheduled, the first morning informational, so watchOS 26
  /// weighs a panel a little higher. Earlier releases take the dates alone.
  private static func context(for window: ConPawsComplicationRelevance.Window) -> RelevantContext {
    if #available(watchOS 26.0, *) {
      let kind: RelevantContext.DateKind =
        switch window.kind {
        case .panel: .scheduled
        case .conventionStart: .informational
        }
      return .date(interval: window.interval, kind: kind)
    }
    return .date(from: window.interval.start, to: window.interval.end)
  }
}
