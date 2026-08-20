import Foundation

struct ConPawsSnapshot: Codable, Sendable {
  let schemaVersion: Int
  let generatedAtMs: Double
  let localeIdentifier: String
  let conventions: [ConPawsConventionSnapshot]

  static let empty = ConPawsSnapshot(
    schemaVersion: 1,
    generatedAtMs: 0,
    localeIdentifier: "en",
    conventions: []
  )
}

struct ConPawsConventionSnapshot: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let name: String
  let startAtMs: Double
  let endAtMs: Double
  let timeZoneIdentifier: String
  let dateRangeLabel: String
  let events: [ConPawsEventSnapshot]
}

struct ConPawsEventSnapshot: Codable, Identifiable, Hashable, Sendable {
  let id: String
  let title: String
  let startAtMs: Double
  let endAtMs: Double?
  let location: String?
  let room: String?
  let reminderMinutes: Int?
}

enum ConPawsSnapshotStore {
  static let snapshotKey = "conpaws.widget.snapshot.v1"

  static func appGroupIdentifier(bundleIdentifier: String? = Bundle.main.bundleIdentifier) -> String {
    let bundle = bundleIdentifier ?? "com.mrdemonwolf.conpaws"
    let mainBundle = bundle
      .replacingOccurrences(of: ".watchkitapp.widgets", with: "")
      .replacingOccurrences(of: ".watchkitapp", with: "")
      .replacingOccurrences(of: ".widgets", with: "")
    return "group.\(mainBundle)"
  }

  static func load() -> ConPawsSnapshot {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier()),
      let json = defaults.string(forKey: snapshotKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      snapshot.schemaVersion == 1
    else {
      return .empty
    }
    return snapshot
  }

  static func save(json: String) -> Bool {
    guard
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      snapshot.schemaVersion == 1,
      let defaults = UserDefaults(suiteName: appGroupIdentifier())
    else {
      return false
    }
    defaults.set(json, forKey: snapshotKey)
    return true
  }

  static func appURL(conventionID: String? = nil) -> URL? {
    let bundle = appGroupIdentifier().replacingOccurrences(of: "group.", with: "")
    let scheme = bundle.hasSuffix(".dev") ? "conpaws-dev" : "conpaws"
    var components = URLComponents()
    components.scheme = scheme
    components.host = conventionID == nil ? "" : "convention"
    if let conventionID {
      let pathSegment = conventionID.addingPercentEncoding(
        withAllowedCharacters: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
      )
      guard let pathSegment else { return nil }
      components.percentEncodedPath = "/\(pathSegment)"
    }
    return components.url
  }
}
