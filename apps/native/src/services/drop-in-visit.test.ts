import { beforeEach, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";
import { removeDropInVisit, saveDropInVisit } from "./drop-in-visit";

const { update, schedule, cancel, getById } = vi.hoisted(() => ({
  update: vi.fn(),
  getById: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/db/repositories/events", () => ({ update, getById }));
vi.mock("./notifications", () => ({
  scheduleEventReminder: schedule,
  cancelEventReminder: cancel,
}));
const event = {
  id: "market",
  startTime: "2027-01-01T10:00:00Z",
  endTime: "2027-01-01T18:00:00Z",
  isInSchedule: false,
  reminderMinutes: null,
  feedStatus: null,
} as ConventionEvent;
const draft = { date: "2027-01-01", time: "12:00", durationMinutes: 30 };
beforeEach(() => {
  update.mockReset().mockResolvedValue(undefined);
  getById.mockReset().mockResolvedValue(event);
  schedule.mockReset().mockResolvedValue("armed");
  cancel.mockReset().mockResolvedValue(true);
});
it("persists visit times separately and arms its reminder", async () => {
  await saveDropInVisit(event, draft, "UTC", 15);
  expect(update).toHaveBeenCalledWith("market", {
    visitStartTime: "2027-01-01T12:00:00.000Z",
    visitEndTime: "2027-01-01T12:30:00.000Z",
    isInSchedule: true,
    reminderMinutes: 15,
  });
  expect(schedule).toHaveBeenCalledWith(
    expect.objectContaining({ startTime: "2027-01-01T12:00:00.000Z" }),
    15,
  );
});
it("does not save when a reminder cannot be armed", async () => {
  schedule.mockResolvedValue(null);
  await expect(saveDropInVisit(event, draft, "UTC", 15)).rejects.toThrow(
    "reminder-unavailable",
  );
  expect(update).not.toHaveBeenCalled();
});
it("restores the previous reminder when persistence fails", async () => {
  const existing = {
    ...event,
    isInSchedule: true,
    reminderMinutes: 5,
    visitStartTime: "2027-01-01T11:00:00Z",
    visitEndTime: "2027-01-01T11:30:00Z",
  };
  getById.mockResolvedValue(existing);
  update.mockRejectedValue(new Error("disk full"));
  await expect(saveDropInVisit(existing, draft, "UTC", 15)).rejects.toThrow(
    "disk full",
  );
  expect(schedule).toHaveBeenLastCalledWith(
    expect.objectContaining({ startTime: existing.visitStartTime }),
    5,
    { requestPermission: false },
  );
});
it("removes only the personal visit and refuses uncancelled reminders", async () => {
  await removeDropInVisit(event);
  expect(update).toHaveBeenCalledWith("market", {
    visitStartTime: null,
    visitEndTime: null,
    isInSchedule: false,
    reminderMinutes: null,
  });
  update.mockClear();
  cancel.mockResolvedValue(false);
  await expect(removeDropInVisit(event)).rejects.toThrow("cancel-failed");
  expect(update).not.toHaveBeenCalled();
});

it("rejects a visit when opening hours change during the permission prompt", async () => {
  getById.mockResolvedValue({ ...event, startTime: "2027-01-01T14:00:00Z" });
  await expect(saveDropInVisit(event, draft, "UTC", 15)).rejects.toThrow(
    "invalid-visit",
  );
  expect(update).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledWith(event.id);
  expect(schedule).toHaveBeenCalledTimes(1);
});
