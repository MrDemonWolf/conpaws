import Foundation
import SwiftUI
import WidgetKit

private struct ConPawsWatchEntry: TimelineEntry {
  let date: Date
  let snapshot: ConPawsSnapshot
  /// Raises this card in the Smart Stack around the moments it matters —
  /// convention and saved-panel starts, reminder or not. Without a relevance
  /// the stack never surfaces the complication on its own.
  var relevance: TimelineEntryRelevance?

  /// The app's language, not the watch's. The snapshot carries it precisely so
  /// this complication reads the same way the phone screen it mirrors does.
  var strings: ConPawsStrings { snapshot.strings }

  /// The stale sentence VoiceOver appends to every state's label, or nil
  /// while the data is fresh. Visually, staleness is one symbol in the
  /// eyebrow: the two lines it used to add overflowed a three-line card.
  var staleNotice: String? {
    guard
      ConPawsSnapshotAge.isStale(snapshot, now: date),
      let updated = ConPawsSnapshotAge.updatedText(snapshot, now: date, locale: snapshot.locale)
    else { return nil }
    return strings.text(strings.staleA11yFormat, updated)
  }

  /// The gallery's sample: a saved panel 20 minutes out whose reminder has
  /// fired, so the card shows the leave countdown. It is drawn before any app
  /// language is known, so it speaks the watch's language, as the empty state
  /// does, and its panel and room are translated with the headings. Only the
  /// panel and room are drawn in this state, so nothing else needs words.
  static var preview: ConPawsWatchEntry {
    let now = Date()
    let localeIdentifier = ConPawsSnapshot.deviceLocaleIdentifier()
    let strings = ConPawsStrings.resolve(localeIdentifier)
    let convention = ConPawsConventionSnapshot(
      id: "preview-convention",
      name: "ConPaws",
      startAtMs: now.addingTimeInterval(-86_400).timeIntervalSince1970 * 1_000,
      endAtMs: now.addingTimeInterval(86_400).timeIntervalSince1970 * 1_000,
      timeZoneIdentifier: TimeZone.autoupdatingCurrent.identifier,
      dateRangeLabel: strings.today,
      events: [
        ConPawsEventSnapshot(
          id: "preview-next",
          title: strings.previewEventTitle,
          startAtMs: now.addingTimeInterval(1_200).timeIntervalSince1970 * 1_000,
          endAtMs: now.addingTimeInterval(4_800).timeIntervalSince1970 * 1_000,
          location: nil,
          room: strings.previewRoom,
          reminderMinutes: 30,
          ageRating: nil,
          summary: nil
        ),
      ],
      options: nil
    )
    return ConPawsWatchEntry(
      date: now,
      snapshot: ConPawsSnapshot(
        schemaVersion: 2,
        generatedAtMs: now.timeIntervalSince1970 * 1_000,
        localeIdentifier: localeIdentifier,
        conventions: [convention]
      )
    )
  }
}

private struct ConPawsWatchProvider: TimelineProvider {
  func placeholder(in context: Context) -> ConPawsWatchEntry {
    .preview
  }

  func getSnapshot(in context: Context, completion: @escaping (ConPawsWatchEntry) -> Void) {
    let cached = ConPawsSnapshotStore.load()
    completion(context.isPreview
      ? .preview
      : ConPawsWatchEntry(date: .now, snapshot: cached, relevance: nil))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<ConPawsWatchEntry>) -> Void
  ) {
    let snapshot = ConPawsSnapshotStore.load()
    // An entry for every moment the card reads differently, planned in
    // targets/_shared so swift-tests covers it. Around a convention or saved
    // panel start the card is at its most useful; the score makes the Smart
    // Stack rotate it up.
    let entries = ConPawsComplicationTimeline.plan(snapshot: snapshot, now: .now).map { planned in
      ConPawsWatchEntry(
        date: planned.date,
        snapshot: snapshot,
        relevance: planned.relevantUntil.map {
          TimelineEntryRelevance(score: 100, duration: $0.timeIntervalSince(planned.date))
        }
      )
    }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

private struct ConPawsWatchEntryView: View {
  let entry: ConPawsWatchEntry

  var body: some View {
    let schedule = ConPawsComplicationProjection(snapshot: entry.snapshot, now: entry.date)
    Group {
      switch schedule.state {
      case let .comingUp(convention):
        ComingUpWidgetView(
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .leave(current, next, convention):
        LeaveWidgetView(
          current: current,
          next: next,
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .next(current, event, convention):
        NextWidgetView(
          current: current,
          event: event,
          convention: convention,
          now: entry.date,
          strings: entry.strings
        )
      case let .current(event, convention):
        CurrentWidgetView(event: event, convention: convention, strings: entry.strings)
      case .finished:
        StatusWidgetView(title: entry.strings.finishedComplication, detail: entry.strings.finishedTitle)
      case .noPicks:
        StatusWidgetView(title: entry.strings.noPicksComplication, detail: entry.strings.noPicksTitle)
      case .noConvention:
        StatusWidgetView(title: entry.strings.noConventionComplication, detail: entry.strings.openOnIphone)
      }
    }
    // Every state is at most three lines, pinned to the top: centered, an
    // overflowing card clipped its eyebrow, which is the line carrying the
    // countdown.
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .environment(\.locale, entry.snapshot.locale)
    .environment(\.staleNotice, entry.staleNotice)
  }
}

private extension EnvironmentValues {
  /// The complication's stale sentence, or nil while the data is fresh. The
  /// eyebrow draws a symbol for it and each state appends it to its label.
  @Entry var staleNotice: String? = nil
}

/// A state's VoiceOver summary with the stale sentence after it.
private func spokenSummary(_ summary: String, stale: String?) -> String {
  guard let stale else { return summary }
  let endsSentence = summary.last.map { ".。!?！？".contains($0) } ?? true
  return endsSentence ? "\(summary) \(stale)" : "\(summary). \(stale)"
}

/// Mark + one line of context: the complication's shared first line, matching
/// the iPhone Lock Screen rectangular grammar. A reminder uses a bell in place
/// of the brand mark. A stale plan adds a trailing symbol rather than lines.
///
/// Translations run long on a 41 mm card, so the title shrinks a little
/// before anything is cut, and a `count` beside it is never cut at all.
private struct WatchEyebrow: View {
  @Environment(\.staleNotice) private var staleNotice
  let title: String
  /// Drawn after the title at full width: the leave countdown's minutes,
  /// which are the point of that card.
  var count: String?
  var symbol: String?
  /// A status card's eyebrow is its message, so it may take a second line
  /// rather than lose its end. Every other eyebrow is one line.
  var lineLimit = 1

  var body: some View {
    HStack(spacing: 4) {
      if let symbol {
        Image(systemName: symbol)
          .font(.caption2.bold())
          .accessibilityHidden(true)
      } else {
        // 16 pt: the compass ring blurs below that.
        ConPawsMark(size: 16)
      }
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text(title)
          .lineLimit(lineLimit)
          .minimumScaleFactor(0.8)
        if let count {
          Text(count)
            .lineLimit(1)
            .layoutPriority(1)
        }
      }
      if staleNotice != nil {
        Spacer(minLength: 2)
        Image(systemName: "exclamationmark.arrow.circlepath")
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .font(.caption2.bold())
    .foregroundStyle(Color.accentColor)
    .widgetAccentable()
  }
}

/// "2:00 PM · Hall A" as two Text views, so the room can be privacy-sensitive
/// on its own: wrist-down the watch face hides it, like the app does, and
/// keeps the time. The time wins the width; the room truncates first.
private struct WidgetDetailLine: View {
  let time: String
  let place: String?

  var body: some View {
    HStack(spacing: 3) {
      Text(time)
        .layoutPriority(1)
      if let place {
        Text(verbatim: "·")
          .accessibilityHidden(true)
        Text(place)
          .privacySensitive()
      }
    }
    .font(.caption2)
    .foregroundStyle(.secondary)
    .lineLimit(1)
  }
}

private struct ComingUpWidgetView: View {
  @Environment(\.staleNotice) private var staleNotice
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      WatchEyebrow(title: convention.name)
      WidgetCountdownView(
        target: convention.startDate,
        now: now,
        timeZone: convention.timeZone,
        strings: strings
      )
      .font(.headline)
      .monospacedDigit()
      Text(
        convention.dateRangeLabel.isEmpty ? strings.comingUpTitle : convention.dateRangeLabel
      )
      .font(.caption2)
      .foregroundStyle(.secondary)
      .lineLimit(1)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      spokenSummary(
        ConPawsComplicationSpeech.comingUp(convention, now: now, strings: strings),
        stale: staleNotice
      )
    )
  }
}

private struct LeaveWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let current: ConPawsEventSnapshot?
  let next: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    // Three lines: countdown, where to go, when. The running event and the
    // reminder (which has already fired by the time this state exists) are
    // spoken, not drawn.
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: lead.phrase, count: lead.minutes, symbol: "bell")
        .monospacedDigit()

      Text(next.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()

      WidgetDetailLine(time: nextTime, place: next.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
  }

  private var lead: ConPawsCountdown.LeaveLead {
    ConPawsCountdown.leaveLead(
      from: now,
      to: next.startDate,
      timeZone: convention.timeZone,
      strings: strings
    )
  }

  private var nextTime: String {
    ConPawsFormat.nextEventTime(
      next.startDate,
      relativeTo: now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }

  private var accessibilitySummary: String {
    // A redacted face must not be read aloud either: the label replaces the
    // children, so `privacySensitive` on them never reaches VoiceOver. Speak
    // only what stays drawn, the lead and the clock time.
    if redactionReasons.contains(.privacy) {
      return "\(lead.text), \(nextTime)."
    }
    return ConPawsComplicationSpeech.leave(
      current: current,
      next: next,
      now: now,
      startTime: nextTime,
      strings: strings
    )
  }
}

private struct NextWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let current: ConPawsEventSnapshot?
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings

  var body: some View {
    // Three lines about the next event. The running event and the pending
    // reminder are spoken, not drawn: as extra lines they pushed the card
    // past what accessoryRectangular holds.
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: strings.upNextCaps)
      Text(event.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()
      WidgetDetailLine(time: startTime, place: event.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
  }

  private var startTime: String {
    ConPawsFormat.nextEventTime(
      event.startDate,
      relativeTo: now,
      in: convention,
      locale: locale,
      strings: strings
    )
  }

  private var accessibilitySummary: String {
    let reminder = ConPawsFormat.reminderAt(event, in: convention, locale: locale, strings: strings)
      .map { ". \($0)" } ?? ""
    // Redacted: no titles or rooms, as on screen (see LeaveWidgetView).
    if redactionReasons.contains(.privacy) {
      return "\(strings.upNextCaps), \(startTime)\(reminder)."
    }
    let next = strings.text(strings.nextEventA11yFormat, event.title, startTime)
    let currentText = current.map { "\(strings.happeningNowCaps), \($0.title). " } ?? ""
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(currentText)\(next)\(place)\(reminder)."
  }
}

private struct CurrentWidgetView: View {
  @Environment(\.locale) private var locale
  @Environment(\.staleNotice) private var staleNotice
  @Environment(\.redactionReasons) private var redactionReasons
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let strings: ConPawsStrings

  var body: some View {
    // The time range moves down to the detail line, so the eyebrow no longer
    // truncates "HAPPENING NOW · UNTIL 10:30 AM".
    VStack(alignment: .leading, spacing: 1) {
      WatchEyebrow(title: strings.happeningNowCaps)
      Text(event.title)
        .font(.headline)
        .lineLimit(1)
        .privacySensitive()
      WidgetDetailLine(time: timeRange, place: event.shortPlace)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary(accessibilitySummary, stale: staleNotice))
  }

  private var timeRange: String {
    ConPawsFormat.timeRange(event, in: convention, locale: locale)
  }

  private var accessibilitySummary: String {
    // Redacted: no title or room, as on screen (see LeaveWidgetView).
    if redactionReasons.contains(.privacy) {
      return "\(strings.happeningNowCaps), \(timeRange). \(strings.noLaterSavedEventsShort)."
    }
    let place = event.place.map { ", \($0)" } ?? ""
    return "\(strings.happeningNowCaps), \(event.title), \(timeRange)\(place). \(strings.noLaterSavedEventsShort)."
  }
}

private struct StatusWidgetView: View {
  @Environment(\.staleNotice) private var staleNotice
  let title: String
  let detail: String

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      // The message comes first and may wrap; the detail fills what is
      // left. "Panels auf dem iPhone hinzufügen" is wider than the card.
      WatchEyebrow(title: title, lineLimit: 2)
        .layoutPriority(1)
      Text(detail)
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(2)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(spokenSummary("\(title), \(detail)", stale: staleNotice))
  }
}

private struct WidgetCountdownView: View {
  let target: Date
  let now: Date
  let timeZone: TimeZone
  let strings: ConPawsStrings

  var body: some View {
    Text(ConPawsCountdown.label(from: now, to: target, timeZone: timeZone, strings: strings))
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }
}

struct ConPawsWatchWidget: Widget {
  static let kind = ConPawsWidgetKind.watchComplication

  private static var galleryStrings: ConPawsStrings {
    .resolve(ConPawsSnapshot.deviceLocaleIdentifier())
  }

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: ConPawsWatchProvider()) { entry in
      ConPawsWatchEntryView(entry: entry)
        // The target's own $widgetBackground, through the symbol Xcode
        // generates for it, so a renamed asset fails the build instead of
        // falling back silently.
        .containerBackground(Color(.widgetBackground), for: .widget)
    }
    // System-drawn in the face editor and the Smart Stack's add sheet, where
    // the app's language is not known, so in the watch's. This target has no
    // string resources, so the words come from the shared table through the
    // String overloads, which show them as given.
    .configurationDisplayName(Self.galleryStrings.complicationName)
    .description(Self.galleryStrings.complicationDescription)
    .supportedFamilies([.accessoryRectangular])
  }
}
