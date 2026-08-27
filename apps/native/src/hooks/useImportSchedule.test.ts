import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ImportedReminderEvent,
  rearmImportedReminders,
} from "./useImportSchedule";

const { repo, notifications } = vi.hoisted(() => ({
  repo: { update: vi.fn() },
  notifications: {
    scheduleEventReminder: vi.fn(),
    cancelEventReminder: vi.fn(),
  },
}));

vi.mock("@/db/repositories/events", () => repo);
vi.mock("@/services/notifications", () => notifications);
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

const NOW = Date.parse("2026-08-27T12:00:00.000Z");

function reminderEvent(
  overrides: Partial<ImportedReminderEvent> = {},
): ImportedReminderEvent {
  return {
    id: "event-1",
    conventionId: "convention-1",
    title: "Fursuit Parade",
    startTime: "2026-08-27T18:00:00.000Z",
    room: "Main Stage",
    location: null,
    reminderMinutes: 30,
    ...overrides,
  };
}

describe("rearmImportedReminders", () => {
  beforeEach(() => {
    repo.update.mockReset().mockResolvedValue(undefined);
    notifications.scheduleEventReminder.mockReset();
    notifications.cancelEventReminder.mockReset().mockResolvedValue(true);
  });

  it("keeps the saved choice when the OS request throws", async () => {
    notifications.scheduleEventReminder.mockRejectedValue(
      new Error("notification store unavailable"),
    );

    const result = await rearmImportedReminders([reminderEvent()], NOW);

    expect(result).toEqual({ rescheduled: 0, cleared: 0, paused: 1 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("keeps the saved choice when permission is missing", async () => {
    notifications.scheduleEventReminder.mockResolvedValue(null);

    const result = await rearmImportedReminders([reminderEvent()], NOW);

    expect(result).toEqual({ rescheduled: 0, cleared: 0, paused: 1 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("counts a re-filed request as rescheduled", async () => {
    notifications.scheduleEventReminder.mockResolvedValue("reminder-event-1");

    const result = await rearmImportedReminders([reminderEvent()], NOW);

    expect(result).toEqual({ rescheduled: 1, cleared: 0, paused: 0 });
    expect(notifications.scheduleEventReminder).toHaveBeenCalledWith(
      {
        id: "event-1",
        conventionId: "convention-1",
        title: "Fursuit Parade",
        startTime: "2026-08-27T18:00:00.000Z",
        room: "Main Stage",
      },
      30,
      { requestPermission: false },
    );
  });

  it("clears only a reminder whose moment has already passed", async () => {
    const result = await rearmImportedReminders(
      [
        reminderEvent({
          id: "past",
          startTime: "2026-08-27T11:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(result).toEqual({ rescheduled: 0, cleared: 1, paused: 0 });
    expect(repo.update).toHaveBeenCalledWith("past", {
      reminderMinutes: null,
    });
    expect(notifications.cancelEventReminder).toHaveBeenCalledWith("past");
    expect(notifications.scheduleEventReminder).not.toHaveBeenCalled();
  });

  it("leaves an unparseable startTime alone instead of clearing it", async () => {
    notifications.scheduleEventReminder.mockResolvedValue(null);

    const result = await rearmImportedReminders(
      [reminderEvent({ id: "broken", startTime: "TBA" })],
      NOW,
    );

    expect(result).toEqual({ rescheduled: 0, cleared: 0, paused: 1 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("ignores events that carry no reminder", async () => {
    const result = await rearmImportedReminders(
      [reminderEvent({ reminderMinutes: null })],
      NOW,
    );

    expect(result).toEqual({ rescheduled: 0, cleared: 0, paused: 0 });
    expect(notifications.scheduleEventReminder).not.toHaveBeenCalled();
  });

  it("falls back to the location when the row has no room", async () => {
    notifications.scheduleEventReminder.mockResolvedValue("reminder-event-1");

    await rearmImportedReminders(
      [reminderEvent({ room: null, location: "Convention Center" })],
      NOW,
    );

    expect(notifications.scheduleEventReminder).toHaveBeenCalledWith(
      expect.objectContaining({ room: "Convention Center" }),
      30,
      { requestPermission: false },
    );
  });
});
