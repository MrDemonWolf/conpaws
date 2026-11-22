import SwiftUI

/// Centers short content on the screen and scrolls it once it outgrows the
/// screen (large Dynamic Type, long translations), so it never clips.
struct CenteredScrollView<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    ViewThatFits(in: .vertical) {
      content
      ScrollView {
        content
      }
    }
  }
}
