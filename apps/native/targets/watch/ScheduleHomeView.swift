import SwiftUI

struct ScheduleHomeView: View {
  @Environment(\.locale) private var locale
  let schedule: WatchScheduleProjection
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: WatchMetrics.cardSpacing) {
        if let convention = schedule.convention {
          header(convention)

          // The outcome first, centered, before any link: it used to render
          // at the very bottom, under the Today row, as two overlapping lines.
          if case .finished = schedule.state {
            FinishedStatusView(convention: convention, now: schedule.now, strings: strings)
          }

          if let current = schedule.activeEvent {
            if schedule.nextEvent == nil {
              currentOnlyHero(current, in: convention)
            } else {
              EventCard(
                eyebrow: strings.happeningNowCaps,
                event: current,
                conventionID: convention.id
              ) {
                TimeAndPlace(
                  time: ConPawsFormat.timeRange(current, in: convention, locale: locale),
                  place: current.shortPlace
                )
              }
            }
          }

          if let next = schedule.nextEvent {
            nextHero(next, in: convention)
          }

          if !schedule.laterEvents.isEmpty {
            SectionLabel(title: strings.laterLabel)
            ForEach(schedule.laterEvents) { event in
              EventCard(
                // Day-aware: a bare "11:00 AM" for tomorrow's panel read as
                // later today.
                eyebrow: ConPawsFormat.nextEventTime(
                  event.startDate,
                  relativeTo: schedule.now,
                  in: convention,
                  locale: locale,
                  strings: strings
                ),
                event: event,
                conventionID: convention.id,
                accented: false
              ) {
                if let place = event.shortPlace {
                  Text(place).privacySensitive()
                }
              }
            }
          }

          // Hidden on a day with no picks rather than offering "Today 0" and
          // an empty screen behind it.
          if !schedule.todayEvents.isEmpty {
            TodayLinkRow(count: schedule.todayEvents.count, strings: strings)
          }

          OtherOptionsSection(
            convention: convention,
            options: convention.optionsThisHour(at: schedule.now),
            strings: strings
          )
        }

        if isUsingSavedSchedule {
          SavedScheduleLabel(strings: strings, snapshotDate: snapshotDate, now: schedule.now)
            .padding(.horizontal, WatchMetrics.cardInset)
        }
      }
      .padding(.horizontal, 4)
      .padding(.bottom, 8)
    }
    .navigationTitle(strings.scheduleTitle)
    .toolbar {
      if !schedule.todayEvents.isEmpty {
        ToolbarItem(placement: .topBarTrailing) {
          NavigationLink(value: WatchRoute.today) {
            Label(strings.today, systemImage: "list.bullet")
          }
        }
      }
    }
  }

  private func header(_ convention: ConPawsConventionSnapshot) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      Text(convention.name)
        .font(.caption.bold())
        .foregroundStyle(.secondary)
        .lineLimit(2)
        .accessibilityAddTraits(.isHeader)
      Spacer(minLength: 0)
      if isUsingSavedSchedule {
        // Seen at the top, where the eye lands; spoken once, by the footer,
        // which carries the full sentence and when the plan last synced.
        Image(systemName: "exclamationmark.arrow.circlepath")
          .font(.caption)
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
      }
    }
    .padding(.horizontal, WatchMetrics.cardInset)
  }

  private func nextHero(
    _ next: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> some View {
    // One answer for both the eyebrow and the value line. Separate boundary
    // tests left the first minute of every leave window reading
    // "STARTS IN / Starting soon" instead of a ticking timer.
    let showsTimer = ConPawsCountdown.showsLiveTimer(
      from: schedule.now,
      to: next.startDate,
      within: ConPawsCountdown.eventTimerWindow
    )
    let isToday = ConPawsFormat.dayLabel(
      next.startDate,
      relativeTo: schedule.now,
      in: convention,
      locale: locale,
      strings: strings
    ) == nil

    return HeroCard(
      eyebrow: showsTimer ? strings.startsInCaps : strings.upNextCaps,
      event: next,
      conventionID: convention.id
    ) {
      if showsTimer {
        AdaptiveCountdownView(
          target: next.startDate,
          now: schedule.now,
          timeZone: convention.timeZone,
          showsTimer: true,
          strings: strings
        )
      } else if isToday {
        // "In 3 hours": the same ladder the complication reads. Another day
        // gets no value line; the detail line already says "Tomorrow".
        AdaptiveCountdownView(
          target: next.startDate,
          now: schedule.now,
          timeZone: convention.timeZone,
          showsTimer: false,
          strings: strings
        )
      }
    } detail: {
      TimeAndPlace(
        time: ConPawsFormat.nextEventTime(
          next.startDate,
          relativeTo: schedule.now,
          in: convention,
          locale: locale,
          strings: strings
        ),
        place: next.shortPlace
      )
      // Only while it is still to come: after it fires, "Reminder at…"
      // describes the past. The bell says "reminder", so the line keeps the
      // time and the offset; VoiceOver, which cannot see the bell, gets the
      // whole sentence.
      let reminder = ConPawsFormat.upcomingReminderTime(
        next, now: schedule.now, in: convention, locale: locale, strings: strings
      )
      let spoken = ConPawsFormat.upcomingReminderAt(
        next, now: schedule.now, in: convention, locale: locale, strings: strings
      )
      if let reminder, let spoken {
        Label {
          Text(reminder)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityLabel(spoken)
        } icon: {
          Image(systemName: "bell")
            .accessibilityHidden(true)
        }
      }
    }
  }

  private func currentOnlyHero(
    _ current: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> some View {
    let timing = current.currentTimingLabel(
      timeZone: convention.timeZone,
      locale: locale,
      strings: strings
    )
    return HeroCard(
      eyebrow: "\(strings.happeningNowCaps) · \(timing)",
      event: current,
      conventionID: convention.id
    ) {
      EmptyView()
    } detail: {
      if let place = current.shortPlace {
        Text(place).privacySensitive()
      }
      // The short form: the long one truncated at 41 and 45mm.
      Text(strings.noLaterSavedEventsShort)
    }
  }
}
