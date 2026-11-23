import Foundation

/// Where a tap on the complication opens the Watch app.
///
/// The complication hands this to `widgetURL`, and the Watch app's
/// `onOpenURL` turns it back into its own navigation. Without it the app came
/// forward on whatever screen it was last left on, often an old panel's
/// detail, while the card showed another. Only screens the Watch app already
/// has: its home, or a saved panel's detail. The scheme is its own, never the
/// phone's `conpaws://`, whose routes the Watch does not have.
enum ConPawsWatchLink: Hashable, Sendable {
  case home
  case event(conventionID: String, eventID: String)

  static let scheme = "conpaws-watch"

  private static let eventHost = "event"
  private static let homeHost = "home"
  private static let conventionKey = "conventionId"
  private static let eventKey = "eventId"
  /// What a query value may carry unescaped. Narrower than
  /// `urlQueryAllowed`, which lets `&`, `=` and `+` through: an id holding
  /// one would end its own value early or read back changed.
  private static let unreserved = CharacterSet(
    charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  )

  /// Nil only if URLComponents refuses parts that are all constants or
  /// escaped here, which it does not.
  var url: URL? {
    var components = URLComponents()
    components.scheme = Self.scheme
    switch self {
    case .home:
      components.host = Self.homeHost
    case .event(let conventionID, let eventID):
      components.host = Self.eventHost
      components.percentEncodedQueryItems = [
        URLQueryItem(name: Self.conventionKey, value: Self.encoded(conventionID)),
        URLQueryItem(name: Self.eventKey, value: Self.encoded(eventID)),
      ]
    }
    return components.url
  }

  /// The link `url` describes, or nil for one the Watch app cannot open: the
  /// phone's own deep links, other schemes, an unknown screen or an event
  /// link missing either id.
  init?(url: URL) {
    guard
      url.scheme == Self.scheme,
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else { return nil }
    switch components.host {
    case Self.homeHost:
      self = .home
    case Self.eventHost:
      let items = components.queryItems ?? []
      func value(_ name: String) -> String? {
        items.first { $0.name == name }?.value.flatMap { $0.isEmpty ? nil : $0 }
      }
      guard let conventionID = value(Self.conventionKey), let eventID = value(Self.eventKey) else {
        return nil
      }
      self = .event(conventionID: conventionID, eventID: eventID)
    default:
      return nil
    }
  }

  private static func encoded(_ value: String) -> String {
    value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
  }
}

extension ConPawsComplicationProjection {
  /// The screen a tap on this card opens: the panel it names, which is the
  /// next one while one is coming (the leave countdown included), or the
  /// running one when nothing follows. A countdown or status card has no
  /// panel and opens the home screen.
  var link: ConPawsWatchLink {
    switch state {
    case .leave(_, let event, let convention),
      .next(_, let event, let convention),
      .current(let event, let convention):
      .event(conventionID: convention.id, eventID: event.id)
    case .comingUp, .finished, .noPicks, .ended, .noConvention:
      .home
    }
  }
}
