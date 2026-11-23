import Foundation
import Testing
@testable import ConPawsShared

/// The words only the smaller complication families draw. They live in
/// their own table beside `ConPawsStrings`, so they get the same checks: a
/// table per language, every one translated, and short enough for the slot.
struct ComplicationStringsTests {
  private static let nonEnglish = ConPawsLanguage.allCases.filter { $0 != .en }

  /// Two cases pointing at one table would compile and quietly ship another
  /// language's words.
  @Test(arguments: ConPawsLanguage.allCases)
  func everyLanguageHasItsOwnTable(language: ConPawsLanguage) {
    #expect(ConPawsComplicationStrings.table(for: language).language == language)
    #expect(ConPawsStrings.table(for: language).complication.language == language)
  }

  @Test(arguments: nonEnglish)
  func everyLanguageIsTranslated(language: ConPawsLanguage) {
    let english = ConPawsComplicationStrings.table(for: .en)
    let strings = ConPawsComplicationStrings.table(for: language)
    #expect(strings.inlineNoPicks != english.inlineNoPicks)
    #expect(strings.inlineFinished != english.inlineFinished)
  }

  /// The inline slot above the time on a 41 mm face holds about this many
  /// characters; the status headings these stand in for run to 32.
  @Test(arguments: ConPawsLanguage.allCases)
  func inlineStatusFitsTheSlot(language: ConPawsLanguage) {
    let strings = ConPawsComplicationStrings.table(for: language)
    let full = ConPawsStrings.table(for: language)
    for (short, heading) in [
      (strings.inlineNoPicks, full.noPicksComplication),
      (strings.inlineFinished, full.finishedComplication),
    ] {
      #expect(short.isEmpty == false)
      #expect(short.count <= 18, "\(language): \(short) is too long for the inline slot")
      #expect(short.count <= heading.count, "\(language): \(short) is no shorter than \(heading)")
    }
  }
}
