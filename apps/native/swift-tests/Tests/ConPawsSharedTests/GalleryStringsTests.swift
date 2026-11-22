import Foundation
import Testing
@testable import ConPawsShared

/// The complication's face-editor name and description, and the sample panel
/// its gallery preview draws. The extension has no string resources, so these
/// were English on every watch, and the preview set English panel names under
/// headings in the watch's language.
struct GalleryStringsTests {
  private static let nonEnglish = ConPawsLanguage.allCases.filter { $0 != .en }

  @Test(arguments: nonEnglish)
  func everyLanguageTranslatesTheGallery(language: ConPawsLanguage) {
    let english = ConPawsStrings.english
    let strings = ConPawsStrings.table(for: language)
    #expect(strings.complicationName != english.complicationName)
    #expect(strings.complicationDescription != english.complicationDescription)
    #expect(strings.previewEventTitle != english.previewEventTitle)
    #expect(strings.previewRoom != english.previewRoom)
  }

  /// The brand stays a name in every language; only "Schedule" translates.
  @Test(arguments: ConPawsLanguage.allCases)
  func theGalleryNameKeepsTheBrand(language: ConPawsLanguage) {
    #expect(ConPawsStrings.table(for: language).complicationName.contains("ConPaws"))
  }

  /// The gallery is drawn before any app language is known, so it follows the
  /// watch, as the empty state does.
  @Test(arguments: [
    (["ja-JP"], "ConPawsスケジュール"),
    (["de-DE", "en-US"], "ConPaws-Zeitplan"),
    (["tr-TR"], "ConPaws Schedule"),
  ])
  func theGalleryFollowsTheWatchsLanguage(preferred: [String], expected: String) {
    let identifier = ConPawsSnapshot.deviceLocaleIdentifier(preferredLanguages: preferred)
    #expect(ConPawsStrings.resolve(identifier).complicationName == expected)
  }
}
