import AppIntents

// Every display string in this file is drawn by the system's widget
// configuration sheet rather than by the widget, so it resolves against the
// device's language through this extension's bundle. That makes it the one
// place ConPawsStrings cannot help: translating these needs real .lproj or
// String Catalog resources, which @bacons/apple-targets does not generate.

enum ConPawsWidgetMode: String, AppEnum {
  case automatic
  case countdown
  case nextEvent

  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Display")
  static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
    .automatic: "Automatic",
    .countdown: "Convention Countdown",
    .nextEvent: "Next Event",
  ]
}

struct ConPawsConventionEntity: AppEntity, Hashable {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Convention")
  static let defaultQuery = ConPawsConventionQuery()

  let id: String
  let name: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }
}

struct ConPawsConventionQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [ConPawsConventionEntity] {
    entities(includePast: true).filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [ConPawsConventionEntity] {
    entities(includePast: false)
  }

  /// Nil on purpose: a fresh widget follows the schedule automatically —
  /// active convention first, else the nearest upcoming, the same rule the
  /// watch applies. Returning a concrete entity here would silently pin every
  /// new widget to whatever was nearest on the day it was added. The pin is
  /// the opt-in, made in Edit Widget; a pinned convention that later
  /// disappears falls back to automatic in the provider.
  func defaultResult() async -> ConPawsConventionEntity? {
    nil
  }

  private func entities(includePast: Bool) -> [ConPawsConventionEntity] {
    let now = Date().timeIntervalSince1970 * 1_000
    return ConPawsSnapshotStore.load().conventions
      .filter { includePast || $0.endAtMs >= now }
      .sorted { $0.startAtMs < $1.startAtMs }
      .map { ConPawsConventionEntity(id: $0.id, name: $0.name) }
  }
}

@available(iOS 17.0, *)
struct ConPawsWidgetIntent: WidgetConfigurationIntent {
  static let title: LocalizedStringResource = "ConPaws"
  static let description = IntentDescription("See a convention countdown or your next scheduled event.")

  @Parameter(title: "Convention")
  var convention: ConPawsConventionEntity?

  @Parameter(title: "Display", default: .automatic)
  var mode: ConPawsWidgetMode
}
