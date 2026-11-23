import Foundation
import Testing
@testable import ConPawsShared

/// A panel reminder tapped on the Watch opens that panel. The phone files it
/// (src/services/notifications.ts) with the panel's ids in its user info, and
/// iOS forwards it to the Watch with them.
struct ReminderNotificationTests {
  /// The user info expo-notifications gives a reminder: the request's `data`,
  /// at the top level.
  private let reminder: [AnyHashable: Any] = [
    "kind": "event-reminder",
    "eventId": "meetup",
    "conventionId": "con",
  ]

  // MARK: Which notifications

  @Test func aTappedReminderNamesItsPanel() {
    let link = ConPawsReminderNotification.link(
      categoryIdentifier: "conpaws.reminder",
      userInfo: reminder
    )
    #expect(link == .event(conventionID: "con", eventID: "meetup"))
  }

  /// Filed by a phone build from before the category, and still pending
  /// until the app is next opened and files it again.
  @Test func aReminderFiledWithoutTheCategoryStillNamesItsPanel() {
    let link = ConPawsReminderNotification.link(categoryIdentifier: "", userInfo: reminder)
    #expect(link == .event(conventionID: "con", eventID: "meetup"))
  }

  /// The category alone is enough: the kind is the phone's own tap handler's
  /// field, and a reminder filed in the category still opens its panel
  /// if that field ever changes.
  @Test func theReminderCategoryAloneNamesItsPanel() {
    var info = reminder
    info["kind"] = nil
    let link = ConPawsReminderNotification.link(categoryIdentifier: "conpaws.reminder", userInfo: info)
    #expect(link == .event(conventionID: "con", eventID: "meetup"))
  }

  /// The debug menu's test notification, or anything else the app files,
  /// opens no panel.
  @Test func anotherNotificationNamesNoPanel() {
    let link = ConPawsReminderNotification.link(
      categoryIdentifier: "",
      userInfo: ["kind": "developer-test", "eventId": "meetup", "conventionId": "con"]
    )
    #expect(link == nil)
  }

  enum Damage: CaseIterable, Sendable {
    case noConvention, nullConvention, emptyConvention, noEvent, numericEvent
  }

  /// The phone sends `null` for a convention it does not know; JSON null
  /// arrives as `NSNull`. Without both ids there is no panel to look up.
  @Test(arguments: Damage.allCases)
  func aReminderMissingAnIDNamesNoPanel(_ damage: Damage) {
    var info = reminder
    switch damage {
    case .noConvention: info["conventionId"] = nil
    case .nullConvention: info["conventionId"] = NSNull()
    case .emptyConvention: info["conventionId"] = ""
    case .noEvent: info["eventId"] = nil
    case .numericEvent: info["eventId"] = 42
    }
    let link = ConPawsReminderNotification.link(categoryIdentifier: "conpaws.reminder", userInfo: info)
    #expect(link == nil)
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
        startAtMs: 1_795_183_200_000, // Fri 20 Nov 2026, 08:00 Chicago
        endAtMs: 1_795_478_400_000, // Mon 23 Nov, 18:00
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "",
        events: [
          ConPawsEventSnapshot(
            id: "meetup", title: "Meetup", startAtMs: 1_795_291_200_000, // Sat 14:00
            endAtMs: 1_795_294_800_000, // 15:00
            location: nil, room: "Hall A", reminderMinutes: 10, ageRating: nil, summary: nil
          ),
        ],
        options: nil
      ),
    ]
  )

  @Test func aTappedReminderOpensItsSavedPanel() {
    let route = ConPawsReminderNotification.route(
      for: .event(conventionID: "con", eventID: "meetup"),
      in: snapshot
    )
    #expect(route == .event(conventionID: "con", eventID: "meetup"))
  }

  /// Removed on the phone, or in a convention this Watch has not been sent:
  /// the app comes forward where it was rather than on an empty screen.
  @Test(arguments: [
    ConPawsWatchLink.event(conventionID: "con", eventID: "gone"),
    .event(conventionID: "other", eventID: "meetup"),
    .home,
  ])
  func aReminderForNoSavedPanelOpensNothing(_ link: ConPawsWatchLink) {
    #expect(ConPawsReminderNotification.route(for: link, in: snapshot) == nil)
  }

  /// The screen closes once a schedule without its panel arrives, as a
  /// pushed one does.
  @Test func aReminderScreenStaysOnlyWhileThePlanHoldsItsPanel() {
    let route = WatchRoute.event(conventionID: "con", eventID: "meetup")
    #expect(ConPawsReminderNotification.keeps(route, in: snapshot))
    #expect(ConPawsReminderNotification.keeps(route, in: .empty(localeIdentifier: "en")) == false)
  }
}
