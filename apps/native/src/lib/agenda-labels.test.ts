import { describe, expect, it } from "vitest";

import {
  agendaGapLabel,
  agendaStatusLabel,
  eventReminderLabel,
  feedStatusLabel,
} from "./agenda-labels";

/** Echoes the key, plus any interpolation, so the branch taken is visible. */
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never;

describe("agendaGapLabel", () => {
  it("names back-to-back panels without a count", () => {
    expect(agendaGapLabel({ kind: "backToBack" }, t)).toBe(
      "convention.plan.gap.backToBack",
    );
  });

  it("gives an overlap its minutes", () => {
    expect(agendaGapLabel({ kind: "overlap", minutes: 15 }, t)).toBe(
      'convention.plan.gap.overlap|{"minutes":15}',
    );
  });

  it("keeps a short break in minutes", () => {
    expect(
      agendaGapLabel({ kind: "free", minutes: 45, hint: "short" }, t),
    ).toBe('convention.plan.gap.free|{"minutes":45}');
  });

  it("says whole hours without a minutes part", () => {
    expect(
      agendaGapLabel({ kind: "free", minutes: 120, hint: "long" }, t),
    ).toBe('convention.plan.gap.freeHours|{"hours":2}');
  });

  it("splits a long break into hours and minutes", () => {
    expect(agendaGapLabel({ kind: "free", minutes: 95, hint: "long" }, t)).toBe(
      'convention.plan.gap.freeHoursMinutes|{"hours":1,"minutes":35}',
    );
  });
});

describe("agendaStatusLabel", () => {
  it("labels every status but upcoming", () => {
    expect(agendaStatusLabel("now", t)).toBe("convention.plan.status.now");
    expect(agendaStatusLabel("endedToday", t)).toBe(
      "convention.plan.status.endedToday",
    );
    expect(agendaStatusLabel("ended", t)).toBe("convention.plan.status.ended");
    expect(agendaStatusLabel("upcoming", t)).toBeUndefined();
  });
});

describe("feedStatusLabel", () => {
  it("names why the feed dropped an event", () => {
    expect(feedStatusLabel("cancelled", t)).toBe(
      "convention.feedStatus.cancelled",
    );
    expect(feedStatusLabel("removed", t)).toBe("convention.feedStatus.removed");
  });

  it("is null while the feed still publishes the event", () => {
    expect(feedStatusLabel(null, t)).toBeNull();
    expect(feedStatusLabel(undefined, t)).toBeNull();
  });
});

describe("eventReminderLabel", () => {
  it("is absent without a reminder", () => {
    expect(eventReminderLabel(null, t)).toBeUndefined();
  });

  it("reads 0 as minutes before, not 'at event time'", () => {
    expect(eventReminderLabel(0, t)).toBe(
      'reminders.minutesBefore|{"minutes":0}',
    );
  });

  it("uses minutes for ordinary lead times and the hour phrasing at 60", () => {
    expect(eventReminderLabel(15, t)).toBe(
      'reminders.minutesBefore|{"minutes":15}',
    );
    expect(eventReminderLabel(60, t)).toBe(
      'reminders.hourBefore|{"minutes":60}',
    );
  });
});
