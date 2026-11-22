import Foundation
import Testing
@testable import ConPawsShared

/// The line under the Watch's Add and Remove button. A change the phone makes
/// replaces the button -- an added option's screen shows the panel as saved,
/// a removed panel's screen closes -- so a wait that ends with the same
/// button still on screen is a change the phone did not make.
struct WatchPlanNoteTests {
  @Test(arguments: [WatchPlanNote.none, .waiting])
  func aWaitThatEndsUnderTheSameButtonIsAChangeNotMade(before: WatchPlanNote) {
    #expect(before.after(wasPending: true, isPending: false) == .notChanged)
  }

  /// A new tap starts a new wait, and the old outcome no longer describes it.
  @Test(arguments: [WatchPlanNote.none, .notChanged])
  func aNewWaitClearsTheNote(before: WatchPlanNote) {
    #expect(before.after(wasPending: false, isPending: true) == .none)
  }

  /// The minute tick redraws the button without its wait changing.
  @Test(arguments: [
    (WatchPlanNote.none, true),
    (.waiting, true),
    (.none, false),
    (.notChanged, false),
  ])
  func anUnchangedWaitKeepsTheNote(before: WatchPlanNote, isPending: Bool) {
    #expect(before.after(wasPending: isPending, isPending: isPending) == before)
  }

  /// A phone app that is running confirms in about a second; the wait is
  /// named only after that, so the caption never just flashes.
  @Test func theWaitIsNamedOnlyOnceItOutlastsARunningPhone() {
    #expect(WatchPlanNote.waitingDelay >= 2)
    #expect(WatchPlanNote.waitingDelay <= 5)
  }

  @Test func eachNoteSaysWhatItMeans() {
    let strings = ConPawsStrings.english
    #expect(WatchPlanNote.none.text(strings) == nil)
    #expect(WatchPlanNote.waiting.text(strings) == "Open ConPaws on your iPhone")
    #expect(
      WatchPlanNote.notChanged.text(strings)
        == "The event could not be changed. Your schedule was left as it was."
    )
  }
}
