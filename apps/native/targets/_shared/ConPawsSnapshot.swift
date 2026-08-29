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

  /// The locale every date, time and weekday in these targets is formatted in.
  ///
  /// `localeIdentifier` is the app's own language setting, which need not match
  /// the device's -- and `dateRangeLabel` already arrives formatted in it, so a
  /// target that formats anything else against the device locale renders a
  /// bilingual card. The region is kept from the device because the app stores
  /// a bare language code: reading it as a whole locale would hand an English
  /// user in the UK the 12-hour clock the rest of their phone does not use.
  var locale: Locale {
    let device = Locale.autoupdatingCurrent
    var components = Locale.Components(locale: device)
    var language = Locale.Language.Components(identifier: localeIdentifier)
    language.region = language.region ?? device.region
    components.languageComponents = language
    return Locale(components: components)
  }

  /// The words every date's neighbouring text is written in.
  ///
  /// Same source as `locale` and for the same reason: these targets follow the
  /// app's language setting, not the phone's.
  var strings: ConPawsStrings {
    ConPawsStrings.resolve(localeIdentifier)
  }
}

/// Widget kinds, named once because `WidgetCenter.reloadTimelines(ofKind:)`
/// does nothing at all when handed a kind no widget answers to -- a rename that
/// misses one call site fails silently and stays broken.
enum ConPawsWidgetKind {
  static let homeScreen = "ConPawsWidget"
  static let watchComplication = "ConPawsWatchWidget"
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
  /// Localized age-pill label ("13+ Teen"), pre-rendered by the app like
  /// `dateRangeLabel`. Absent in schema v1 payloads and for all-ages events,
  /// and optional here precisely so both decode to "no pill".
  let ageRating: String?
}

enum ConPawsSnapshotStore {
  /// Snapshot schemas this binary knows how to render.
  ///
  /// v1 payloads stay valid — v2 only adds optional fields, which decode as
  /// absent — so an app updated under an older extension (or the reverse)
  /// keeps rendering rather than falling back to the empty state.
  static let supportedSchemaVersions = 1...2

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
      supportedSchemaVersions.contains(snapshot.schemaVersion)
    else {
      return .empty
    }
    return snapshot
  }

  static func save(json: String) -> Bool {
    guard
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      supportedSchemaVersions.contains(snapshot.schemaVersion),
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
    components.host = conventionID == nil ? "" : "schedule"
    if let conventionID {
      components.queryItems = [URLQueryItem(name: "conventionId", value: conventionID)]
    }
    return components.url
  }
}
