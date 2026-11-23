import Foundation

/// The convention and panels a resolved state names, read the same way by the
/// Watch app's Home and Today screens and by the complication. Each kept its
/// own copy of these switches, which a new state had to be added to twice.
extension ConPawsScheduleState {
  /// The convention the state is about; nil only without one.
  var convention: ConPawsConventionSnapshot? {
    switch self {
    case .noConvention: nil
    case .countdown(let value), .finished(let value), .noPicks(let value): value
    case .next(let value, _, _), .currentOnly(let value, _): value
    }
  }

  /// The saved panel running now, if the state has one.
  var activeEvent: ConPawsEventSnapshot? {
    switch self {
    case .next(_, let current, _): current
    case .currentOnly(_, let event): event
    case .noConvention, .countdown, .finished, .noPicks: nil
    }
  }

  /// The saved panel that starts next, if the state has one.
  var nextEvent: ConPawsEventSnapshot? {
    if case .next(_, _, let upcoming) = self { return upcoming }
    return nil
  }
}
