import SwiftUI

/// The phone's "Other options this hour", by this watch's clock. Each row
/// opens the panel with an Add button. Draws nothing without options.
struct OtherOptionsSection: View {
  @Environment(\.locale) private var locale
  let convention: ConPawsConventionSnapshot
  let options: [ConPawsEventSnapshot]
  let strings: ConPawsStrings

  var body: some View {
    if !options.isEmpty {
      SectionLabel(title: strings.otherOptionsThisHour)
      ForEach(options) { option in
        EventCard(
          eyebrow: ConPawsFormat.timeRange(option, in: convention, locale: locale),
          event: option,
          conventionID: convention.id,
          accented: false,
          route: .option(conventionID: convention.id, eventID: option.id)
        ) {
          if let place = option.shortPlace {
            Text(place).privacySensitive()
          }
        }
      }
    }
  }
}
