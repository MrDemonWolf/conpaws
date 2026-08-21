import SwiftUI
import WidgetKit

@main
@available(iOS 17.0, *)
struct ConPawsWidgetBundle: WidgetBundle {
  init() {
    #if DEBUG
    runConPawsWidgetSelfCheck()
    #endif
  }

  var body: some Widget {
    ConPawsWidget()
  }
}
