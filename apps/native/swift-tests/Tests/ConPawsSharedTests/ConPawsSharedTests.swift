import Foundation
import Testing
@testable import ConPawsShared

struct ConPawsSharedTests {
  @Test(arguments: ConPawsLanguage.allCases)
  func canonicalWidgetStringsCrossTheBridge(language: ConPawsLanguage) throws {
    let strings = ConPawsStrings.resolve(language.rawValue)
    let data = try JSONEncoder().encode(strings)
    let decoded = try JSONDecoder().decode(ConPawsStrings.self, from: data)
    #expect(decoded.language == language)
    #expect(decoded.upNextCaps == strings.upNextCaps)
    #expect(!decoded.hoursUnit.other.isEmpty)
  }
  @Test(arguments: [
    [" room ", " venue ", "room • venue"],
    [" room ", "room", "room"],
    [" \n", "", ""],
    ["", " venue ", "venue"]
  ])
  func roomLeadsThePlaceLabel(values: [String]) {
    let event = ConPawsEventSnapshot(
      id: "panel", title: "Panel", startAtMs: 0, endAtMs: nil,
      location: values[1], room: values[0], reminderMinutes: nil, ageRating: nil, summary: nil
    )
    #expect(event.place == (values[2].isEmpty ? nil : values[2]))
  }

  @Test(arguments: [
    ("Studio B", "Center", "Studio B"),
    (nil, "Center", "Center"),
    ("  ", "Center", "Center"),
    (" Hall A \n", nil, "Hall A"),
    (nil, nil, nil),
  ] as [(String?, String?, String?)])
  func shortPlaceIsRoomFirst(room: String?, location: String?, expected: String?) {
    let event = ConPawsEventSnapshot(
      id: "panel", title: "Panel", startAtMs: 0, endAtMs: nil,
      location: location, room: room, reminderMinutes: nil, ageRating: nil, summary: nil
    )
    #expect(event.shortPlace == expected)
  }

  // Inclusive at the edge: the watch app ticks on minute boundaries, so the
  // tick that opens a 60-minute window lands on exactly 3,600 seconds.
  @Test(arguments: [
    (-60.0, false), (0, false), (1, true), (3_599, true), (3_600, true), (3_601, false),
  ])
  func liveTimerIncludesTheEdgeOfItsWindow(secondsLeft: TimeInterval, expected: Bool) {
    let now = Date(timeIntervalSince1970: 1_767_225_600)
    let target = now.addingTimeInterval(secondsLeft)
    #expect(ConPawsCountdown.showsLiveTimer(from: now, to: target, within: 3_600) == expected)
  }

  @Test func unknownEventEndsDoNotBecomePublishedEndTimes() throws {
    let decoder = JSONDecoder()
    let withoutEnd = #"{"id":"panel","title":"Panel","startAtMs":50400000}"#
    let withEnd = #"{"id":"panel","title":"Panel","startAtMs":50400000,"endAtMs":54000000}"#
    let unknown = try decoder.decode(ConPawsEventSnapshot.self, from: Data(withoutEnd.utf8))
    let known = try decoder.decode(ConPawsEventSnapshot.self, from: Data(withEnd.utf8))
    let locale = Locale(identifier: "en-US-u-hc-h23")
    let zone = TimeZone(secondsFromGMT: 0)!
    #expect(unknown.currentTimingLabel(timeZone: zone, locale: locale, strings: .english) == "14:00")
    #expect(known.currentTimingLabel(timeZone: zone, locale: locale, strings: .english) == "UNTIL 15:00")
    #expect(ConPawsScheduleResolver.effectiveEnd(of: unknown).timeIntervalSince1970 == 54_000)
  }

  /// CLDR's cardinal rules, written out case by case rather than recomputed:
  /// a rule copied into both the code and its test fails neither.
  @Test(arguments: [
    // Czech: few is 2-4 only, never 22.
    (ConPawsLanguage.cs, 1, ConPawsPluralForm.one),
    (.cs, 2, .few),
    (.cs, 4, .few),
    (.cs, 5, .other),
    (.cs, 21, .other),
    (.cs, 22, .other),
    // Polish: 22 is few, the teens are not, and 21 is not one.
    (.pl, 1, .one),
    (.pl, 5, .other),
    (.pl, 12, .other),
    (.pl, 21, .other),
    (.pl, 22, .few),
    (.pl, 112, .other),
    // Russian and Ukrainian: 21 is one, 11 and 111 are not.
    (.ru, 1, .one),
    (.ru, 2, .few),
    (.ru, 5, .other),
    (.ru, 11, .other),
    (.ru, 21, .one),
    (.ru, 22, .few),
    (.ru, 111, .other),
    (.uk, 11, .other),
    (.uk, 21, .one),
    (.uk, 24, .few),
    // Every other language: one for 1 alone.
    (.en, 1, .one),
    (.en, 2, .other),
    (.en, 21, .other),
    (.de, 1, .one),
    (.de, 2, .other),
    (.ja, 1, .one),
  ])
  func pluralForm(language: ConPawsLanguage, count: Int, form: ConPawsPluralForm) {
    #expect(language.pluralForm(count) == form)
  }

  @Test(arguments: ["ja", "pt", "de_DE", "pt-BR", "es", "zh-Hant-TW", "zh-HK", "unknown"])
  func languageResolution(identifier: String) {
    let expected: [String: ConPawsLanguage] = ["ja": .ja, "pt": .ptBR, "de_DE": .de, "pt-BR": .ptBR, "es": .es419, "zh-Hant-TW": .zhTW, "zh-HK": .zhTW, "unknown": .en]
    #expect(ConPawsLanguage.resolve(identifier) == expected[identifier])
  }

  @Test func countdownLadder() {
    let now = Date(timeIntervalSince1970: 1_767_225_600)
    let zone = TimeZone(identifier: "UTC")!
    func prose(_ seconds: TimeInterval) -> String {
      ConPawsCountdown.label(from: now, to: now.addingTimeInterval(seconds), timeZone: zone, strings: .english)
    }
    #expect(prose(-60) == "Now")
    #expect(prose(0) == "Now")
    #expect(prose(60) == "Starting soon")
    #expect(prose(3_599) == "Starting soon")
    #expect(prose(3_600) == "In 1 hour")
    #expect(prose(86_399) == "In 23 hours")
    #expect(prose(86_400) == "Tomorrow")
    #expect(prose(13 * 86_400) == "In 13 days")
    #expect(prose(30 * 86_400) == "In 30 days")
    #expect(prose(60 * 86_400) == "In 2 months")
    #expect(ConPawsCountdown.leaveMinutes(from: now, to: now.addingTimeInterval(1_080)) == 18)
    #expect(ConPawsCountdown.leaveLead(from: now, to: now.addingTimeInterval(1_080), timeZone: zone, strings: .english).text == "Starts in 18 min")
    #expect(ConPawsCountdown.leaveLead(from: now, to: now.addingTimeInterval(7_200), timeZone: zone, strings: .english).text == "Starts in 2 hours")
    let leaveTicks = ConPawsCountdown.leaveChangePoints(from: now, to: now.addingTimeInterval(1_080))
    #expect(leaveTicks.count == 18)
    #expect(leaveTicks.first == now.addingTimeInterval(60))
    #expect(leaveTicks.last == now.addingTimeInterval(1_080))
    #expect(ConPawsStrings.english.moreToday(3) == "+3 more today")
    let polish = ConPawsStrings.table(for: .pl)
    #expect(polish.hours(1) == "1 godzina")
    #expect(polish.hours(2) == "2 godziny")
    #expect(polish.hours(5) == "5 godzin")
    #expect(polish.hours(12) == "12 godzin")
    #expect(polish.hours(22) == "22 godziny")
    #expect(polish.inDays(3) == "Za 3 dni")
  }

  /// Both Watch targets read the iPhone app's App Group. Only these two
  /// targets compile this code, so only their suffixes need stripping.
  @Test(arguments: [
    ("com.mrdemonwolf.conpaws.watchkitapp", "group.com.mrdemonwolf.conpaws"),
    ("com.mrdemonwolf.conpaws.watchkitapp.widgets", "group.com.mrdemonwolf.conpaws"),
    ("com.mrdemonwolf.conpaws.dev.watchkitapp", "group.com.mrdemonwolf.conpaws.dev"),
    ("com.mrdemonwolf.conpaws.dev.watchkitapp.widgets", "group.com.mrdemonwolf.conpaws.dev"),
  ])
  func appGroupIdentifierStripsWatchSuffixes(bundle: String, group: String) {
    #expect(ConPawsSnapshotStore.appGroupIdentifier(bundleIdentifier: bundle) == group)
  }

  @Test func snapshotDecodesAndFiltersBadRows() throws {
    let json = #"{"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en","conventions":[{"id":"ok","name":"Convention","startAtMs":1,"endAtMs":2,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[{"id":"good","title":"Panel","startAtMs":1,"endAtMs":2},{"id":"bad","title":"Broken","startAtMs":3,"endAtMs":2}]},{"id":"bad-con","name":"Bad","startAtMs":2,"endAtMs":1,"timeZoneIdentifier":"UTC","dateRangeLabel":"","events":[] }]}"#
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    let filtered = decoded.filteringInvalidRecords()
    #expect(filtered.conventions.count == 1)
    #expect(filtered.conventions[0].events.map(\.id) == ["good"])
    #expect(decoded.timeFormat == nil)
  }

  @Test(arguments: [1, 2])
  func olderSnapshotsKeepTheDeviceClock(schema: Int) throws {
    let json = """
      {"schemaVersion":\(schema),"generatedAtMs":1,"localeIdentifier":"en","conventions":[]}
      """
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    #expect(decoded.timeFormat == nil)
    #expect(decoded.filteringInvalidRecords().timeFormat == nil)
  }

  // The watch's clock in ms, as `generatedAtMs` carries the phone's.
  private static let nowMs: Double = 1_000_000_000_000
  private static let minuteMs: Double = 60_000
  private static let hourMs: Double = 3_600_000

  // Stamps in minutes from the watch's now.
  @Test(arguments: [
    // Newer wins.
    (-1, 0, true),
    // A copy of the stored snapshot (application context and user info both
    // carry it) is applied once, not twice.
    (0, 0, false),
    // A late delivery of an older schedule never replaces a newer one, however
    // much older it is.
    (0, -1, false),
    (0, -120, false),
    (0, -43_200, false),
    // A stored stamp ahead of this watch's clock came from a phone with a bad
    // RTC: anything replaces it, or nothing ever would again.
    (4_320, 0, true),
    (120, -1, true),
    // A phone clock a little fast is not a bad one.
    (30, 0, false),
  ] as [(Double, Double, Bool)])
  func newerSnapshotWins(storedMinutes: Double, candidateMinutes: Double, expected: Bool) {
    let replaces = ConPawsSnapshotStore.shouldReplace(
      storedMs: Self.nowMs + storedMinutes * Self.minuteMs,
      candidateMs: Self.nowMs + candidateMinutes * Self.minuteMs,
      nowMs: Self.nowMs
    )
    #expect(replaces == expected)
  }

  @Test func anySnapshotReplacesAnEmptyStore() {
    #expect(
      ConPawsSnapshotStore.shouldReplace(
        storedMs: ConPawsSnapshot.empty.generatedAtMs, candidateMs: Self.nowMs, nowMs: Self.nowMs
      )
    )
  }

  // The Watch app, closed for an afternoon, receives the newest schedule as
  // application context and then every queued user info, oldest first. None
  // of the older ones may show, even for a moment.
  @Test func aReplayedBacklogNeverRewindsTheSchedule() {
    let stamps = stride(from: 0.0, through: 4 * Self.hourMs, by: 20 * 60_000)
      .map { Self.nowMs - 4 * Self.hourMs + $0 }
    var storedMs = stamps.last!
    var applied: [Double] = []
    for candidateMs in stamps
    where ConPawsSnapshotStore.shouldReplace(
      storedMs: storedMs, candidateMs: candidateMs, nowMs: Self.nowMs
    ) {
      applied.append(candidateMs)
      storedMs = candidateMs
    }
    #expect(applied.isEmpty)
    #expect(storedMs == Self.nowMs)
  }

  @Test(arguments: ["12", "24"])
  func snapshotPreservesClockChoice(format: String) throws {
    let json = """
      {"schemaVersion":2,"generatedAtMs":1,"localeIdentifier":"en-US","conventions":[],"timeFormat":"\(format)"}
      """
    let decoded = try JSONDecoder().decode(ConPawsSnapshot.self, from: Data(json.utf8))
    let filtered = decoded.filteringInvalidRecords()
    #expect(filtered.timeFormat == format)
    #expect(filtered.locale.hourCycle == (format == "12" ? .oneToTwelve : .zeroToTwentyThree))
    let formatter = DateFormatter()
    formatter.locale = filtered.locale
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.timeStyle = .short
    let time = formatter.string(from: Date(timeIntervalSince1970: 19 * 60 * 60))
    #expect(time.contains(format == "12" ? "7:00" : "19:00"))
    #expect((try JSONDecoder().decode(ConPawsSnapshot.self, from: JSONEncoder().encode(filtered))).timeFormat == format)
  }
}
