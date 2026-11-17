import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import type {
  TrackedEventPresentation,
  TrackedEventPresenterStart,
  TrackedEventProps,
  TrackedEventSelection,
} from "@/lib/tracked-event.types";

const mocks = vi.hoisted(() => {
  const state = {
    stored: null as TrackedEventSelection | null,
    cache: undefined as TrackedEventSelection | null | undefined,
  };
  return {
    state,
    presenter: {
      presentTrackedEvent:
        vi.fn<
          (props: TrackedEventProps) => Promise<TrackedEventPresenterStart>
        >(),
      updateTrackedEvent:
        vi.fn<(props: TrackedEventProps) => Promise<boolean>>(),
      restoreTrackedEvent:
        vi.fn<(props: TrackedEventProps) => Promise<boolean>>(),
      dismissTrackedEvent: vi.fn<() => Promise<void>>(),
      readTrackedEventPresentation:
        vi.fn<() => Promise<TrackedEventPresentation>>(),
      subscribeTrackedEventStop: vi.fn<(listener: () => void) => () => void>(),
      isTrackedEventSupported: vi.fn<() => boolean>(),
    },
    storage: {
      loadTrackedEventSelection: vi.fn(async () => {
        state.cache = state.stored;
        return state.cache;
      }),
      getCachedTrackedEventSelection: vi.fn(() => state.cache ?? null),
      saveTrackedEventSelection: vi.fn(
        async (selection: TrackedEventSelection) => {
          state.cache = selection;
          state.stored = selection;
        },
      ),
      clearTrackedEventSelection: vi.fn(async () => {
        state.cache = null;
        state.stored = null;
      }),
    },
    events: { getById: vi.fn<(id: string) => Promise<unknown>>() },
    conventions: { getById: vi.fn<(id: string) => Promise<unknown>>() },
    reportError: vi.fn(),
  };
});

vi.mock("./tracked-event-presenter", () => mocks.presenter);
vi.mock("@/lib/tracked-event-storage", () => mocks.storage);
vi.mock("@/db/repositories/events", () => mocks.events);
vi.mock("@/db/repositories/conventions", () => mocks.conventions);
vi.mock("@/lib/error-reporting", () => ({ reportError: mocks.reportError }));
vi.mock("@/lib/i18n", () => ({
  default: {
    t: (key: string) => key,
    resolvedLanguage: "en-US",
    language: "en-US",
  },
}));
vi.mock("@/lib/device-clock", () => ({
  getTimeFormatPreference: () => "system",
  resolveHour12: (_preference: string, uses24: boolean | undefined) =>
    uses24 === undefined ? undefined : !uses24,
}));
vi.mock("expo-localization", () => ({
  getCalendars: () => [{ uses24hourClock: false }],
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: { appVariant: "production" } } },
}));

const { state, presenter, storage, events, conventions, reportError } = mocks;
type Service = typeof import("./tracked-event");
let service: Service;

const NOW = Date.parse("2026-07-03T13:30:00.000Z");

function convention(overrides: Partial<Convention> = {}): Convention {
  return {
    id: "con_1",
    name: "Aurora Fur Fest",
    startDate: "2026-07-03",
    endDate: "2026-07-05",
    timeZone: "America/New_York",
    location: null,
    archivedAt: null,
    icalUrl: null,
    catalogSlug: null,
    catalogRevision: null,
    status: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<ConventionEvent> = {}): ConventionEvent {
  return {
    id: "evt_1",
    conventionId: "con_1",
    title: "Fursuit Parade",
    description: null,
    startTime: "2026-07-03T14:00:00.000Z",
    endTime: "2026-07-03T15:00:00.000Z",
    location: null,
    room: "Hall A",
    category: null,
    type: null,
    isInSchedule: true,
    reminderMinutes: null,
    visitStartTime: null,
    visitEndTime: null,
    sourceUid: null,
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

let rows: { events: ConventionEvent[]; conventions: Convention[] };

const tracked = (eventId = "evt_1"): TrackedEventSelection => ({
  eventId,
  conventionId: "con_1",
  startedAtMs: NOW - 60_000,
});

function showing(value: boolean, stoppedByUser = false) {
  presenter.readTrackedEventPresentation.mockResolvedValue({
    showing: value,
    stoppedByUser,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.stored = null;
  state.cache = undefined;
  rows = {
    events: [event(), event({ id: "evt_2", title: "Dance Comp" })],
    conventions: [convention()],
  };
  events.getById.mockImplementation(async (id) =>
    rows.events.find((row) => row.id === id),
  );
  conventions.getById.mockImplementation(async (id) =>
    rows.conventions.find((row) => row.id === id),
  );
  presenter.presentTrackedEvent.mockResolvedValue("started");
  presenter.updateTrackedEvent.mockResolvedValue(true);
  presenter.restoreTrackedEvent.mockResolvedValue(false);
  presenter.dismissTrackedEvent.mockResolvedValue(undefined);
  presenter.subscribeTrackedEventStop.mockReturnValue(() => {});
  presenter.isTrackedEventSupported.mockReturnValue(true);
  showing(false);
  service = await import("./tracked-event");
});

function listen() {
  const listener = vi.fn();
  service.subscribeTrackedEvent(listener);
  return listener;
}

describe("startTrackingEvent", () => {
  it("presents the planned event, saves the selection and notifies", async () => {
    const listener = listen();
    await expect(service.startTrackingEvent("evt_1", "con_1")).resolves.toEqual(
      { status: "started" },
    );
    expect(presenter.presentTrackedEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_1",
        title: "Fursuit Parade",
        place: "Hall A",
        timeLabel: "10:00 AM – 11:00 AM",
        url: "conpaws://convention/con_1?highlightEventId=evt_1",
        labels: expect.objectContaining({ stop: "tracking.live.stop" }),
      }),
    );
    const selection = {
      eventId: "evt_1",
      conventionId: "con_1",
      startedAtMs: NOW,
    };
    expect(state.stored).toEqual(selection);
    expect(service.getTrackedEventSelection()).toEqual(selection);
    expect(listener).toHaveBeenCalledWith(selection, { kind: "started" });
  });

  it.each([
    "notifications-denied",
    "live-activities-disabled",
    "unavailable",
    "failed",
  ] as const)(
    "leaves nothing tracked when the presenter says %s",
    async (status) => {
      presenter.presentTrackedEvent.mockResolvedValueOnce(status);
      const listener = listen();
      await expect(
        service.startTrackingEvent("evt_1", "con_1"),
      ).resolves.toEqual({ status });
      expect(state.stored).toBeNull();
      expect(service.getTrackedEventSelection()).toBeNull();
      expect(listener).not.toHaveBeenCalled();
    },
  );

  it("reports a thrown presenter error as failed", async () => {
    presenter.presentTrackedEvent.mockRejectedValueOnce(new Error("native"));
    await expect(service.startTrackingEvent("evt_1", "con_1")).resolves.toEqual(
      { status: "failed" },
    );
    expect(state.stored).toBeNull();
    expect(reportError).toHaveBeenCalled();
  });

  it("does not present an event that cannot be tracked", async () => {
    rows.events = [event({ isInSchedule: false })];
    await expect(service.startTrackingEvent("evt_1", "con_1")).resolves.toEqual(
      { status: "not-trackable", reason: "unsaved" },
    );
    rows.events = [
      event({ startTime: "2026-07-04T14:00:00.000Z", endTime: null }),
    ];
    await expect(service.startTrackingEvent("evt_1", "con_1")).resolves.toEqual(
      { status: "not-trackable", reason: "too-early" },
    );
    await expect(
      service.startTrackingEvent("missing", "con_1"),
    ).resolves.toEqual({ status: "not-trackable", reason: "deleted" });
    expect(presenter.presentTrackedEvent).not.toHaveBeenCalled();
    expect(state.stored).toBeNull();
  });

  it("ends what it showed when the selection cannot be saved", async () => {
    storage.saveTrackedEventSelection.mockRejectedValueOnce(new Error("disk"));
    await expect(service.startTrackingEvent("evt_1", "con_1")).resolves.toEqual(
      { status: "failed" },
    );
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(state.stored).toBeNull();
  });

  it("replaces the event already tracked", async () => {
    state.stored = tracked("evt_1");
    const listener = listen();
    await expect(service.startTrackingEvent("evt_2", "con_1")).resolves.toEqual(
      { status: "started" },
    );
    // The presenter replaces what it showed; nothing ends the new one.
    expect(presenter.presentTrackedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_2" }),
    );
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
    expect(state.stored?.eventId).toBe("evt_2");
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_2" }),
      { kind: "started" },
    );
  });

  it("keeps the previous event when a replacement is refused and it is still showing", async () => {
    state.stored = tracked("evt_1");
    presenter.presentTrackedEvent.mockResolvedValueOnce("failed");
    showing(true);
    await expect(service.startTrackingEvent("evt_2", "con_1")).resolves.toEqual(
      { status: "failed" },
    );
    expect(state.stored?.eventId).toBe("evt_1");
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
  });
});

describe("stopping", () => {
  it("stops when the user asks", async () => {
    state.stored = tracked();
    const listener = listen();
    await service.stopTrackingEvent();
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(state.stored).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, { kind: "stopped-by-user" });
  });

  it("still forgets the selection when the dismissal fails", async () => {
    state.stored = tracked();
    presenter.dismissTrackedEvent.mockRejectedValueOnce(new Error("native"));
    await service.stopTrackingEvent();
    expect(state.stored).toBeNull();
    expect(reportError).toHaveBeenCalled();
  });

  it("stops for an affected event id", async () => {
    state.stored = tracked("evt_1");
    const listener = listen();
    await service.stopTrackingIfAffected(
      { eventIds: ["evt_9", "evt_1"] },
      "unsaved",
    );
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(state.stored).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, {
      kind: "ended",
      reason: "unsaved",
    });
  });

  it("stops for an affected convention", async () => {
    state.stored = tracked("evt_1");
    await service.stopTrackingIfAffected({ conventionId: "con_1" }, "archived");
    expect(state.stored).toBeNull();
  });

  it("ignores changes to other events and conventions", async () => {
    state.stored = tracked("evt_1");
    const listener = listen();
    await service.stopTrackingIfAffected({ eventIds: ["evt_2"] }, "unsaved");
    await service.stopTrackingIfAffected({ conventionId: "con_2" }, "deleted");
    await service.stopTrackingIfAffected({}, "deleted");
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
    expect(state.stored).toEqual(tracked("evt_1"));
    // Only the load is announced: nothing was started or stopped.
    expect(listener.mock.calls.map(([, change]) => change.kind)).toEqual([
      "loaded",
    ]);
  });
});

describe("reconcileTrackedEvent", () => {
  it("waits for the stored selection before deciding anything", async () => {
    state.stored = tracked();
    showing(true);
    await service.reconcileTrackedEvent();
    expect(storage.loadTrackedEventSelection).toHaveBeenCalledTimes(1);
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
  });

  it("ends a presentation with no selection behind it", async () => {
    showing(true);
    const listener = listen();
    await service.reconcileTrackedEvent();
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("does nothing when nothing is tracked or shown", async () => {
    await service.reconcileTrackedEvent();
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
  });

  it("clears the selection when the user stopped it outside the app", async () => {
    state.stored = tracked();
    showing(true, true);
    const listener = listen();
    await service.reconcileTrackedEvent();
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(state.stored).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, { kind: "stopped-by-user" });
  });

  it.each([
    ["deleted", () => (rows.events = [])],
    ["unsaved", () => (rows.events = [event({ isInSchedule: false })])],
    ["cancelled", () => (rows.events = [event({ feedStatus: "cancelled" })])],
    ["removed", () => (rows.events = [event({ feedStatus: "removed" })])],
    [
      "archived",
      () => (rows.conventions = [convention({ archivedAt: "2026-07-03" })]),
    ],
    ["invalid", () => (rows.events = [event({ startTime: "soon" })])],
    ["ended", () => vi.setSystemTime(Date.parse("2026-07-03T15:00:00.000Z"))],
  ] as const)("ends tracking when the event is %s", async (reason, arrange) => {
    state.stored = tracked();
    showing(true);
    arrange();
    const listener = listen();
    await service.reconcileTrackedEvent();
    expect(presenter.dismissTrackedEvent).toHaveBeenCalled();
    expect(state.stored).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, { kind: "ended", reason });
  });

  it("restores a lost presentation where the platform can", async () => {
    state.stored = tracked();
    presenter.restoreTrackedEvent.mockResolvedValue(true);
    const listener = listen();
    await service.reconcileTrackedEvent();
    expect(presenter.restoreTrackedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_1" }),
    );
    expect(state.stored).toEqual(tracked());
    // Only the load is announced: nothing was started or stopped.
    expect(listener.mock.calls.map(([, change]) => change.kind)).toEqual([
      "loaded",
    ]);

    // The restored props count as sent, so the next pass does not redraw.
    showing(true);
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).not.toHaveBeenCalled();
  });

  it("lets go of a lost presentation where the platform cannot restore it", async () => {
    state.stored = tracked();
    presenter.restoreTrackedEvent.mockResolvedValue(false);
    const listener = listen();
    await service.reconcileTrackedEvent();
    expect(state.stored).toBeNull();
    expect(listener).toHaveBeenCalledWith(null, { kind: "stopped-by-user" });
  });

  it("updates the presentation only when what it shows changed", async () => {
    state.stored = tracked();
    showing(true);
    // After a restart nothing is known to have been sent, so it refreshes.
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(1);

    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(1);

    rows.events = [event({ room: "Hall B" })];
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(2);
    expect(presenter.updateTrackedEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ place: "Hall B" }),
    );
  });

  it("does not redraw right after starting", async () => {
    await service.startTrackingEvent("evt_1", "con_1");
    showing(true);
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).not.toHaveBeenCalled();
  });

  it("refreshes once the event starts, though nothing it shows changed", async () => {
    // Tracked half an hour before the start: iOS was given the start as the
    // moment to redraw. Past it, the presenter has to be handed the event
    // again so the end becomes the next moment, or the activity never shows
    // the event as over.
    await service.startTrackingEvent("evt_1", "con_1");
    showing(true);
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).not.toHaveBeenCalled();

    vi.setSystemTime(Date.parse("2026-07-03T14:10:00.000Z"));
    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(1);

    await service.reconcileTrackedEvent();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(1);
  });

  it("runs one at a time and coalesces calls that arrive mid-flight", async () => {
    state.stored = tracked();
    showing(true);
    let inFlight = 0;
    let maxInFlight = 0;
    const releases: Array<() => void> = [];
    presenter.readTrackedEventPresentation.mockImplementation(() => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const gate = deferred<TrackedEventPresentation>();
      releases.push(() => {
        inFlight -= 1;
        gate.resolve({ showing: true, stoppedByUser: false });
      });
      return gate.promise;
    });

    const first = service.reconcileTrackedEvent();
    await vi.waitFor(() => expect(releases).toHaveLength(1));
    const rest = [
      service.reconcileTrackedEvent(),
      service.reconcileTrackedEvent(),
      service.reconcileTrackedEvent(),
    ];
    expect(rest[1]).toBe(rest[0]);
    releases[0]?.();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases[1]?.();
    await Promise.all([first, ...rest]);

    expect(maxInFlight).toBe(1);
    expect(presenter.readTrackedEventPresentation).toHaveBeenCalledTimes(2);
  });

  it("does not let a reconcile end an event that a start is presenting", async () => {
    const gate = deferred<TrackedEventPresenterStart>();
    presenter.presentTrackedEvent.mockReturnValueOnce(gate.promise);
    const start = service.startTrackingEvent("evt_1", "con_1");
    await vi.waitFor(() =>
      expect(presenter.presentTrackedEvent).toHaveBeenCalled(),
    );
    showing(true);
    const reconcile = service.reconcileTrackedEvent();
    gate.resolve("started");
    await Promise.all([start, reconcile]);
    expect(presenter.dismissTrackedEvent).not.toHaveBeenCalled();
    expect(state.stored?.eventId).toBe("evt_1");
  });

  it("recovers after a failed run", async () => {
    state.stored = tracked();
    showing(true);
    events.getById.mockRejectedValueOnce(new Error("database is closed"));
    await expect(service.reconcileTrackedEvent()).rejects.toThrow(
      "database is closed",
    );
    await expect(service.reconcileTrackedEvent()).resolves.toBeUndefined();
    expect(presenter.updateTrackedEvent).toHaveBeenCalledTimes(1);
  });
});

describe("isTrackingSupported", () => {
  it("is the platform presenter's answer", () => {
    expect(service.isTrackingSupported()).toBe(true);
    presenter.isTrackedEventSupported.mockReturnValue(false);
    expect(service.isTrackingSupported()).toBe(false);
  });
});

describe("initTrackedEvent", () => {
  it("tells screens that mounted before the selection loaded", async () => {
    state.stored = tracked();
    const listener = listen();
    expect(service.getTrackedEventSelection()).toBeNull();

    service.initTrackedEvent();

    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(tracked(), { kind: "loaded" }),
    );
    expect(service.getTrackedEventSelection()).toEqual(tracked());
  });

  it("stays quiet when nothing was tracked", async () => {
    const listener = listen();
    service.initTrackedEvent();
    await service.reconcileTrackedEvent();
    expect(listener).not.toHaveBeenCalled();
  });

  it("loads the selection and reconciles when Stop is pressed outside the app", async () => {
    state.stored = tracked();
    let onStop: (() => void) | undefined;
    const unsubscribe = vi.fn();
    presenter.subscribeTrackedEventStop.mockImplementation((listener) => {
      onStop = listener;
      return unsubscribe;
    });
    const stop = service.initTrackedEvent();
    await vi.waitFor(() =>
      expect(service.getTrackedEventSelection()).toEqual(tracked()),
    );

    showing(false, true);
    const listener = listen();
    onStop?.();
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith(null, { kind: "stopped-by-user" }),
    );

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
