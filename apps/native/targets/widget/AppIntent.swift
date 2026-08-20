import AppIntents

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

  func defaultResult() async -> ConPawsConventionEntity? {
    entities(includePast: false).first
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
