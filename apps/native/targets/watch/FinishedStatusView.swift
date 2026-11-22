import SwiftUI

/// The finished state's message, centered under the header.
struct FinishedStatusView: View {
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "checkmark.circle")
        .font(.title2)
        .foregroundStyle(Color.accentColor)
        .accessibilityHidden(true)
      Text(strings.finishedTitle)
        .font(.headline)
      // Only while the convention is still on, when adding a panel on the
      // phone is still worth doing. The watch has no schedule to browse, so
      // this points at the phone rather than at "the schedule in ConPaws".
      if convention.endDate > now {
        Text(strings.openOnIphone)
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity)
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}
