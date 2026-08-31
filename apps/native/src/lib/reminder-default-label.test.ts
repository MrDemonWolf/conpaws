import { describe, expect, it } from "vitest";

import { reminderDefaultLabel } from "./reminder-default-label";
import { REMINDER_DEFAULT_OPTIONS } from "./reminder-default-storage";

/** Echoes the key so the branch taken is visible, and records interpolation. */
const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key) as never;

describe("reminderDefaultLabel", () => {
  it("calls no default a default of its own, not 'at event time'", () => {
    // 0 is a real choice -- a reminder that fires as the event starts. Folding
    // null into it would silently turn "no reminder" into one.
    expect(reminderDefaultLabel(null, t)).toBe(
      "settings.notifications.noDefault",
    );
    expect(reminderDefaultLabel(0, t)).toBe("reminders.atTime");
  });

  it("uses the hour phrasing at 60 rather than '60 minutes before'", () => {
    expect(reminderDefaultLabel(60, t)).toBe("reminders.hourBefore");
  });

  it("interpolates the count for every other option", () => {
    expect(reminderDefaultLabel(15, t)).toBe(
      'reminders.minutesBefore:{"minutes":15}',
    );
  });

  it("labels every option Settings actually offers", () => {
    // The screen maps this list; a new option with no branch would fall to the
    // minutes phrasing, which is right for 5/10/15/30 and wrong for 120.
    for (const minutes of REMINDER_DEFAULT_OPTIONS) {
      expect(reminderDefaultLabel(minutes, t)).not.toBe("");
    }
  });
});
