import SwiftUI

struct SavedScheduleLabel: View {
  @Environment(\.locale) private var locale
  let strings: ConPawsStrings
  var snapshotDate: Date?
  let now: Date
  var alignment: TextAlignment = .leading

  private var updatedText: String? {
    snapshotDate.map { ConPawsSnapshotAge.updatedText(since: $0, now: now, locale: locale) }
  }

  private var stackAlignment: HorizontalAlignment {
    switch alignment {
    case .leading: .leading
    case .center: .center
    case .trailing: .trailing
    }
  }

  var body: some View {
    // Modifiers go on the stack: an `if` is not a view to modify. The symbol
    // carries "this may be out of date", which used to be a third line.
    if let updatedText {
      VStack(alignment: stackAlignment, spacing: 1) {
        Label {
          Text(strings.text(strings.lastUpdatedFormat, updatedText))
        } icon: {
          Image(systemName: "exclamationmark.arrow.circlepath")
        }
        Text(strings.openOnIphone)
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(alignment)
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(strings.text(strings.staleA11yFormat, updatedText))
    }
  }
}
