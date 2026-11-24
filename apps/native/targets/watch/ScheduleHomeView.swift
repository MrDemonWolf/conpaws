import SwiftUI

struct ScheduleHomeView: View {
  @Environment(\.locale) private var locale
  let schedule: WatchScheduleProjection
  let isUsingSavedSchedule: Bool
  var snapshotDate: Date?
  let strings: ConPawsStrings
  /// Bumped on the tick that draws the Go card with Home in front, for one
  /// tap on the wrist.
  @State private var goTaps = 0
  /// The window last tapped for, so coming back to Home seconds after it
  /// opened does not tap again.
  @State private var announcedGo: WatchGoWindow.Announcement?
  /// Home is the screen on top: the only time Double Tap opens the Go card.
  @State private var isOnTop = false

  var body: some View {
    let goEvent = schedule.goEvent
    let goAnnouncement = schedule.goAnnouncement
    // Withdrawn panels included, so a day whose saved panels were all
    // cancelled still reaches Today, where they show struck through.
    let todayCount = schedule.todayRows.count

    ScrollView {
      LazyVStack(alignment: .leading, spacing: WatchMetrics.cardSpacing) {
        if let convention = schedule.convention {
          header(convention)

          // The outcome first, centered, before any link: it used to render
          // at the very bottom, under the Today row, as two overlapping lines.
          if case .finished = schedule.state {
            FinishedStatusView(convention: convention, now: schedule.now, strings: strings)
          }

          // Time to go: Up Next moves above the running panel, as the Go
          // card, for as long as the complication shows its leave countdown.
          if let goEvent {
            goCard(goEvent, in: convention)
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

          if let next = schedule.nextEvent, goEvent == nil {
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
          if todayCount > 0 {
            TodayLinkRow(count: todayCount, strings: strings)
          }

          WithdrawnNoticeRow(schedule: schedule, strings: strings)

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
      if todayCount > 0 {
        ToolbarItem(placement: .topBarTrailing) {
          NavigationLink(value: WatchRoute.today) {
            Label(strings.today, systemImage: "list.bullet")
          }
        }
      }
    }
    .onAppear { isOnTop = true }
    .onDisappear { isOnTop = false }
    // One id per window opening, so the minute tick never restarts the wait.
    .task(id: goAnnouncement) {
      await tapWhenWindowOpens(goAnnouncement)
    }
    .sensoryFeedback(.start, trigger: goTaps)
  }

  /// Sleeps until the minute tick that draws Up Next's Go card, then taps the
  /// wrist once if Home is still in front. Pushing a screen or a new Up Next
  /// cancels the wait; a wake well after that tick is the app returning or
  /// launching mid-window and stays quiet. The system plays nothing
  /// wrist-down.
  private func tapWhenWindowOpens(_ announcement: WatchGoWindow.Announcement?) async {
    guard let announcement else { return }
    let wait = announcement.tick.timeIntervalSinceNow
    if wait > 0 {
      // Tight: left to the system, the wake of an hours-long sleep can be
      // coalesced past the seconds `isOnTime` allows.
      guard
        (try? await Task.sleep(for: .seconds(wait), tolerance: .seconds(1))) != nil
      else { return }
    }
    // Read after the sleep, where it is current.
    guard announcement != announcedGo, WatchGoWindow.isOnTime(announcement, at: .now) else {
      return
    }
    announcedGo = announcement
    goTaps += 1
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

  private func goCard(
    _ next: ConPawsEventSnapshot,
    in convention: ConPawsConventionSnapshot
  ) -> some View {
    // The Up Next card's rule. Every reminder the app offers is an hour or
    // less, so this is a timer; a longer lead from elsewhere reads the
    // ladder under UP NEXT rather than "STARTS IN In 2 hours".
    let showsTimer = ConPawsCountdown.showsLiveTimer(
      from: schedule.now,
      to: next.startDate,
      within: ConPawsCountdown.eventTimerWindow
    )
    return GoCard(
      eyebrow: showsTimer ? strings.startsInCaps : strings.upNextCaps,
      event: next,
      conventionID: convention.id,
      opensOnDoubleTap: isOnTop
    ) {
      AdaptiveCountdownView(
        target: next.startDate,
        now: schedule.now,
        timeZone: convention.timeZone,
        showsTimer: showsTimer,
        strings: strings
      )
    }
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
