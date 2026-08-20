import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";
import {
  cancelConventionReminders,
  cancelTestNotifications,
  reconcileEventReminders,
  scheduleTestNotification,
} from "./notifications";

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
const i18nMock = vi.hoisted(() => ({
  isInitialized: false,
  t: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  ...notificationMocks,
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: {
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/db/repositories/events", () => eventRepoMocks);
vi.mock("i18next", () => ({ default: i18nMock }));

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
    i18nMock.isInitialized = false;
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
      expect.objectContaining({
        identifier: "reminder-event-1",
        content: expect.objectContaining({
          title: "Time to leave for Opening",
          body: "Starts in 15 min · Main Stage",
        }),
      }),
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

  it("uses the active app language when a reminder is rebuilt", async () => {
    i18nMock.isInitialized = true;
    i18nMock.t.mockImplementation((key: string) =>
      key === "reminders.notificationTitle"
        ? "Hora de salir para Opening"
        : "Empieza en 15 min · Main Stage",
    );
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);

    await reconcileEventReminders();

    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: "Hora de salir para Opening",
          body: "Empieza en 15 min · Main Stage",
        }),
      }),
    );
  });
});

describe("developer test notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    notificationMocks.scheduleNotificationAsync.mockImplementation(
      async ({ identifier }: { identifier: string }) => identifier,
    );
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    notificationMocks.cancelScheduledNotificationAsync.mockResolvedValue(
      undefined,
    );
  });

  it("schedules a five-second local notification with a dedicated identifier", async () => {
    const identifier = await scheduleTestNotification();

    expect(identifier).toMatch(/^developer-test-/);
    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier,
        trigger: {
          type: "timeInterval",
          seconds: 5,
          channelId: "event-reminders",
        },
      }),
    );
  });

  it("only clears pending developer test notifications", async () => {
    notificationMocks.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "developer-test-1" },
      { identifier: "reminder-event-1" },
      { identifier: "developer-test-2" },
    ]);

    await expect(cancelTestNotifications()).resolves.toBe(2);
    expect(
      notificationMocks.cancelScheduledNotificationAsync.mock.calls.map(
        ([identifier]) => identifier,
      ),
    ).toEqual(["developer-test-1", "developer-test-2"]);
  });
});

describe("convention reminder cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a partial failure without rejecting cleanup", async () => {
    notificationMocks.cancelScheduledNotificationAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("notification store unavailable"));

    await expect(
      cancelConventionReminders(["event-1", "event-2"]),
    ).resolves.toBe(false);
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-2");
  });
});
