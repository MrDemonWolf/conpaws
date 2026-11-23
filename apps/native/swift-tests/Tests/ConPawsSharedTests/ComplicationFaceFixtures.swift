import Foundation
@testable import ConPawsShared

/// One convention in Chicago, Fri 20 to Sun 22 Nov 2026, and the panels the
/// complication summary and face tests save into it. Times are written as
/// Chicago wall-clock times, so a Mac in another zone still reads them the
/// way the convention does.
enum FaceFixture {
  static let zone = TimeZone(identifier: "America/Chicago")!
  static let english = Locale(identifier: "en_US")
  static let german = Locale(identifier: "de_DE")

  static func local(_ day: Int, _ hour: Int, _ minute: Int = 0, month: Int = 11) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = zone
    return calendar.date(
      from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute)
    )!
  }

  static func event(
    _ title: String,
    from start: Date,
    until end: Date? = nil,
    room: String? = nil,
    location: String? = nil,
    reminderMinutes: Int? = nil
  ) -> ConPawsEventSnapshot {
    ConPawsEventSnapshot(
      id: title.lowercased().replacingOccurrences(of: " ", with: "-"),
      title: title,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.map { $0.timeIntervalSince1970 * 1_000 },
      location: location,
      room: room,
      reminderMinutes: reminderMinutes,
      ageRating: nil,
      summary: nil
    )
  }

  static func convention(
    _ events: [ConPawsEventSnapshot] = [],
    name: String = "FurCon",
    from start: Date = local(20, 0),
    until end: Date = local(23, 0)
  ) -> ConPawsConventionSnapshot {
    ConPawsConventionSnapshot(
      id: "furcon",
      name: name,
      startAtMs: start.timeIntervalSince1970 * 1_000,
      endAtMs: end.timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: zone.identifier,
      dateRangeLabel: "Nov 20–22",
      events: events,
      options: nil
    )
  }

  static func snapshot(
    _ conventions: [ConPawsConventionSnapshot],
    generatedAt: Date,
    language: String = "en"
  ) -> ConPawsSnapshot {
    ConPawsSnapshot(
      schemaVersion: 2,
      generatedAtMs: generatedAt.timeIntervalSince1970 * 1_000,
      localeIdentifier: language,
      conventions: conventions
    )
  }

  /// The card at `now` for one convention, with a plan made a minute before,
  /// so it is fresh unless a test says otherwise.
  static func projection(
    _ events: [ConPawsEventSnapshot],
    at now: Date,
    generatedAt: Date? = nil,
    convention: ConPawsConventionSnapshot? = nil
  ) -> ConPawsComplicationProjection {
    let value = snapshot(
      [convention ?? self.convention(events)],
      generatedAt: generatedAt ?? now.addingTimeInterval(-60)
    )
    return ConPawsComplicationProjection(snapshot: value, now: now)
  }

  static let meetup = event(
    "Fursuit Meetup",
    from: local(21, 14),
    until: local(21, 15),
    room: "Hall A",
    location: "Center",
    reminderMinutes: 30
  )
  static let artJam = event("Art Jam", from: local(21, 13), until: local(21, 14, 30), room: "Studio B")
}
