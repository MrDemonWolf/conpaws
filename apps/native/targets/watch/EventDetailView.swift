import SwiftUI

struct EventDetailView: View {
  @Environment(\.locale) private var locale
  let event: ConPawsEventSnapshot
  let convention: ConPawsConventionSnapshot
  let now: Date
  let strings: ConPawsStrings
  var planAction: WatchPlanAction?
  /// The panel was just added from this screen; say so once it is confirmed.
  var confirmsSaved = false

  private var hasEnded: Bool {
    ConPawsScheduleResolver.effectiveEnd(of: event) <= now
  }

  var body: some View {
    // No navigation title: the event's own title is the heading, as watchOS
    // 10 lays out pushed screens. A generic "Event" in the bar said nothing.
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        Text(event.title)
          .font(.headline)
          .fixedSize(horizontal: false, vertical: true)
          .privacySensitive()
          .accessibilityAddTraits(.isHeader)

        savedConfirmation

        status

        if let rating = event.ageRating {
          Text(rating)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            // A platter like the cards': gone in Always On, where a lit
            // capsule around the redacted rating drew the eye to it.
            .cardBackground(.quaternary, in: Capsule())
            .privacySensitive()
        }

        Label {
          Text(clockLabel)
            .foregroundStyle(hasEnded ? HierarchicalShapeStyle.secondary : HierarchicalShapeStyle.primary)
        } icon: {
          // A check once it is over, so an ended event is not marked by a
          // dimmer color alone.
          Image(systemName: hasEnded ? "checkmark.circle" : "clock")
            .accessibilityHidden(true)
        }
        // The check is hidden, so VoiceOver hears the state in words.
        .accessibilityValue(hasEnded ? strings.ended : "")

        if let location = event.place {
          Label {
            Text(location)
              .privacySensitive()
          } icon: {
            Image(systemName: "mappin.and.ellipse")
              .accessibilityHidden(true)
          }
        }

        // The Home card's rule: only while it is still to come. Kept after it
        // fired, it read as a reminder still coming on a running panel.
        if let reminder = ConPawsFormat.upcomingReminderAt(
          event, now: now, in: convention, locale: locale, strings: strings
        ) {
          Label {
            Text(reminder)
          } icon: {
            Image(systemName: "bell")
              .accessibilityHidden(true)
          }
        }

        if let summary = event.summary {
          VStack(alignment: .leading, spacing: 2) {
            Text(strings.aboutThisPanel)
              .font(.caption2.bold())
              .foregroundStyle(.secondary)
              .accessibilityAddTraits(.isHeader)
            // Hidden wrist-down like the title: a description can say as much.
            Text(summary)
              .font(.footnote)
              .fixedSize(horizontal: false, vertical: true)
              .privacySensitive()
          }
          .padding(.top, 4)
        }

        if let planAction {
          PlanActionButton(action: planAction, eventTitle: event.title, strings: strings)
            .padding(.top, 6)
        }
      }
      .font(.callout)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 8)
    }
    .onAppear {
      // The branch that draws this replaces the option screen the moment the
      // phone confirms, so appearing is the confirmation.
      if confirmsSaved {
        AccessibilityNotification.Announcement(strings.saved).post()
      }
    }
  }

  @ViewBuilder private var savedConfirmation: some View {
    if confirmsSaved {
      Label {
        Text(strings.saved)
      } icon: {
        Image(systemName: "checkmark.circle.fill")
          .accessibilityHidden(true)
      }
      .font(.caption.bold())
      .foregroundStyle(Color.accentColor)
    }
  }

  /// Running, about to start, or later today -- in the words the Home cards
  /// already use. Another day says nothing here; the clock line names the day.
  @ViewBuilder private var status: some View {
    let start = event.startDate
    if start <= now, !hasEnded {
      Text(
        "\(strings.happeningNowCaps) · \(event.currentTimingLabel(timeZone: convention.timeZone, locale: locale, strings: strings))"
      )
      .font(.caption2.bold())
      .foregroundStyle(Color.accentColor)
    } else if ConPawsCountdown.showsLiveTimer(
      from: now,
      to: start,
      within: ConPawsCountdown.eventTimerWindow
    ) {
      VStack(alignment: .leading, spacing: 0) {
        Text(strings.startsInCaps)
          .font(.caption2.bold())
        AdaptiveCountdownView(
          target: start,
          now: now,
          timeZone: convention.timeZone,
          showsTimer: true,
          strings: strings
        )
        .font(.title3.bold())
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      }
      .foregroundStyle(Color.accentColor)
      .accessibilityElement(children: .combine)
    } else if start > now,
      ConPawsFormat.dayLabel(start, relativeTo: now, in: convention, locale: locale, strings: strings) == nil
    {
      Text(ConPawsCountdown.label(from: now, to: start, timeZone: convention.timeZone, strings: strings))
        .font(.caption.bold())
        .foregroundStyle(Color.accentColor)
    }
  }

  /// "Tomorrow · 10:00–11:30 AM" once the event is not today.
  private var clockLabel: String {
    let range = ConPawsFormat.timeRange(event, in: convention, locale: locale)
    guard
      let day = ConPawsFormat.dayLabel(
        event.startDate,
        relativeTo: now,
        in: convention,
        locale: locale,
        strings: strings
      )
    else { return range }
    return "\(day) · \(range)"
  }
}
