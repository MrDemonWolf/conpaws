import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";

const update = vi.fn(async () => undefined);
const removeDropInVisit = vi.fn(async () => undefined);
const cancelEventReminder = vi.fn(async () => true);
const stopTrackingIfAffected = vi.fn(async () => undefined);
const reportError = vi.fn();

vi.mock("@/db/repositories/events", () => ({ update }));
vi.mock("./drop-in-visit", () => ({ removeDropInVisit }));
vi.mock("./notifications", () => ({
  cancelEventReminder,
  withReminderLock: (work: () => Promise<unknown>) => work(),
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

beforeEach(() => vi.clearAllMocks());

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
