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
      location: values[1], room: values[0], reminderMinutes: nil, ageRating: nil
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
      location: location, room: room, reminderMinutes: nil, ageRating: nil
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

  @Test(arguments: [1, 2, 5, 11, 12, 21, 22, 25, 111, 112])
  func pluralForms(count: Int) {
    let expected: [ConPawsLanguage: ConPawsPluralForm] = [
      .cs: count == 1 ? .one : (2...4).contains(count) ? .few : .other,
      .pl: count == 1 ? .one : ((2...4).contains(count % 10) && !(12...14).contains(count % 100)) ? .few : .other,
      .ru: count % 10 == 1 && count % 100 != 11 ? .one : ((2...4).contains(count % 10) && !(12...14).contains(count % 100)) ? .few : .other,
      .uk: count % 10 == 1 && count % 100 != 11 ? .one : ((2...4).contains(count % 10) && !(12...14).contains(count % 100)) ? .few : .other
    ]
    for (language, form) in expected { #expect(language.pluralForm(count) == form) }
  }

  @Test(arguments: ["ja", "pt", "de_DE", "pt-BR", "es", "zh-Hant-TW", "zh-HK", "unknown"])
  func languageResolution(identifier: String) {
    let expected: [String: ConPawsLanguage] = ["ja": .ja, "pt": .ptBR, "de_DE": .de, "pt-BR": .ptBR, "es": .es419, "zh-Hant-TW": .zhTW, "zh-HK": .zhTW, "unknown": .en]
    #expect(ConPawsLanguage.resolve(identifier) == expected[identifier])
  }

  @Test func countdownLadder() {
    let now = Date(timeIntervalSince1970: 1_767_225_600)
    let zone = TimeZone(identifier: "UTC")!
    func compact(_ seconds: TimeInterval) -> String {
      ConPawsCountdown.compactLabel(from: now, to: now.addingTimeInterval(seconds), timeZone: zone, strings: .english)
    }
    func prose(_ seconds: TimeInterval) -> String {
      ConPawsCountdown.label(from: now, to: now.addingTimeInterval(seconds), timeZone: zone, strings: .english)
    }
    #expect(compact(-60) == "Now")
    #expect(compact(0) == "Now")
    #expect(compact(60) == "Soon")
    #expect(compact(3_599) == "Soon")
    #expect(compact(3_600) == "1h")
    #expect(compact(86_399) == "23h")
    #expect(compact(86_400) == "1d")
    #expect(compact(6 * 3_600) == "6h")
    #expect(compact(13 * 86_400) == "13d")
    #expect(compact(30 * 86_400) == "30d")
    #expect(compact(31 * 86_400) == "1mo")
    #expect(compact(60 * 86_400) == "2mo")
    #expect(prose(3_600) == "In 1 hour")
    #expect(prose(86_400) == "Tomorrow")
    #expect(prose(13 * 86_400) == "In 13 days")
    #expect(prose(30 * 86_400) == "In 30 days")
    #expect(prose(60 * 86_400) == "In 2 months")
    #expect(ConPawsCountdown.ringProgress(from: now, to: now.addingTimeInterval(7 * 86_400)) == 0)
    #expect(abs(ConPawsCountdown.ringProgress(from: now, to: now.addingTimeInterval(3.5 * 86_400)) - 0.5) < 0.0001)
    #expect(ConPawsCountdown.leaveMinutes(from: now, to: now.addingTimeInterval(1_080)) == 18)
    #expect(ConPawsCountdown.leaveCountdown(from: now, to: now.addingTimeInterval(1_080), timeZone: zone, strings: .english) == "18 min")
    #expect(ConPawsCountdown.leaveLead(from: now, to: now.addingTimeInterval(1_080), timeZone: zone, strings: .english) == "Starts in 18 min")
    #expect(ConPawsCountdown.leaveLead(from: now, to: now.addingTimeInterval(7_200), timeZone: zone, strings: .english) == "Starts in 2 hours")
    let leaveTicks = ConPawsCountdown.leaveChangePoints(from: now, to: now.addingTimeInterval(1_080))
    #expect(leaveTicks.count == 18)
    #expect(leaveTicks.first == now.addingTimeInterval(60))
    #expect(leaveTicks.last == now.addingTimeInterval(1_080))
    #expect(ConPawsCountdown.leaveProgress(from: now, to: now.addingTimeInterval(900), windowMinutes: 15) == 0)
    #expect(abs(ConPawsCountdown.leaveProgress(from: now, to: now.addingTimeInterval(450), windowMinutes: 15) - 0.5) < 0.0001)
    #expect(ConPawsStrings.english.moreToday(3) == "+3 more today")
    #expect(ConPawsStrings.english.starred(8) == "8 events starred")
    #expect(ConPawsStrings.english.ends("1:00 AM") == "ends 1:00 AM")
    #expect(ConPawsStrings.english.firstTomorrow("Fursuit Care Workshop", "9:00 AM") == "First event tomorrow: Fursuit Care Workshop, 9:00 AM.")
    let polish = ConPawsStrings.table(for: .pl)
    #expect(polish.hours(1) == "1 godzina")
    #expect(polish.hours(2) == "2 godziny")
    #expect(polish.hours(5) == "5 godzin")
    #expect(polish.hours(12) == "12 godzin")
    #expect(polish.hours(22) == "22 godziny")
    #expect(polish.inDays(3) == "Za 3 dni")
    #expect(ConPawsCountdown.ringProgress(from: now, to: now) == 1)
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
