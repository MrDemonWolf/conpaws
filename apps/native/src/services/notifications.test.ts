import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";
import {
  cancelConventionReminders,
  cancelTestNotifications,
  getNotificationPermissionStatus,
  reconcileEventReminders,
  requestNotificationPermission,
  scheduleEventReminder,
  scheduleTestNotification,
  withReminderLock,
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
  clearPassedReminder: vi.fn(),
}));
const conventionRepoMocks = vi.hoisted(() => ({ getAll: vi.fn() }));
const i18nMock = vi.hoisted(() => ({
  isInitialized: false,
  t: vi.fn(),
}));

vi.mock("expo-notifications", () => ({
  ...notificationMocks,
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: {
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/db/repositories/events", () => eventRepoMocks);
vi.mock("@/db/repositories/conventions", () => conventionRepoMocks);
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
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
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
    conventionRepoMocks.getAll.mockResolvedValue([]);
    eventRepoMocks.update.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules personal visit reminders and suppresses changed hours or legacy drop-ins", async () => {
    const visit = reminderEvent({
      startTime: "2026-08-17T13:00:00Z",
      endTime: "2026-08-17T21:00:00Z",
      visitStartTime: "2026-08-17T16:00:00Z",
      visitEndTime: "2026-08-17T16:30:00Z",
    });
    await scheduleEventReminder(visit, 15);
    expect(
      notificationMocks.scheduleNotificationAsync,
    ).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          date: new Date("2026-08-17T15:45:00Z"),
        }),
      }),
    );
    notificationMocks.scheduleNotificationAsync.mockClear();
    const invalid = { ...visit, endTime: "2026-08-17T15:00:00Z" };
    expect(await scheduleEventReminder(invalid, 15)).toBeNull();
    eventRepoMocks.getAllWithReminders.mockResolvedValue([
      invalid,
      { ...visit, visitStartTime: null, visitEndTime: null, id: "legacy" },
    ]);
    await reconcileEventReminders();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-legacy");
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
          title: "Reminder for Opening",
          body: "Starts in 15 min · Main Stage",
        }),
      }),
    );
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      rescheduled: 1,
      cleared: 0,
      paused: 0,
      overflow: 0,
      staleCancelled: 1,
    });
  });

  it.each([3, 4])(
    "re-arms reminders with iOS authorization %s",
    async (status) => {
      eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
      notificationMocks.getPermissionsAsync.mockResolvedValue({
        status: "undetermined",
        ios: { status },
      });

      const result = await reconcileEventReminders();

      expect(result.rescheduled).toBe(1);
      expect(result.paused).toBe(0);
      expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(eventRepoMocks.update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["cancelled feed event", reminderEvent({ feedStatus: "cancelled" })],
    ["removed feed event", reminderEvent({ feedStatus: "removed" })],
  ])("does not re-arm a %s", async (_label, row) => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([row]);
    const result = await reconcileEventReminders();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(result.cleared).toBe(0);
  });

  it("cancels archived convention reminders without clearing saved choices", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
    conventionRepoMocks.getAll.mockResolvedValue([
      { id: "convention-1", archivedAt: "2026-08-01" },
    ]);
    await reconcileEventReminders();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
  });

  it("keeps the saved choice when permission is missing and re-arms it later", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "denied",
    });

    const denied = await reconcileEventReminders();

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(
      notificationMocks.cancelScheduledNotificationAsync,
    ).toHaveBeenCalledWith("reminder-event-1");
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(denied).toEqual({
      rescheduled: 0,
      cleared: 0,
      paused: 1,
      overflow: 0,
      staleCancelled: 0,
    });

    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    const granted = await reconcileEventReminders();

    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: "reminder-event-1" }),
    );
    expect(granted.rescheduled).toBe(1);
    expect(granted.paused).toBe(0);
  });

  it("keeps the saved choice when the OS rejects the request", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);
    notificationMocks.scheduleNotificationAsync.mockRejectedValue(
      new Error("notification store unavailable"),
    );

    const result = await reconcileEventReminders();

    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(result.paused).toBe(1);
    expect(result.rescheduled).toBe(0);
    expect(result.cleared).toBe(0);
  });

  it("schedules the nearest reminders first and reports the rest as overflow", async () => {
    const events = Array.from({ length: 62 }, (_, index) =>
      reminderEvent({
        id: `event-${index}`,
        // Descending start times, so database order is the reverse of the
        // order the reminders actually fire in.
        startTime: new Date(
          Date.parse("2026-08-17T13:00:00.000Z") + (62 - index) * 3_600_000,
        ).toISOString(),
      }),
    );
    eventRepoMocks.getAllWithReminders.mockResolvedValue(events);

    const result = await reconcileEventReminders();

    expect(result.rescheduled).toBe(60);
    expect(result.overflow).toBe(2);
    expect(eventRepoMocks.update).not.toHaveBeenCalled();

    const scheduledIds =
      notificationMocks.scheduleNotificationAsync.mock.calls.map(
        ([request]) => request.identifier,
      );
    expect(scheduledIds[0]).toBe("reminder-event-61");
    expect(scheduledIds).not.toContain("reminder-event-0");
    expect(scheduledIds).not.toContain("reminder-event-1");
  });

  it("clears reminders whose trigger time has passed", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([
      reminderEvent({ startTime: "2026-08-17T12:10:00.000Z" }),
    ]);

    const result = await reconcileEventReminders();

    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMocks.scheduleNotificationAsync).not.toHaveBeenCalled();
    // Housekeeping, so the row's updatedAt still says when the user last
    // changed it; a Watch tap is compared against that.
    expect(eventRepoMocks.clearPassedReminder).toHaveBeenCalledWith("event-1");
    expect(eventRepoMocks.update).not.toHaveBeenCalled();
    expect(result.cleared).toBe(1);
  });

  it("carries the event and convention on the reminder payload", async () => {
    eventRepoMocks.getAllWithReminders.mockResolvedValue([reminderEvent()]);

    await reconcileEventReminders();

    expect(notificationMocks.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: {
            kind: "event-reminder",
            eventId: "event-1",
            conventionId: "convention-1",
          },
        }),
      }),
    );
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

describe("withReminderLock", () => {
  it("runs reminder work one at a time and carries on after a failure", async () => {
    const steps: string[] = [];
    let releaseFirst!: () => void;
    const first = withReminderLock(async () => {
      steps.push("first:start");
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      steps.push("first:end");
      throw new Error("native call failed");
    });
    const second = withReminderLock(async () => {
      steps.push("second");
      return "done";
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(steps).toEqual(["first:start"]);

    releaseFirst();
    await expect(first).rejects.toThrow("native call failed");
    await expect(second).resolves.toBe("done");
    expect(steps).toEqual(["first:start", "first:end", "second"]);
  });
});

describe("getNotificationPermissionStatus", () => {
  it.each([
    [0, "undetermined"],
    [1, "denied"],
    [2, "granted"],
    [3, "granted"],
    [4, "granted"],
  ])("interprets iOS authorization %s as %s", async (status, expected) => {
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      canAskAgain: true,
      ios: { status },
    });
    await expect(getNotificationPermissionStatus()).resolves.toBe(expected);
  });

  it("does not prompt again when iOS already permits quiet delivery", async () => {
    notificationMocks.requestPermissionsAsync.mockClear();
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      ios: { status: 3 },
    });

    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(notificationMocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("interprets iOS authorization returned by the permission request", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      ios: { status: 0 },
    });
    notificationMocks.requestPermissionsAsync.mockResolvedValue({
      status: "undetermined",
      ios: { status: 3 },
    });

    await expect(requestNotificationPermission()).resolves.toBe("granted");
  });

  it("reads Android's pre-prompt denied state as undetermined", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "denied",
      canAskAgain: true,
    });
    await expect(getNotificationPermissionStatus()).resolves.toBe(
      "undetermined",
    );
  });

  it("keeps a real refusal as denied", async () => {
    notificationMocks.getPermissionsAsync.mockResolvedValue({
      status: "denied",
      canAskAgain: false,
    });
    await expect(getNotificationPermissionStatus()).resolves.toBe("denied");
  });
});
