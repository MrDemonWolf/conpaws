import Foundation
import Testing
@testable import ConPawsShared

/// What the Watch app and complication say before the phone has sent a
/// snapshot they can read. They used to say it in English whatever the
/// wearer's language; the app's language only arrives with the first
/// snapshot, so until then the watch's own language is the best guess.
struct EmptySnapshotTests {
  @Test(arguments: [
    (["de-DE"], ConPawsLanguage.de),
    (["zh-Hant-TW"], .zhTW),
    (["es-MX"], .es419),
    (["pt-PT", "en-US"], .ptPT),
    (["tr-TR"], .en),
    ([], .en),
  ])
  func nothingStoredSpeaksTheWatchsLanguage(preferred: [String], expected: ConPawsLanguage) {
    let snapshot = ConPawsSnapshotStore.snapshot(fromStored: nil, preferredLanguages: preferred)
    #expect(snapshot.strings.language == expected)
    #expect(snapshot.conventions.isEmpty)
    #expect(snapshot.generatedAtMs == 0)
  }

  @Test func unreadableJSONSpeaksTheWatchsLanguage() {
    let snapshot = ConPawsSnapshotStore.snapshot(fromStored: "{not json", preferredLanguages: ["fr-FR"])
    #expect(snapshot.strings.language == .fr)
    #expect(snapshot.conventions.isEmpty)
  }

  /// A payload from a newer app that this binary cannot render still names
  /// the language the wearer chose in the app, which beats the watch's.
  @Test func aNewerSchemaKeepsTheAppsLanguage() {
    let stored = #"{"schemaVersion":99,"generatedAtMs":1,"localeIdentifier":"nl","conventions":"changed"}"#
    let snapshot = ConPawsSnapshotStore.snapshot(fromStored: stored, preferredLanguages: ["de-DE"])
    #expect(snapshot.strings.language == .nl)
    #expect(snapshot.conventions.isEmpty)
    #expect(snapshot.generatedAtMs == 0)
  }

  @Test func aBlankStoredLanguageFallsBackToTheWatchs() {
    let stored = #"{"schemaVersion":99,"localeIdentifier":" "}"#
    let snapshot = ConPawsSnapshotStore.snapshot(fromStored: stored, preferredLanguages: ["ja-JP"])
    #expect(snapshot.strings.language == .ja)
  }

  @Test func aReadableSnapshotIsReturnedAsStored() {
    let stored = #"{"schemaVersion":2,"generatedAtMs":5,"localeIdentifier":"pl","conventions":[]}"#
    let snapshot = ConPawsSnapshotStore.snapshot(fromStored: stored, preferredLanguages: ["de-DE"])
    #expect(snapshot.strings.language == .pl)
    #expect(snapshot.generatedAtMs == 5)
  }

  /// `.empty` is read afresh each time, so it follows the host's language
  /// rather than whichever one it had when first touched.
  @Test func emptyFollowsTheHostsPreferredLanguage() {
    #expect(
      ConPawsLanguage.resolve(ConPawsSnapshot.empty.localeIdentifier)
        == ConPawsLanguage.resolve(Locale.preferredLanguages.first ?? "en")
    )
  }
}
