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
  };
});

vi.mock("expo-notifications", () => ({
  cancelScheduledNotificationAsync: async (identifier: string) => {
    await native.tick();
    native.pending.delete(identifier);
  },
  getAllScheduledNotificationsAsync: async () => {
    await native.tick();
    return [...native.pending].map((identifier) => ({ identifier }));
  },
  getPermissionsAsync: async () => {
    await native.tick();
    return { status: "granted" };
  },
  requestPermissionsAsync: async () => ({ status: "granted" }),
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

const { removeEventFromPlan } = await import("./event-schedule");
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
