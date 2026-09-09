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
  /// Published organizer times. These never change when someone plans to
  /// attend only part of an event.
  let startAtMs: Double
  let endAtMs: Double?
  /// The validated interval used by every glanceable surface. Schema v1/v2
  /// omit these fields, so readers fall back to the published interval.
  let attendanceStartAtMs: Double?
  let attendanceEndAtMs: Double?
  /// True when saved personal values no longer fit the published event. The
  /// effective attendance values above already fall back safely; the phone
  /// retains the original values so the person can review them.
  let attendanceNeedsReview: Bool?
  let location: String?
  let room: String?
  let reminderMinutes: Int?
  /// Localized age-pill label ("13+ Teen"), pre-rendered by the app like
  /// `dateRangeLabel`. Absent in schema v1 payloads and for all-ages events,
  /// and optional here precisely so both decode to "no pill".
  let ageRating: String?

  init(
    id: String,
    title: String,
    startAtMs: Double,
    endAtMs: Double?,
    attendanceStartAtMs: Double? = nil,
    attendanceEndAtMs: Double? = nil,
    attendanceNeedsReview: Bool? = nil,
    location: String?,
    room: String?,
    reminderMinutes: Int?,
    ageRating: String?
  ) {
    self.id = id
    self.title = title
    self.startAtMs = startAtMs
    self.endAtMs = endAtMs
    self.attendanceStartAtMs = attendanceStartAtMs
    self.attendanceEndAtMs = attendanceEndAtMs
    self.attendanceNeedsReview = attendanceNeedsReview
    self.location = location
    self.room = room
    self.reminderMinutes = reminderMinutes
    self.ageRating = ageRating
  }
}

extension ConPawsEventSnapshot {
  var plannedStartDate: Date {
    let milliseconds = attendanceStartAtMs.flatMap { $0.isFinite ? $0 : nil } ?? startAtMs
    return Date(timeIntervalSince1970: milliseconds / 1_000)
  }

  var plannedEndDate: Date? {
    let milliseconds = attendanceEndAtMs.flatMap { $0.isFinite ? $0 : nil }
      ?? endAtMs.flatMap { $0.isFinite ? $0 : nil }
    return milliseconds.map { Date(timeIntervalSince1970: $0 / 1_000) }
  }

  var hasPersonalStart: Bool {
    guard attendanceNeedsReview != true, let attendanceStartAtMs else { return false }
    return attendanceStartAtMs.isFinite && abs(attendanceStartAtMs - startAtMs) >= 1
  }

  var hasPersonalEnd: Bool {
    guard
      attendanceNeedsReview != true,
      let attendanceEndAtMs,
      attendanceEndAtMs.isFinite
    else { return false }
    return endAtMs == nil || abs(attendanceEndAtMs - (endAtMs ?? attendanceEndAtMs)) >= 1
  }
}

/// One selection rule shared by WidgetKit, the Watch app and complications.
/// It deliberately uses personal attendance intervals while keeping published
/// timestamps available on each event for details and change review.
struct ConPawsPlanTimeline {
  let events: [ConPawsEventSnapshot]
  let currentEvent: ConPawsEventSnapshot?
  let currentEventEnd: Date?
  let nextEvent: ConPawsEventSnapshot?

  init(events sourceEvents: [ConPawsEventSnapshot], now: Date) {
    let sortedEvents = sourceEvents.sorted {
      if $0.plannedStartDate != $1.plannedStartDate {
        return $0.plannedStartDate < $1.plannedStartDate
      }
      if $0.title != $1.title { return $0.title < $1.title }
      return $0.id < $1.id
    }

    let active = sortedEvents.enumerated().compactMap { index, event -> (ConPawsEventSnapshot, Date)? in
      guard event.plannedStartDate <= now else { return nil }
      let laterStart = sortedEvents.dropFirst(index + 1)
        .map(\.plannedStartDate)
        .first { $0 > event.plannedStartDate }
      let fallbackEnd = min(
        laterStart ?? .distantFuture,
        event.plannedStartDate.addingTimeInterval(3_600)
      )
      let end = event.plannedEndDate ?? fallbackEnd
      return now < end ? (event, end) : nil
    }.last

    events = sortedEvents
    currentEvent = active?.0
    currentEventEnd = active?.1
    nextEvent = sortedEvents.first { $0.plannedStartDate > now }
  }
}

extension ConPawsConventionSnapshot {
  /// Keep a convention selectable while its dates are active, or while a
  /// cross-midnight personal stop is still active or waiting to begin.
  func isCurrentOrUpcoming(at date: Date) -> Bool {
    if Date(timeIntervalSince1970: endAtMs / 1_000) >= date {
      return true
    }
    let plan = ConPawsPlanTimeline(events: events, now: date)
    return plan.currentEvent != nil || plan.nextEvent != nil
  }
}

enum ConPawsSnapshotStore {
  /// Snapshot schemas this binary knows how to render.
  ///
  /// v1/v2 payloads stay valid — newer versions only add optional fields,
  /// which decode as absent — so mixed app and extension versions keep
  /// rendering rather than falling back to the empty state.
  static let supportedSchemaVersions = 1...3

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
