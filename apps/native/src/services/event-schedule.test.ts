import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";

const update = vi.fn(async () => undefined);
const removeDropInVisit = vi.fn(async () => undefined);
const cancelEventReminder = vi.fn(async () => true);
const scheduleEventReminder = vi.fn(
  async (
    _event: unknown,
    _minutes: number,
    _options?: { requestPermission?: boolean },
  ): Promise<string | null> => "reminder-evt",
);
const lockedWork = vi.fn();
const stopTrackingIfAffected = vi.fn(async () => undefined);
const reportError = vi.fn();

vi.mock("@/db/repositories/events", () => ({ update }));
vi.mock("./drop-in-visit", () => ({ removeDropInVisit }));
vi.mock("./notifications", () => ({
  cancelEventReminder,
  scheduleEventReminder,
  withReminderLock: (work: () => Promise<unknown>) => {
    lockedWork();
    return work();
  },
}));
vi.mock("./tracked-event", () => ({ stopTrackingIfAffected }));
vi.mock("@/lib/error-reporting", () => ({ reportError }));

const { removeEventFromPlan, saveEventToPlan, toggleEventInPlan } =
  await import("./event-schedule");

function event(overrides: Partial<ConventionEvent> = {}): ConventionEvent {
  return {
    id: "evt",
    conventionId: "con",
    title: "Panel",
    description: null,
    startTime: "2026-09-04T15:00:00.000Z",
    endTime: "2026-09-04T16:00:00.000Z",
    location: null,
    room: null,
    category: null,
    type: null,
    isInSchedule: false,
    reminderMinutes: null,
    sourceUid: null,
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  scheduleEventReminder.mockResolvedValue("reminder-evt");
});

describe("event plan changes shared by the star and the Watch", () => {
  it("saves without touching reminders or tracking", async () => {
    await saveEventToPlan(event());
    expect(update).toHaveBeenCalledWith("evt", { isInSchedule: true });
    expect(cancelEventReminder).not.toHaveBeenCalled();
    expect(stopTrackingIfAffected).not.toHaveBeenCalled();
  });

  it("unsaves a panel with no reminder and stops tracking it", async () => {
    await removeEventFromPlan(event({ isInSchedule: true }));
    expect(update).toHaveBeenCalledWith("evt", { isInSchedule: false });
    expect(cancelEventReminder).not.toHaveBeenCalled();
    expect(stopTrackingIfAffected).toHaveBeenCalledWith(
      { eventIds: ["evt"] },
      "unsaved",
    );
  });

  it("cancels the reminder before clearing it with the star", async () => {
    await removeEventFromPlan(
      event({ isInSchedule: true, reminderMinutes: 15 }),
    );
    expect(cancelEventReminder).toHaveBeenCalledWith("evt");
    expect(update).toHaveBeenCalledWith("evt", {
      isInSchedule: false,
      reminderMinutes: null,
    });
    expect(cancelEventReminder.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0] ?? 0,
    );
    expect(stopTrackingIfAffected).toHaveBeenCalledTimes(1);
  });

  it("removes a drop-in's visit instead of editing the row itself", async () => {
    const dropIn = event({
      isInSchedule: true,
      visitStartTime: "2026-09-04T15:00:00.000Z",
      visitEndTime: "2026-09-04T15:30:00.000Z",
    });
    await removeEventFromPlan(dropIn);
    expect(removeDropInVisit).toHaveBeenCalledWith(dropIn);
    expect(update).not.toHaveBeenCalled();
    expect(stopTrackingIfAffected).toHaveBeenCalledTimes(1);
  });

  it("reports a tracking failure without failing the change", async () => {
    stopTrackingIfAffected.mockRejectedValueOnce(new Error("storage"));
    await expect(
      removeEventFromPlan(event({ isInSchedule: true })),
    ).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "trackedEvent.unsaved",
    });
  });

  it("toggles from the row's state before the tap", async () => {
    await toggleEventInPlan(event());
    expect(update).toHaveBeenLastCalledWith("evt", { isInSchedule: true });
    await toggleEventInPlan(event({ isInSchedule: true }));
    expect(update).toHaveBeenLastCalledWith("evt", { isInSchedule: false });
  });
});

// The star leaves the reminder to the picker. A Watch tap cannot show one, so
// it passes the Settings default, and the panel gets that reminder when the
// OS takes it: notifications already allowed and the time still ahead.
describe("saving with a default reminder", () => {
  it("arms the reminder without asking for permission, then saves both together", async () => {
    await saveEventToPlan(
      event({ room: null, location: "Hall B", conventionId: "con" }),
      { reminderMinutes: 15 },
    );
    expect(scheduleEventReminder).toHaveBeenCalledWith(
      {
        id: "evt",
        title: "Panel",
        startTime: "2026-09-04T15:00:00.000Z",
        room: "Hall B",
        conventionId: "con",
      },
      15,
      { requestPermission: false },
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("evt", {
      isInSchedule: true,
      reminderMinutes: 15,
    });
    expect(scheduleEventReminder.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0] ?? 0,
    );
    // One step against the reminder reconcile, which would otherwise cancel
    // the new request as stale from a read taken before the row had it.
    expect(lockedWork).toHaveBeenCalledTimes(1);
  });

  it("saves without a reminder when the OS takes none", async () => {
    // Permission not granted, or the reminder time has already passed.
    scheduleEventReminder.mockResolvedValueOnce(null);
    await saveEventToPlan(event(), { reminderMinutes: 15 });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("evt", { isInSchedule: true });
  });

  it("still saves, without a reminder, when arming it throws", async () => {
    scheduleEventReminder.mockRejectedValueOnce(new Error("notifications"));
    await saveEventToPlan(event(), { reminderMinutes: 15 });
    expect(update).toHaveBeenCalledWith("evt", { isInSchedule: true });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "eventSchedule.defaultReminder",
    });
  });

  it("takes the armed reminder back when the row cannot be saved", async () => {
    update.mockRejectedValueOnce(new Error("database is locked"));
    await expect(
      saveEventToPlan(event(), { reminderMinutes: 15 }),
    ).rejects.toThrow("database is locked");
    expect(cancelEventReminder).toHaveBeenCalledWith("evt");
  });

  it("keeps a reminder the row already has instead of the default", async () => {
    await saveEventToPlan(event({ reminderMinutes: 30 }), {
      reminderMinutes: 15,
    });
    expect(scheduleEventReminder).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("evt", { isInSchedule: true });
  });

  it("leaves the star's save alone when there is no default", async () => {
    await saveEventToPlan(event(), { reminderMinutes: null });
    await toggleEventInPlan(event());
    expect(scheduleEventReminder).not.toHaveBeenCalled();
    expect(lockedWork).not.toHaveBeenCalled();
    expect(update.mock.calls).toEqual([
      ["evt", { isInSchedule: true }],
      ["evt", { isInSchedule: true }],
    ]);
  });
});
