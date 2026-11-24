import Foundation
import Testing
@testable import ConPawsShared

/// The Watch's reasons for a tap the phone declined, in all 23 languages.
/// Watch-only wording with no phone catalog to copy, so parity here means
/// every language has its own table, written in it, with every reason.
struct TapResultStringsTests {
  private static let declines: [ConPawsWatchTapDecline] = [
    .changedOnIphone, .cancelled, .offSchedule, .addOnIphone, .tooOld, .failed, .unknown,
  ]

  @Test(arguments: ConPawsLanguage.allCases)
  func everyLanguageHasItsOwnReasons(language: ConPawsLanguage) {
    let strings = ConPawsTapResultStrings.table(for: language)
    #expect(strings.language == language)
    let english = ConPawsTapResultStrings.table(for: .en)
    for (value, englishValue) in zip(strings.values, english.values) {
      #expect(!value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      // No format specifiers: nothing is substituted into a reason.
      #expect(!value.contains("%"))
      if language != .en {
        #expect(value != englishValue, "\(language.rawValue) still reads \"\(englishValue)\"")
      }
    }
  }

  @Test(arguments: ConPawsLanguage.allCases)
  func everyDeclineReadsInTheAppsLanguage(language: ConPawsLanguage) {
    let strings = ConPawsStrings.table(for: language)
    for decline in Self.declines {
      #expect(!strings.declineText(decline).isEmpty)
    }
    // An iPhone app that gave no reason gets the phone's own wording.
    #expect(strings.declineText(.unknown) == strings.notChanged)
  }

  /// A reason sits under a button on a 41 mm face in the footnote style;
  /// past this it wraps to a fourth line at the default text size.
  @Test(arguments: ConPawsLanguage.allCases)
  func reasonsAreWristSized(language: ConPawsLanguage) {
    for value in ConPawsTapResultStrings.table(for: language).values {
      #expect(value.count <= 48, "\(language.rawValue): \"\(value)\" is \(value.count) characters")
    }
  }

  @Test func englishSaysWhatHappenedAndWhy() {
    let strings = ConPawsStrings.english
    #expect(strings.declineText(.changedOnIphone) == "Not changed: edited on iPhone")
    #expect(strings.declineText(.cancelled) == "Not added: the convention cancelled it")
    #expect(strings.declineText(.offSchedule) == "Not changed: no longer on the schedule")
    #expect(strings.declineText(.addOnIphone) == "Not added: add this one on iPhone")
    #expect(strings.declineText(.tooOld) == "Not changed: over a day old")
    #expect(strings.declineText(.failed) == "Not changed: try again")
  }
}
