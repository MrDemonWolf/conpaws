import Foundation
import Testing
@testable import ConPawsShared

/// Where a tap on the complication opens the Watch app. Without a link the
/// app came forward on whatever screen it was last left on, often an old
/// panel's detail. Instants are seconds since 1970, with their Chicago
/// wall-clock time beside them.
struct WatchLinkTests {
  // MARK: Round trip

  /// Ids arrive from the phone's database and can hold anything, URL
  /// metacharacters included. They must come back exactly as they went.
  @Test(arguments: [
    ("con", "panel"),
    ("con /?#", "a&b=c"),
    ("50%+off", "#1 panel?"),
    ("über-con", "パネル"),
  ])
  func anEventLinkRoundTrips(conventionID: String, eventID: String) throws {
    let link = ConPawsWatchLink.event(conventionID: conventionID, eventID: eventID)
    let url = try #require(link.url)
    #expect(url.scheme == "conpaws-watch")
    #expect(ConPawsWatchLink(url: url) == link)
  }

  @Test func theHomeLinkRoundTrips() throws {
    let url = try #require(ConPawsWatchLink.home.url)
    #expect(ConPawsWatchLink(url: url) == .home)
  }

  /// The phone's own deep links and anything malformed open nothing.
  @Test(arguments: [
    "conpaws://schedule?conventionId=con",
    "https://conpaws.com/event?conventionId=con&eventId=panel",
    "conpaws-watch://event?conventionId=con",
    "conpaws-watch://event?eventId=panel",
    "conpaws-watch://event?conventionId=&eventId=panel",
    "conpaws-watch://settings",
  ])
  func aLinkTheWatchCannotOpenIsIgnored(text: String) throws {
    let url = try #require(URL(string: text))
    #expect(ConPawsWatchLink(url: url) == nil)
  }

  // MARK: Which screen

  private let snapshot = ConPawsSnapshot(
    schemaVersion: 2,
    generatedAtMs: 1_795_287_600_000,
    localeIdentifier: "en",
    conventions: [
      ConPawsConventionSnapshot(
        id: "con",
        name: "Convention",
        startAtMs: 1_795_183_200_000, // Fri 20 Nov 2026, 08:00
        endAtMs: 1_795_478_400_000, // Mon 23 Nov, 18:00
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "",
        events: [
          ConPawsEventSnapshot(
            id: "first", title: "First", startAtMs: 1_795_287_600_000, // Sat 13:00
            endAtMs: 1_795_290_600_000, // 13:50
            location: nil, room: nil, reminderMinutes: nil, ageRating: nil, summary: nil
          ),
          ConPawsEventSnapshot(
            id: "meetup", title: "Meetup", startAtMs: 1_795_291_200_000, // Sat 14:00
            endAtMs: 1_795_294_800_000, // 15:00
            location: nil, room: nil, reminderMinutes: 10, ageRating: nil, summary: nil
          ),
        ],
        options: nil
      ),
    ]
  )

  /// The card's panel: the next one while one is coming, including in the
  /// leave window, or the running one when nothing follows.
  @Test(arguments: [
    1_795_288_800.0, // Sat 13:20, First running, Meetup next
    1_795_290_900, // Sat 13:55, leave for Meetup
    1_795_293_000, // Sat 14:30, Meetup running, nothing after
  ])
  func aPanelCardOpensThatPanel(now: TimeInterval) {
    let projection = ConPawsComplicationProjection(
      snapshot: snapshot,
      now: Date(timeIntervalSince1970: now)
    )
    #expect(projection.link == .event(conventionID: "con", eventID: "meetup"))
  }

  /// A countdown or status card has no panel, so it opens the home screen.
  @Test(arguments: [
    1_795_111_200.0, // Thu 19 Nov, 12:00, coming up
    1_795_296_600, // Sat 15:30, all picked panels over
    1_795_543_200, // Tue 24 Nov, 12:00, the convention has ended
  ])
  func aCardWithoutAPanelOpensHome(now: TimeInterval) {
    let projection = ConPawsComplicationProjection(
      snapshot: snapshot,
      now: Date(timeIntervalSince1970: now)
    )
    #expect(projection.link == .home)
  }

  @Test func anEmptyPlanOpensHome() {
    let projection = ConPawsComplicationProjection(
      snapshot: .empty(localeIdentifier: "en"),
      now: Date(timeIntervalSince1970: 1_795_288_800)
    )
    #expect(projection.link == .home)
  }
}
