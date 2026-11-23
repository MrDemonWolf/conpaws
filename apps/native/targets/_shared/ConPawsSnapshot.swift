import Foundation

struct ConPawsSnapshot: Codable, Sendable {
  let schemaVersion: Int
  let generatedAtMs: Double
  let localeIdentifier: String
  let conventions: [ConPawsConventionSnapshot]
  /// Optional so snapshots from older app versions keep using the device clock.
  var timeFormat: String?
  /// Watch commands the phone has finished with in the last day, whatever the
  /// outcome. A tap the phone declined never shows up as a change, so this is
  /// what frees its button. iOS payloads only; optional, so every older
  /// payload still decodes.
  var handledCommandIds: [String]?

  /// What the targets show before the phone has sent a snapshot they can
  /// read, in the watch's own language: the app's language only arrives with
  /// a snapshot. Computed rather than stored, so it never keeps the language
  /// it had when first read.
  static var empty: ConPawsSnapshot { empty() }

  static func empty(
    localeIdentifier: String = deviceLocaleIdentifier()
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 1,
      generatedAtMs: 0,
      localeIdentifier: localeIdentifier,
      conventions: []
    )
  }

  /// The wearer's first preferred language, for text drawn before the app's
  /// is known. Not `Locale.current`: in a target without localizations, such
  /// as the complication, that falls back to the development language.
  static func deviceLocaleIdentifier(
    preferredLanguages: [String] = Locale.preferredLanguages
  ) -> String {
    preferredLanguages.first ?? "en"
  }

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
    switch timeFormat {
    case "12": components.hourCycle = .oneToTwelve
    case "24": components.hourCycle = .zeroToTwentyThree
    default: break
    }
    return Locale(components: components)
  }

  /// The words every date's neighbouring text is written in.
  ///
  /// Same source as `locale` and for the same reason: these targets follow the
  /// app's language setting, not the phone's.
  var strings: ConPawsStrings {
    ConPawsStrings.resolve(localeIdentifier)
  }

  func filteringInvalidRecords() -> ConPawsSnapshot {
    var seenConventions = Set<String>()
    let validConventions = conventions.compactMap { convention -> ConPawsConventionSnapshot? in
      guard seenConventions.insert(convention.id).inserted,
        !convention.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        !convention.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        convention.startAtMs.isFinite, convention.endAtMs.isFinite,
        convention.endAtMs >= convention.startAtMs,
        TimeZone(identifier: convention.timeZoneIdentifier) != nil
      else { return nil }
      var seenEvents = Set<String>()
      let events = convention.events.filter { event in
        seenEvents.insert(event.id).inserted && Self.isValid(event)
      }
      // Options pass the same checks, and continue the same id set: an option
      // repeating a saved event would offer to add what is already planned.
      let options = convention.options.map { options in
        options.filter { option in
          seenEvents.insert(option.id).inserted && Self.isValid(option)
        }
      }
      return ConPawsConventionSnapshot(
        id: convention.id, name: convention.name, startAtMs: convention.startAtMs,
        endAtMs: convention.endAtMs, timeZoneIdentifier: convention.timeZoneIdentifier,
        dateRangeLabel: convention.dateRangeLabel, events: events, options: options
      )
    }
    return ConPawsSnapshot(schemaVersion: schemaVersion, generatedAtMs: generatedAtMs,
      localeIdentifier: localeIdentifier, conventions: validConventions, timeFormat: timeFormat,
      handledCommandIds: handledCommandIds)
  }

  private static func isValid(_ event: ConPawsEventSnapshot) -> Bool {
    !event.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && !event.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && event.startAtMs.isFinite
      && (event.endAtMs.map { $0.isFinite && $0 >= event.startAtMs } ?? true)
      && (event.reminderMinutes.map { $0 >= 0 } ?? true)
  }
}

/// Widget kinds, named once because `WidgetCenter.reloadTimelines(ofKind:)`
/// does nothing at all when handed a kind no widget answers to -- a rename that
/// misses one call site fails silently and stays broken.
enum ConPawsWidgetKind {
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
  /// Unsaved panels the Watch may offer to add: the next six hours of them
  /// when the snapshot was made, soonest first. Sent by the iOS app only, so
  /// absent from Android payloads, from older apps and whenever there is
  /// nothing to offer -- optional, and decoded with `decodeIfPresent`, so all
  /// of those still decode. See `optionsThisHour(at:)` for what is shown.
  let options: [ConPawsEventSnapshot]?
}

extension ConPawsConventionSnapshot {
  /// The phone's "Other options this hour", by the Watch's own clock.
  ///
  /// Mirrors `matchesHourSlot` in src/lib/schedule-browse.ts and the Now
  /// section in src/lib/schedule-sections.ts: an option belongs to the
  /// convention-local hour if any part of it runs then, an unknown end counts
  /// as an hour, and one that has already ended is not offered. Only while
  /// the convention is running.
  func optionsThisHour(at now: Date, limit: Int = 5) -> [ConPawsEventSnapshot] {
    let nowMs = now.timeIntervalSince1970 * 1_000
    guard let options, !options.isEmpty, startAtMs <= nowMs, nowMs < endAtMs else { return [] }
    guard let slot = calendar.dateInterval(of: .hour, for: now) else { return [] }
    let slotStartMs = slot.start.timeIntervalSince1970 * 1_000
    let slotEndMs = slot.end.timeIntervalSince1970 * 1_000
    let unknownEndMs = ConPawsScheduleResolver.unknownEndDuration * 1_000
    let saved = Set(events.map(\.id))
    return Array(
      options
        .filter { option in
          guard !saved.contains(option.id) else { return false }
          let fallbackEnd = option.startAtMs + unknownEndMs
          // matchesHourSlot's endMs: an end that is not after the start is
          // treated as unknown.
          let slotEnd = option.endAtMs.flatMap { $0 > option.startAtMs ? $0 : nil } ?? fallbackEnd
          let liveEnd = option.endAtMs ?? fallbackEnd
          return option.startAtMs < slotEndMs && slotEnd > slotStartMs && liveEnd > nowMs
        }
        .sorted { lhs, rhs in
          lhs.startAtMs != rhs.startAtMs
            ? lhs.startAtMs < rhs.startAtMs
            : lhs.title.localizedCompare(rhs.title) == .orderedAscending
        }
        .prefix(limit)
    )
  }
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
  /// The description as plain text, at most 280 characters. Watch payloads
  /// from the iOS app only; optional, decoded with `decodeIfPresent`, and
  /// absent when there is no description or the payload ran out of room.
  let summary: String?

  var place: String? {
    let values = [room, location]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    if values.count == 2, values[0] == values[1] { return values[0] }
    return values.isEmpty ? nil : values.joined(separator: " • ")
  }

  /// The room alone, or the venue when there is no room: the label for a line
  /// that has one row to fill. The venue is the same for the whole convention,
  /// so `place` ("Studio B • ConPaws Convention Center") truncated to
  /// "Studio B • ConPaws Co…" on every row that tried to fit it. Matches the
  /// phone widget's `place()`. Screens with room to spare keep `place`.
  var shortPlace: String? {
    [room, location].lazy
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .first { !$0.isEmpty }
  }

  /// Unknown ends use the published start, never the resolver's one-hour fallback.
  func currentTimingLabel(timeZone: TimeZone, locale: Locale, strings: ConPawsStrings) -> String {
    var clock = Date.FormatStyle.dateTime.hour().minute()
    clock.timeZone = timeZone
    clock.locale = locale
    let time = Date(timeIntervalSince1970: (endAtMs ?? startAtMs) / 1_000).formatted(clock)
    return endAtMs == nil ? time : strings.text(strings.untilCapsFormat, time)
  }
}

// MARK: - Dates

// One set of accessors for every target. The Watch app, the complication and
// the timeline each kept a private copy, and a private member beside an
// internal one of the same name is ambiguous in its file, so there must be
// only these.

extension ConPawsConventionSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  var endDate: Date { Date(timeIntervalSince1970: endAtMs / 1_000) }
  /// The convention's own zone. `filteringInvalidRecords` drops a convention
  /// whose identifier does not resolve, so the device zone is only a guard.
  var timeZone: TimeZone { TimeZone(identifier: timeZoneIdentifier) ?? .autoupdatingCurrent }
  var calendar: Calendar { ConPawsCalendar.convention(in: timeZone) }
}

/// The calendar every convention day, hour and month is counted in.
enum ConPawsCalendar {
  /// Gregorian, in the convention's zone, whatever calendar the watch is set
  /// to. The wearer's Hebrew or Islamic calendar counted a 30-day wait as one
  /// lunar month, so the complication said "In 1 month" while the iPhone
  /// widget, which counts Gregorian months, said "In 30 days".
  static func convention(in timeZone: TimeZone) -> Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }
}

extension ConPawsEventSnapshot {
  var startDate: Date { Date(timeIntervalSince1970: startAtMs / 1_000) }
  /// Nil while the end is unknown. Code that needs an end anyway uses
  /// `ConPawsScheduleResolver.effectiveEnd(of:)`.
  var endDate: Date? { endAtMs.map { Date(timeIntervalSince1970: $0 / 1_000) } }
}

// MARK: - Freshness

enum ConPawsSnapshotAge {
  static let staleAfter: TimeInterval = 30 * 60

  /// When the phone made `snapshot`, or nil when it holds no conventions:
  /// with no plan there is no age to show or go stale. Every rule below
  /// starts here, so none can treat the empty snapshot differently.
  static func generatedDate(of snapshot: ConPawsSnapshot) -> Date? {
    guard !snapshot.conventions.isEmpty else { return nil }
    return Date(timeIntervalSince1970: snapshot.generatedAtMs / 1_000)
  }

  /// The moment `snapshot` turns stale, or nil when it never does: a week
  /// after the phone made it while the screen only counts down to a
  /// convention (`countdownStaleAfter`), half an hour after otherwise.
  ///
  /// The one rule the Watch app, the complication's entries and the timeline
  /// that places those entries all read. When each kept its own copy, a change
  /// to one could put the stale symbol at a moment with no timeline entry, and
  /// the face stayed wrong until the next snapshot.
  static func staleDate(of snapshot: ConPawsSnapshot, countingDown: Bool = false) -> Date? {
    generatedDate(of: snapshot)?.addingTimeInterval(countingDown ? countdownStaleAfter : staleAfter)
  }

  static func isStale(_ snapshot: ConPawsSnapshot, now: Date) -> Bool {
    staleDate(of: snapshot).map { now >= $0 } ?? false
  }

  /// How old a plan may be before a convention countdown, in the Watch app
  /// or on the complication, says so. Both show a name, a date and a
  /// countdown worked out on the watch, and in the weeks before a convention
  /// the phone app is rarely opened, so the thirty-minute rule flagged a
  /// correct countdown on nearly every glance and taught the wearer to ignore
  /// the flag that matters during the convention. A week still flags a plan
  /// the phone may have changed since.
  static let countdownStaleAfter: TimeInterval = 7 * 86_400

  /// Whether the Watch app's convention countdown flags its plan as old.
  static func isCountdownStale(_ snapshot: ConPawsSnapshot, now: Date) -> Bool {
    staleDate(of: snapshot, countingDown: true).map { now >= $0 } ?? false
  }

  /// How long ago the phone made the plan, as "45 min. ago" in `locale`.
  /// Only the Watch app says this: it redraws every minute, while a
  /// complication entry would keep the age it was drawn with.
  static func updatedText(since generatedAt: Date, now: Date, locale: Locale) -> String {
    let formatter = RelativeDateTimeFormatter()
    formatter.locale = locale
    formatter.unitsStyle = .short
    return formatter.localizedString(for: generatedAt, relativeTo: now)
  }
}

/// A save or remove tapped on the Watch, for the phone to apply.
///
/// Sent as a JSON string under `messageKey`, by `sendMessage` when the phone
/// is reachable and `transferUserInfo` otherwise. The phone's native module
/// repeats the key, the actions and the id rules, because it compiles as a pod
/// on the other side of a target boundary from this folder, and
/// src/services/watch-commands.ts parses the command once more before it
/// touches a row. watch-command-contract.test.ts holds the three together.
struct ConPawsWatchCommand: Codable, Hashable, Sendable {
  enum Action: String, Codable, Sendable {
    case save
    case remove
  }

  static let messageKey = "conpaws.watch.command.v1"
  /// Ids must be shorter than this, in UTF-16 units, as JS counts them.
  static let maxIdentifierLength = 256
  /// Mirrors `WATCH_COMMAND_MAX_AGE_MS`: the phone ignores anything older, so
  /// there is no point in the Watch waiting for it any longer.
  static let maxAge: TimeInterval = 86_400

  let id: String
  let action: Action
  let conventionId: String
  let eventId: String
  let sentAtMs: Double

  init(
    action: Action,
    eventID: String,
    conventionID: String,
    sentAt: Date = Date(),
    id: String = UUID().uuidString
  ) {
    self.id = id
    self.action = action
    conventionId = conventionID
    eventId = eventID
    sentAtMs = sentAt.timeIntervalSince1970 * 1_000
  }

  var isValid: Bool {
    sentAtMs.isFinite
      && [id, conventionId, eventId].allSatisfy { value in
        !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
          && value.utf16.count < Self.maxIdentifierLength
      }
  }

  var jsonString: String? {
    guard isValid, let data = try? JSONEncoder().encode(self) else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func decode(_ json: String) -> ConPawsWatchCommand? {
    guard
      let command = try? JSONDecoder().decode(Self.self, from: Data(json.utf8)),
      command.isValid
    else { return nil }
    return command
  }

  func hasExpired(at now: Date) -> Bool {
    now.timeIntervalSince1970 * 1_000 - sentAtMs > Self.maxAge * 1_000
  }

  /// Whether `snapshot` ends the wait: the phone lists this command as
  /// handled, or the snapshot already shows what it asked for -- the event
  /// among the convention's saved events after a save, gone from them after a
  /// remove. A command the phone declined is only ever settled by the list;
  /// the effect check covers an app that does not send one.
  func isSettled(by snapshot: ConPawsSnapshot) -> Bool {
    if snapshot.handledCommandIds?.contains(id) == true { return true }
    let isSaved = snapshot.conventions.contains { convention in
      convention.id == conventionId && convention.events.contains { $0.id == eventId }
    }
    switch action {
    case .save: return isSaved
    case .remove: return !isSaved
    }
  }
}

enum ConPawsSnapshotStore {
  /// Snapshot schemas this binary knows how to render.
  ///
  /// v1 payloads stay valid — v2 only adds optional fields, which decode as
  /// absent — so an app updated under an older extension (or the reverse)
  /// keeps rendering rather than falling back to the empty state.
  static let supportedSchemaVersions = 1...2

  static let snapshotKey = "conpaws.widget.snapshot.v1"

  /// How far ahead of the watch's own clock a stored snapshot may be stamped
  /// before it reads as the work of a phone with a bad clock.
  static let rewindToleranceMs: Double = 3_600 * 1_000

  /// Whether a snapshot stamped `candidateMs` replaces the stored one.
  ///
  /// Newer wins, strictly. WatchConnectivity hands over the newest schedule
  /// as application context and then every queued user info, oldest first,
  /// so an older stamp is a late delivery and never shows, however much older
  /// it is; an equal one is the other copy of the stored snapshot. The one
  /// exception is a stored stamp more than `rewindToleranceMs` ahead of this
  /// watch's clock, which only a phone with a bad RTC writes: anything
  /// replaces it, since nothing newer ever would.
  static func shouldReplace(storedMs: Double, candidateMs: Double, nowMs: Double) -> Bool {
    candidateMs > storedMs || storedMs > nowMs + rewindToleranceMs
  }

  static func appGroupIdentifier(bundleIdentifier: String? = Bundle.main.bundleIdentifier) -> String {
    let bundle = bundleIdentifier ?? "com.mrdemonwolf.conpaws"
    let mainBundle = bundle
      .replacingOccurrences(of: ".watchkitapp.widgets", with: "")
      .replacingOccurrences(of: ".watchkitapp", with: "")
    return "group.\(mainBundle)"
  }

  static func load() -> ConPawsSnapshot {
    snapshot(
      fromStored: UserDefaults(suiteName: appGroupIdentifier())?.string(forKey: snapshotKey)
    )
  }

  /// The stored snapshot, or the empty one when nothing is stored or this
  /// binary cannot render what is. A payload it cannot render, say from a
  /// newer app, still names the language the wearer chose in the app, and
  /// the empty state keeps that rather than the watch's.
  static func snapshot(
    fromStored json: String?,
    preferredLanguages: [String] = Locale.preferredLanguages
  ) -> ConPawsSnapshot {
    let device = ConPawsSnapshot.deviceLocaleIdentifier(preferredLanguages: preferredLanguages)
    guard let data = json?.data(using: .utf8) else {
      return .empty(localeIdentifier: device)
    }
    if
      let snapshot = try? JSONDecoder().decode(ConPawsSnapshot.self, from: data),
      supportedSchemaVersions.contains(snapshot.schemaVersion)
    {
      return snapshot
    }
    let stored = (try? JSONDecoder().decode(StoredLanguage.self, from: data))?
      .localeIdentifier
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return .empty(localeIdentifier: stored.flatMap { $0.isEmpty ? nil : $0 } ?? device)
  }

  /// Just the language of a stored payload, for one that will not decode whole.
  private struct StoredLanguage: Decodable {
    let localeIdentifier: String
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
}
