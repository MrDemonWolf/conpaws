import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";

/**
 * The launch and foreground reminder reconcile runs alongside the Watch
 * command drain, and both touch the same OS reminder. These run the real
 * reconcile against the real remove, with every native call taking a tick
 * as it does over the bridge, so their steps interleave the way they do on a
 * phone that wakes up with a Watch tap queued.
 */

const native = vi.hoisted(() => {
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return {
    tick,
    pending: new Set<string>(),
    row: null as ConventionEvent | null,
    permission: "granted",
    permissionRequests: 0,
    /** While set, the OS's list of pending requests waits for it. */
    scheduledListGate: null as Promise<void> | null,
  };
});

vi.mock("expo-notifications", () => ({
  cancelScheduledNotificationAsync: async (identifier: string) => {
    await native.tick();
    native.pending.delete(identifier);
  },
  getAllScheduledNotificationsAsync: async () => {
    await native.tick();
    if (native.scheduledListGate) await native.scheduledListGate;
    return [...native.pending].map((identifier) => ({ identifier }));
  },
  getPermissionsAsync: async () => {
    await native.tick();
    return { status: native.permission, canAskAgain: true };
  },
  requestPermissionsAsync: async () => {
    native.permissionRequests += 1;
    return { status: "granted" };
  },
  scheduleNotificationAsync: async ({ identifier }: { identifier: string }) => {
    await native.tick();
    native.pending.add(identifier);
    return identifier;
  },
  setNotificationChannelAsync: async () => undefined,
  setNotificationHandler: () => undefined,
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
vi.mock("i18next", () => ({
  default: { isInitialized: false, t: (key: string) => key },
}));
// One stateful row, read through the same calls the app's SQLite makes.
vi.mock("@/db/repositories/events", () => ({
  getAllWithReminders: async () =>
    native.row && native.row.reminderMinutes !== null
      ? [{ ...native.row }]
      : [],
  getById: async (id: string) =>
    native.row?.id === id ? { ...native.row } : undefined,
  update: async (id: string, patch: Partial<ConventionEvent>) => {
    if (native.row?.id === id) native.row = { ...native.row, ...patch };
  },
  clearPassedReminder: async (id: string) => {
    if (native.row?.id === id)
      native.row = { ...native.row, reminderMinutes: null };
  },
}));
vi.mock("@/db/repositories/conventions", () => ({ getAll: async () => [] }));
vi.mock("./tracked-event", () => ({
  stopTrackingIfAffected: async () => undefined,
}));
vi.mock("@/lib/error-reporting", () => ({ reportError: () => undefined }));

const { removeEventFromPlan, saveEventToPlan } = await import(
  "./event-schedule"
);
const { reconcileEventReminders } = await import("./notifications");

const MINUTE = 60_000;

function savedRow(overrides: Partial<ConventionEvent> = {}): ConventionEvent {
  const now = Date.now();
  return {
    id: "event-1",
    conventionId: "convention-1",
    title: "Opening",
    description: null,
    startTime: new Date(now + 60 * MINUTE).toISOString(),
    endTime: new Date(now + 120 * MINUTE).toISOString(),
    location: null,
    room: "Main Stage",
    category: null,
    type: null,
    isInSchedule: true,
    reminderMinutes: 15,
    sourceUid: null,
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

function dropInVisitRow(): ConventionEvent {
  const now = Date.now();
  return savedRow({
    title: "Dealers' Den",
    startTime: new Date(now - 60 * MINUTE).toISOString(),
    endTime: new Date(now + 8 * 60 * MINUTE).toISOString(),
    visitStartTime: new Date(now + 60 * MINUTE).toISOString(),
    visitEndTime: new Date(now + 90 * MINUTE).toISOString(),
  });
}

beforeEach(() => {
  native.pending.clear();
  native.row = null;
  native.permission = "granted";
  native.permissionRequests = 0;
  native.scheduledListGate = null;
});

describe.each([
  ["a panel", () => savedRow()],
  ["a drop-in visit", dropInVisitRow],
])("removing %s while reminders reconcile", (_kind, makeRow) => {
  beforeEach(() => {
    native.row = makeRow();
    // The reminder the user set on the phone before tapping Remove.
    native.pending.add("reminder-event-1");
  });

  it("leaves no reminder armed when the reconcile started first", async () => {
    // Launch order: the reconcile effect fires, then the Watch drain reads
    // the row and applies the queued Remove.
    const reconciling = reconcileEventReminders();
    const removing = removeEventFromPlan({
      ...(native.row as ConventionEvent),
    });
    await Promise.all([reconciling, removing]);

    expect(native.row).toMatchObject({
      isInSchedule: false,
      reminderMinutes: null,
    });
    expect(native.pending.has("reminder-event-1")).toBe(false);
  });

  it("leaves no reminder armed when the remove started first", async () => {
    const removing = removeEventFromPlan({
      ...(native.row as ConventionEvent),
    });
    const reconciling = reconcileEventReminders();
    await Promise.all([reconciling, removing]);

    expect(native.row).toMatchObject({
      isInSchedule: false,
      reminderMinutes: null,
    });
    expect(native.pending.has("reminder-event-1")).toBe(false);
  });
});

describe("a Watch save with the default reminder", () => {
  /** An unsaved panel an hour away, as a Watch tap finds it. */
  function unsavedRow(overrides: Partial<ConventionEvent> = {}) {
    return savedRow({
      isInSchedule: false,
      reminderMinutes: null,
      ...overrides,
    });
  }

  it("arms the reminder and records it when notifications are allowed", async () => {
    native.row = unsavedRow();
    await saveEventToPlan({ ...native.row }, { reminderMinutes: 15 });
    expect(native.row).toMatchObject({
      isInSchedule: true,
      reminderMinutes: 15,
    });
    expect(native.pending.has("reminder-event-1")).toBe(true);
    expect(native.permissionRequests).toBe(0);
  });

  it.each(["undetermined", "denied"])(
    "saves without a reminder, and never asks, when permission is %s",
    async (permission) => {
      native.permission = permission;
      native.row = unsavedRow();
      await saveEventToPlan({ ...native.row }, { reminderMinutes: 15 });
      expect(native.row).toMatchObject({
        isInSchedule: true,
        reminderMinutes: null,
      });
      expect(native.pending.size).toBe(0);
      expect(native.permissionRequests).toBe(0);
    },
  );

  it("saves without a reminder when its time has already passed", async () => {
    // Starts in ten minutes, so a reminder 15 minutes before is gone.
    native.row = unsavedRow({
      startTime: new Date(Date.now() + 10 * MINUTE).toISOString(),
    });
    await saveEventToPlan({ ...native.row }, { reminderMinutes: 15 });
    expect(native.row).toMatchObject({
      isInSchedule: true,
      reminderMinutes: null,
    });
    expect(native.pending.size).toBe(0);
  });

  /**
   * The reconcile's list of OS requests comes back late, as over a busy
   * bridge: it read the rows before the save recorded its reminder, so
   * unlocked it would find the new request in that list and cancel it as
   * stale, leaving a row that promises a reminder the OS no longer holds.
   */
  async function raceTheReconcile(order: "reconcile first" | "save first") {
    native.row = unsavedRow();
    const event = { ...native.row };
    let release: () => void = () => undefined;
    native.scheduledListGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = () => saveEventToPlan(event, { reminderMinutes: 15 });
    // Array elements start left to right, so this is the order they begin.
    const running =
      order === "reconcile first"
        ? [reconcileEventReminders(), save()]
        : [save(), reconcileEventReminders()];
    // Room for every native step of the save to land if nothing holds it.
    for (let step = 0; step < 10; step += 1) await native.tick();
    release();
    await Promise.all(running);
  }

  it("keeps the reminder armed when the reconcile started first", async () => {
    await raceTheReconcile("reconcile first");
    expect(native.row).toMatchObject({
      isInSchedule: true,
      reminderMinutes: 15,
    });
    expect(native.pending.has("reminder-event-1")).toBe(true);
  });

  it("keeps the reminder armed when the save started first", async () => {
    await raceTheReconcile("save first");
    expect(native.row).toMatchObject({
      isInSchedule: true,
      reminderMinutes: 15,
    });
    expect(native.pending.has("reminder-event-1")).toBe(true);
  });
});
