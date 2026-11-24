import Foundation
import Testing
@testable import ConPawsShared

/// The Watch's words for withdrawn panels: every language has its own table,
/// and the Home notice picks one or many as the phone's banner does. Their
/// wording is held to the app catalogs by watch-withdrawn-strings-parity.test.ts.
struct WithdrawnStringsTests {
  @Test(arguments: ConPawsLanguage.allCases)
  func everyLanguageHasItsOwnWords(language: ConPawsLanguage) {
    let strings = ConPawsWithdrawnStrings.table(for: language)
    #expect(strings.language == language)
    for value in [strings.cancelled, strings.removed, strings.goneOne, strings.goneManyFormat] {
      #expect(!value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    }
    #expect(strings.goneManyFormat.components(separatedBy: "%@").count == 2)
    #expect(strings.notice(count: 7).contains("7"))
    #expect(!strings.notice(count: 7).contains("%@"))
  }

  @Test func theNoticeIsOneOrMany() {
    let strings = ConPawsStrings.resolve("en").withdrawnStrings
    #expect(strings.notice(count: 1) == "A saved panel is off the schedule")
    #expect(strings.notice(count: 3) == "3 saved panels are off the schedule")
  }

  @Test func theLabelNamesTheStatus() {
    let strings = ConPawsStrings.resolve("de").withdrawnStrings
    #expect(strings.label(for: .cancelled) == "Abgesagt")
    #expect(strings.label(for: .removed) == "Nicht mehr im Programm")
  }
}
