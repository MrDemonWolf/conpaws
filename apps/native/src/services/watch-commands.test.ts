import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConventionEvent } from "@/db/schema";

const rows = new Map<string, ConventionEvent>();
const getById = vi.fn(async (id: string) => rows.get(id));
const saveEventToPlan = vi.fn(
  async (
    event: ConventionEvent,
    options: { reminderMinutes?: number | null } = {},
  ) => {
    rows.set(event.id, {
      ...event,
      isInSchedule: true,
      reminderMinutes: options.reminderMinutes ?? event.reminderMinutes,
      updatedAt: new Date(clock).toISOString(),
    });
  },
);
const getDefaultReminderMinutes = vi.fn(
  async (): Promise<number | null> => null,
);
const archivedConventionIds = new Set<string>();
const getConventionById = vi.fn(async (id: string) => ({
  id,
  archivedAt: archivedConventionIds.has(id) ? "2026-09-01T00:00:00.000Z" : null,
}));
const removeEventFromPlan = vi.fn(async (event: ConventionEvent) => {
  rows.set(event.id, {
    ...event,
    isInSchedule: false,
    reminderMinutes: null,
    updatedAt: new Date(clock).toISOString(),
  });
});
const publishWidgetSnapshot = vi.fn(async () => true);
const reportError = vi.fn();
const peekWatchCommands = vi.fn((): unknown => []);
const acknowledgeWatchCommands = vi.fn((_ids: string[]) => undefined);
const listeners = new Map<string, () => void>();
const removeListener = vi.fn();
const appStateListeners: Array<(state: string) => void> = [];
const removeAppState = vi.fn();

vi.mock("expo", () => ({
  requireOptionalNativeModule: () => ({
    peekWatchCommands,
    acknowledgeWatchCommands,
    addListener: (name: string, listener: () => void) => {
      listeners.set(name, listener);
      return { remove: removeListener };
    },
  }),
}));
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_type: string, listener: (state: string) => void) => {
      appStateListeners.push(listener);
      return { remove: removeAppState };
    },
  },
}));
vi.mock("@/db/repositories/events", () => ({ getById }));
vi.mock("@/db/repositories/conventions", () => ({
  getById: getConventionById,
}));
vi.mock("@/lib/reminder-default-storage", () => ({
  getDefaultReminderMinutes,
}));
vi.mock("./event-schedule", () => ({ saveEventToPlan, removeEventFromPlan }));
vi.mock("./widget-snapshot", () => ({ publishWidgetSnapshot }));
vi.mock("@/lib/error-reporting", () => ({ reportError }));

const {
  applyWatchCommands,
  drainWatchCommands,
  initWatchCommands,
  parseWatchCommand,
  rowUpdatedAtMs,
  WATCH_COMMAND_MAX_AGE_MS,
  WATCH_COMMAND_MAX_ATTEMPTS,
} = await import("./watch-commands");
const {
  handledWatchCommandIds,
  recordHandledWatchCommands,
  resetHandledWatchCommands,
  WATCH_HANDLED_COMMANDS_LIMIT,
} = await import("./watch-command-receipts");

const NOW = Date.parse("2026-09-04T15:00:00Z");
let clock = NOW;
const BEFORE = new Date(NOW - 60 * 60_000).toISOString();

function row(
  id: string,
  overrides: Partial<ConventionEvent> = {},
): ConventionEvent {
  const event: ConventionEvent = {
    id,
    conventionId: "con-1",
    title: id,
    description: null,
    startTime: new Date(NOW + 30 * 60_000).toISOString(),
    endTime: new Date(NOW + 90 * 60_000).toISOString(),
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
    createdAt: BEFORE,
    updatedAt: BEFORE,
    ...overrides,
  };
  rows.set(id, event);
  return event;
}

let sequence = 0;
function command(
  action: "save" | "remove",
  eventId: string,
  overrides: Record<string, unknown> = {},
): string {
  sequence += 1;
  return JSON.stringify({
    id: `cmd-${sequence}`,
    action,
    conventionId: "con-1",
    eventId,
    sentAtMs: NOW - 60_000,
    ...overrides,
  });
}

beforeEach(() => {
  rows.clear();
  clock = NOW;
  vi.clearAllMocks();
  resetHandledWatchCommands();
  peekWatchCommands.mockReset().mockReturnValue([]);
  getDefaultReminderMinutes.mockReset().mockResolvedValue(null);
  archivedConventionIds.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseWatchCommand", () => {
  const valid = {
    id: "A1B2",
    action: "save",
    conventionId: "con-1",
    eventId: "evt-1",
    sentAtMs: NOW,
  };

  it("reads the Watch's JSON string", () => {
    expect(parseWatchCommand(JSON.stringify(valid))).toEqual(valid);
    expect(parseWatchCommand({ ...valid, action: "remove", extra: 1 })).toEqual(
      { ...valid, action: "remove" },
    );
  });

  it.each([
    ["not JSON", "{"],
    ["an array", "[]"],
    ["null", "null"],
    ["an unknown action", { ...valid, action: "toggle" }],
    ["an empty id", { ...valid, id: "  " }],
    ["a missing event id", { ...valid, eventId: undefined }],
    ["a numeric convention id", { ...valid, conventionId: 7 }],
    ["an id of 256 characters", { ...valid, eventId: "e".repeat(256) }],
    ["a string time", { ...valid, sentAtMs: "1700000000000" }],
    ["a non-finite time", { ...valid, sentAtMs: Number.NaN }],
  ])("rejects %s", (_label, raw) => {
    expect(parseWatchCommand(raw)).toBeNull();
  });

  it("accepts an id of 255 characters", () => {
    expect(
      parseWatchCommand({ ...valid, eventId: "e".repeat(255) }),
    ).not.toBeNull();
  });
});

describe("rowUpdatedAtMs", () => {
  it("reads both timestamp shapes as UTC", () => {
    expect(rowUpdatedAtMs("2026-09-04T15:00:00.000Z")).toBe(NOW);
    expect(rowUpdatedAtMs("2026-09-04 15:00:00")).toBe(NOW);
    expect(rowUpdatedAtMs("garbage")).toBeNaN();
    expect(rowUpdatedAtMs(null)).toBeNaN();
  });
});

describe("applyWatchCommands", () => {
  it("saves an unsaved panel without a reminder when Settings has no default", async () => {
    const event = row("panel");
    const result = await applyWatchCommands([command("save", "panel")], NOW);
    expect(saveEventToPlan).toHaveBeenCalledWith(event, {
      reminderMinutes: null,
    });
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual(["applied"]);
    expect(result.changedConventionIds).toEqual(["con-1"]);
  });

  // The star leaves the reminder to the picker, which suggests the Settings
  // default. A wrist tap cannot show that picker, so it gets the default.
  it("gives a panel saved from the wrist the Settings default reminder", async () => {
    getDefaultReminderMinutes.mockResolvedValue(15);
    const event = row("panel");
    await applyWatchCommands([command("save", "panel")], NOW);
    expect(getDefaultReminderMinutes).toHaveBeenCalled();
    expect(saveEventToPlan).toHaveBeenCalledWith(event, {
      reminderMinutes: 15,
    });
  });

  it("gives an archived convention's panel no reminder", async () => {
    // Archive keeps reminders off until the convention comes back.
    getDefaultReminderMinutes.mockResolvedValue(15);
    archivedConventionIds.add("con-1");
    const event = row("panel");
    await applyWatchCommands([command("save", "panel")], NOW);
    expect(saveEventToPlan).toHaveBeenCalledWith(event, {
      reminderMinutes: null,
    });
  });

  it("still saves, without a reminder, when the default cannot be read", async () => {
    getDefaultReminderMinutes.mockRejectedValue(new Error("storage"));
    const event = row("panel");
    const result = await applyWatchCommands([command("save", "panel")], NOW);
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual(["applied"]);
    expect(saveEventToPlan).toHaveBeenCalledWith(event, {
      reminderMinutes: null,
    });
  });

  it("still saves, without a reminder, when the convention cannot be read", async () => {
    getDefaultReminderMinutes.mockResolvedValue(15);
    getConventionById.mockRejectedValueOnce(new Error("database is locked"));
    const event = row("panel");
    const result = await applyWatchCommands([command("save", "panel")], NOW);
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual(["applied"]);
    expect(saveEventToPlan).toHaveBeenCalledWith(event, {
      reminderMinutes: null,
    });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "watchCommands.defaultReminder",
    });
  });

  it("reads no default for a remove or a declined save", async () => {
    getDefaultReminderMinutes.mockResolvedValue(15);
    row("saved", { isInSchedule: true });
    row("cancelled", { feedStatus: "cancelled" });
    await applyWatchCommands(
      [command("remove", "saved"), command("save", "cancelled")],
      NOW,
    );
    expect(getDefaultReminderMinutes).not.toHaveBeenCalled();
  });

  it("removes a saved panel the way the phone's star does", async () => {
    const event = row("panel", { isInSchedule: true, reminderMinutes: 15 });
    const result = await applyWatchCommands([command("remove", "panel")], NOW);
    expect(removeEventFromPlan).toHaveBeenCalledWith(event);
    expect(result.changedConventionIds).toEqual(["con-1"]);
  });

  it("removes a drop-in with a visit through the same path", async () => {
    const event = row("dealers", {
      isInSchedule: true,
      startTime: new Date(NOW - 60 * 60_000).toISOString(),
      endTime: new Date(NOW + 7 * 60 * 60_000).toISOString(),
      visitStartTime: new Date(NOW).toISOString(),
      visitEndTime: new Date(NOW + 30 * 60_000).toISOString(),
    });
    await applyWatchCommands([command("remove", "dealers")], NOW);
    expect(removeEventFromPlan).toHaveBeenCalledWith(event);
  });

  it("is idempotent: saving a saved panel or removing an unsaved one does nothing", async () => {
    row("saved", { isInSchedule: true });
    row("unsaved");
    const result = await applyWatchCommands(
      [command("save", "saved"), command("remove", "unsaved")],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "unchanged",
      "unchanged",
    ]);
    expect(saveEventToPlan).not.toHaveBeenCalled();
    expect(removeEventFromPlan).not.toHaveBeenCalled();
    expect(result.changedConventionIds).toEqual([]);
  });

  it("applies a delivered-twice command once", async () => {
    row("panel");
    const once = command("save", "panel");
    const result = await applyWatchCommands([once, once], NOW);
    expect(result.outcomes).toHaveLength(1);
    expect(saveEventToPlan).toHaveBeenCalledTimes(1);

    // The copy that arrives in a later batch, after the save landed, reads
    // as older than the row it already changed.
    const again = await applyWatchCommands([once], NOW + 5_000);
    expect(again.outcomes.map((entry) => entry.outcome)).toEqual([
      "superseded",
    ]);
    expect(saveEventToPlan).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed commands and still applies the rest", async () => {
    row("panel");
    const result = await applyWatchCommands(
      ["{", 42, null, command("save", "panel", { action: "star" })],
      NOW,
    );
    expect(result.outcomes).toEqual([]);
    const next = await applyWatchCommands(["{", command("save", "panel")], NOW);
    expect(next.outcomes.map((entry) => entry.outcome)).toEqual(["applied"]);
  });

  it("ignores commands older than a day", async () => {
    row("panel");
    const result = await applyWatchCommands(
      [
        command("save", "panel", {
          sentAtMs: NOW - WATCH_COMMAND_MAX_AGE_MS - 1,
        }),
      ],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual(["expired"]);
    expect(saveEventToPlan).not.toHaveBeenCalled();
  });

  it("ignores events that are gone or now belong to another convention", async () => {
    row("moved", { conventionId: "con-2" });
    const result = await applyWatchCommands(
      [command("save", "gone"), command("save", "moved")],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "missing",
      "missing",
    ]);
  });

  it("lets a change made on the phone after the Watch tap win", async () => {
    row("panel", {
      isInSchedule: true,
      updatedAt: new Date(NOW - 30_000).toISOString(),
    });
    const result = await applyWatchCommands(
      [command("remove", "panel", { sentAtMs: NOW - 60_000 })],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "superseded",
    ]);
    expect(removeEventFromPlan).not.toHaveBeenCalled();
  });

  it("reads SQLite's default timestamp when deciding who wins", async () => {
    row("panel", { updatedAt: "2026-09-04 14:59:30" });
    const result = await applyWatchCommands(
      [command("save", "panel", { sentAtMs: NOW - 60_000 })],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "superseded",
    ]);
  });

  it("never saves a drop-in or a cancelled or changed panel", async () => {
    row("dealers", {
      startTime: new Date(NOW - 60 * 60_000).toISOString(),
      endTime: new Date(NOW + 7 * 60 * 60_000).toISOString(),
    });
    row("cancelled", { feedStatus: "cancelled" });
    row("removed", { feedStatus: "removed" });
    const result = await applyWatchCommands(
      [
        command("save", "dealers"),
        command("save", "cancelled"),
        command("save", "removed"),
      ],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "not-allowed",
      "not-allowed",
      "not-allowed",
    ]);
    expect(saveEventToPlan).not.toHaveBeenCalled();
  });

  it("applies in the order the Watch sent, not the order received", async () => {
    row("panel");
    const result = await applyWatchCommands(
      [
        command("remove", "panel", { sentAtMs: NOW - 10_000 }),
        command("save", "panel", { sentAtMs: NOW - 20_000 }),
      ],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "applied",
      "applied",
    ]);
    expect(result.outcomes.map((entry) => entry.command.action)).toEqual([
      "save",
      "remove",
    ]);
    expect(saveEventToPlan.mock.invocationCallOrder[0]).toBeLessThan(
      removeEventFromPlan.mock.invocationCallOrder[0] ?? 0,
    );
    expect(rows.get("panel")?.isInSchedule).toBe(false);
  });

  it("reports a failed command and carries on with the batch", async () => {
    row("first");
    row("second");
    saveEventToPlan.mockRejectedValueOnce(new Error("database is locked"));
    const result = await applyWatchCommands(
      [command("save", "first"), command("save", "second")],
      NOW,
    );
    expect(result.outcomes.map((entry) => entry.outcome)).toEqual([
      "failed",
      "applied",
    ]);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      scope: "watchCommands.apply",
    });
  });
});

// These run on the real clock, as the app does.
describe("initWatchCommands", () => {
  it("does nothing off iOS", () => {
    vi.stubEnv("EXPO_OS", "android");
    const cleanup = initWatchCommands({ refreshCaches: vi.fn() });
    expect(peekWatchCommands).not.toHaveBeenCalled();
    cleanup();
  });

  it("drains at start, on the native event and on becoming active", async () => {
    vi.stubEnv("EXPO_OS", "ios");
    row("panel");
    const refreshCaches = vi.fn(async () => undefined);
    peekWatchCommands.mockReturnValueOnce([
      command("save", "panel", { sentAtMs: Date.now() }),
    ]);
    const cleanup = initWatchCommands({ refreshCaches });

    await vi.waitFor(() => expect(acknowledgeWatchCommands).toHaveBeenCalled());
    expect(publishWidgetSnapshot).toHaveBeenCalled();
    expect(refreshCaches).toHaveBeenCalledWith(["con-1"]);
    expect(peekWatchCommands).toHaveBeenCalledTimes(1);

    listeners.get("onWatchCommand")?.();
    await vi.waitFor(() => expect(peekWatchCommands).toHaveBeenCalledTimes(2));
    for (const listener of appStateListeners) listener("background");
    for (const listener of appStateListeners) listener("active");
    await vi.waitFor(() => expect(peekWatchCommands).toHaveBeenCalledTimes(3));
    // Empty queues publish nothing.
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);

    cleanup();
    expect(removeListener).toHaveBeenCalled();
    expect(removeAppState).toHaveBeenCalled();
  });

  it("republishes after a batch that changed nothing, so the Watch catches up", async () => {
    vi.stubEnv("EXPO_OS", "ios");
    row("panel", { isInSchedule: true });
    const refreshCaches = vi.fn();
    peekWatchCommands.mockReturnValueOnce([
      command("save", "panel", { sentAtMs: Date.now() }),
    ]);
    const cleanup = initWatchCommands({ refreshCaches });
    await vi.waitFor(() => expect(publishWidgetSnapshot).toHaveBeenCalled());
    expect(refreshCaches).not.toHaveBeenCalled();
    cleanup();
  });

  it("runs one more pass for a command queued mid-drain", async () => {
    vi.stubEnv("EXPO_OS", "ios");
    row("first");
    row("second");
    let release: () => void = () => undefined;
    getById.mockImplementationOnce(
      (id: string) =>
        new Promise((resolve) => {
          release = () => resolve(rows.get(id));
        }),
    );
    peekWatchCommands
      .mockReturnValueOnce([command("save", "first", { sentAtMs: Date.now() })])
      .mockReturnValueOnce([
        command("save", "second", { sentAtMs: Date.now() }),
      ]);
    const first = drainWatchCommands();
    const second = drainWatchCommands();
    await vi.waitFor(() => expect(getById).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    expect(saveEventToPlan.mock.calls.map(([event]) => event.id)).toEqual([
      "first",
      "second",
    ]);
  });
});

// The App Group queue is read, applied, published and only then cleared, so
// a process that dies part-way, or a command that fails, is not a lost tap.
describe("the durable queue", () => {
  const idOf = (raw: string) => (JSON.parse(raw) as { id: string }).id;

  it("acknowledges a batch only after publishing the snapshot that lists it", async () => {
    row("panel");
    const raw = command("save", "panel", { sentAtMs: Date.now() });
    peekWatchCommands.mockReturnValueOnce([raw]);
    await drainWatchCommands();

    expect(acknowledgeWatchCommands).toHaveBeenCalledWith([idOf(raw)]);
    expect(publishWidgetSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      acknowledgeWatchCommands.mock.invocationCallOrder[0] ?? 0,
    );
    expect(handledWatchCommandIds(Date.now())).toEqual([idOf(raw)]);
  });

  it("lists a declined command as handled, so the Watch frees its button", async () => {
    row("dealers", {
      startTime: new Date(Date.now() - 60 * 60_000).toISOString(),
      endTime: new Date(Date.now() + 7 * 60 * 60_000).toISOString(),
    });
    const raw = command("save", "dealers", { sentAtMs: Date.now() });
    peekWatchCommands.mockReturnValueOnce([raw]);
    await drainWatchCommands();

    expect(saveEventToPlan).not.toHaveBeenCalled();
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(handledWatchCommandIds(Date.now())).toEqual([idOf(raw)]);
    expect(acknowledgeWatchCommands).toHaveBeenCalledWith([idOf(raw)]);
  });

  it("keeps a failing command queued, then gives up on it after the last try", async () => {
    row("panel");
    const raw = command("save", "panel", { sentAtMs: Date.now() });
    peekWatchCommands.mockReturnValue([raw]);
    for (let attempt = 1; attempt <= WATCH_COMMAND_MAX_ATTEMPTS; attempt += 1)
      saveEventToPlan.mockRejectedValueOnce(new Error("database is locked"));

    for (let attempt = 1; attempt < WATCH_COMMAND_MAX_ATTEMPTS; attempt += 1) {
      await drainWatchCommands();
      expect(acknowledgeWatchCommands).not.toHaveBeenCalled();
      expect(publishWidgetSnapshot).not.toHaveBeenCalled();
    }
    await drainWatchCommands();
    expect(saveEventToPlan).toHaveBeenCalledTimes(WATCH_COMMAND_MAX_ATTEMPTS);
    expect(publishWidgetSnapshot).toHaveBeenCalledTimes(1);
    expect(acknowledgeWatchCommands).toHaveBeenCalledWith([idOf(raw)]);
    expect(handledWatchCommandIds(Date.now())).toEqual([idOf(raw)]);
  });

  it("retries a failed command at the next drain and applies it", async () => {
    row("panel");
    const raw = command("save", "panel", { sentAtMs: Date.now() });
    peekWatchCommands.mockReturnValue([raw]);
    saveEventToPlan.mockRejectedValueOnce(new Error("database is locked"));
    await drainWatchCommands();
    expect(rows.get("panel")?.isInSchedule).toBe(false);
    await drainWatchCommands();
    expect(rows.get("panel")?.isInSchedule).toBe(true);
    expect(acknowledgeWatchCommands).toHaveBeenCalledTimes(1);
  });

  it("acknowledges again, without applying, a command an earlier pass handled", async () => {
    row("panel");
    const raw = command("save", "panel", { sentAtMs: Date.now() });
    recordHandledWatchCommands([idOf(raw)], Date.now());
    peekWatchCommands.mockReturnValueOnce([raw]);
    await drainWatchCommands();
    expect(saveEventToPlan).not.toHaveBeenCalled();
    expect(publishWidgetSnapshot).not.toHaveBeenCalled();
    expect(acknowledgeWatchCommands).toHaveBeenCalledWith([idOf(raw)]);
  });

  it("drops queued entries that do not parse", async () => {
    peekWatchCommands.mockReturnValueOnce([
      JSON.stringify({ id: "damaged", action: "star" }),
      "{",
    ]);
    await drainWatchCommands();
    expect(publishWidgetSnapshot).not.toHaveBeenCalled();
    expect(acknowledgeWatchCommands).toHaveBeenCalledWith(["damaged"]);
  });

  it("remembers a day of handled ids, newest last, and at most the queue's cap", () => {
    recordHandledWatchCommands(["old"], NOW - WATCH_COMMAND_MAX_AGE_MS - 1);
    recordHandledWatchCommands(["kept"], NOW - 60_000);
    expect(handledWatchCommandIds(NOW)).toEqual(["kept"]);

    const many = Array.from(
      { length: WATCH_HANDLED_COMMANDS_LIMIT + 5 },
      (_, index) => `cmd-many-${index}`,
    );
    recordHandledWatchCommands(many, NOW);
    const ids = handledWatchCommandIds(NOW);
    expect(ids).toHaveLength(WATCH_HANDLED_COMMANDS_LIMIT);
    expect(ids.at(-1)).toBe(many.at(-1));
    expect(ids).not.toContain("kept");
  });
});
