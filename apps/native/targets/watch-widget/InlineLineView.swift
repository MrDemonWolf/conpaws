import SwiftUI

/// One candidate inline line: the text, after the state's symbol when it has
/// one. The face takes only an image and a text from inline content, so this
/// is a Label and nothing more.
struct InlineLineView: View {
  let text: String
  let symbol: String?

  var body: some View {
    if let symbol {
      Label(text, systemImage: symbol)
    } else {
      Text(text)
    }
  }
}
