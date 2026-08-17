import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";
import { reconcileEventReminders } from "./notifications";

const notificationMocks = vi.hoisted(() => ({
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  setNotificationHandler: vi.fn(),
}));

const eventRepoMocks = vi.hoisted(() => ({
  getAllWithReminders: vi.fn(),
  update: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  ...notificationMocks,
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/db/repositories/events", () => eventRepoMocks);

function reminderEvent(
  overrides: Partial<ConventionEvent> = {},
): ConventionEvent {
  return {
    id: "event-1",
    conventionId: "convention-1",
    title: "Opening",
    description: null,
    startTime: "2026-08-17T13:00:00.000Z",
    endTime: "2026-08-17T14:00:00.000Z",
    location: "Convention Center",
    room: "Main Stage",
    category: null,
    type: null,
    isInSchedule: true,
    reminderMinutes: 15,
    sourceUid: "opening",
    sourceUrl: null,
    isAgeRestricted: false,
    contentWarning: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("startup reminder reconciliation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    vi.clearAllMocks();
    notificationMocks.cancelScheduledNotificationAsync.mockResolvedValue(
      undefined,
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    notificationMocks.scheduleNotificationAsync.mockImplementation(
      async ({ identifier }: { identifier: string }) => identifier,
    );
    eventRepoMocks.getAllWithReminders.mockResolvedValue([]);
    eventRepoMocks.update.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reschedules future reminders and removes stale identifiers without prompting", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "reminder-deleted-event" },
      { identifier: "some-other-notification" },
    ]);

    const result = await reconcileEventReminders();

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-deleted-event");
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "reminder-event-1" }),
    );
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      rescheduled: 1,
      cleared: 0,
      staleCancelled: 1,
    });
  });

  it("clears denied reminders without requesting permission", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    const result = await reconcileEventReminders();

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(eventRepoMocks.update).toHaveBeenCalledWith("event-1", {
      reminderMinutes: null,
    });
    expect(result).toEqual({
      rescheduled: 0,
      cleared: 1,
      staleCancelled: 0,
    });
  });

  it("clears reminders whose trigger time has passed", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([
      reminderEvent({ startTime: "2026-08-17T12:10:00.000Z" }),
    ]);

    const result = await reconcileEventReminders();

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(eventRepoMocks.update).toHaveBeenCalledWith("event-1", {
      reminderMinutes: null,
    });
    expect(result.cleared).toBe(1);
  });
});
