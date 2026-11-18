import { describe, expect, it } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import {
  planTrackedEvent,
  type TrackedEventContext,
  trackedEventBlocker,
} from "./tracked-event";
import {
  TRACKED_EVENT_LEAD_MS,
  TRACKED_EVENT_OPEN_END_MS,
  type TrackedEventProps,
} from "./tracked-event.types";

const labels = {
  startsIn: "Starts in",
  endsIn: "Ends in",
  now: "Now",
  ended: "Ended",
  stop: "Stop",
  channelName: "Tracked event",
  channelDescription: "Shows the one event you chose to track.",
};

const context: TrackedEventContext = {
  locale: "en-US",
  hour12: true,
  fallbackTimeZone: "America/Chicago",
  labels,
  appScheme: "conpaws",
};

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
    // 10:00 to 11:00 in New York.
    startTime: "2026-07-03T14:00:00.000Z",
    endTime: "2026-07-03T15:00:00.000Z",
    location: "Convention Center",
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

const START = Date.parse("2026-07-03T14:00:00.000Z");
const END = Date.parse("2026-07-03T15:00:00.000Z");
const BEFORE = START - 30 * 60_000;

function shown(
  sourceEvent: ConventionEvent,
  con: Convention = convention(),
  nowMs = BEFORE,
  ctx: TrackedEventContext = context,
): TrackedEventProps {
  const plan = planTrackedEvent(sourceEvent, con, nowMs, ctx);
  if (plan.kind !== "show")
    throw new Error(`expected show, got ${plan.reason}`);
  return plan.props;
}

describe("trackedEventBlocker", () => {
  it("allows a saved event inside the lead window", () => {
    expect(trackedEventBlocker(event(), convention(), BEFORE)).toBeNull();
  });

  it.each([
    ["no event", undefined, convention()],
    ["no convention", event(), undefined],
    ["an event of another convention", event(), convention({ id: "con_2" })],
  ])("reports deleted for %s", (_name, sourceEvent, con) => {
    expect(trackedEventBlocker(sourceEvent, con, BEFORE)).toBe("deleted");
  });

  it("reports each stop reason in order", () => {
    expect(
      trackedEventBlocker(event({ isInSchedule: false }), convention(), BEFORE),
    ).toBe("unsaved");
    // Unsaved wins over the feed marking it.
    expect(
      trackedEventBlocker(
        event({ isInSchedule: false, feedStatus: "cancelled" }),
        convention(),
        BEFORE,
      ),
    ).toBe("unsaved");
    expect(
      trackedEventBlocker(
        event({ feedStatus: "cancelled" }),
        convention({ archivedAt: "2026-07-01" }),
        BEFORE,
      ),
    ).toBe("cancelled");
    expect(
      trackedEventBlocker(
        event({ feedStatus: "removed" }),
        convention(),
        BEFORE,
      ),
    ).toBe("removed");
    expect(
      trackedEventBlocker(
        event({ startTime: "not a date" }),
        convention({ archivedAt: "2026-07-01" }),
        BEFORE,
      ),
    ).toBe("archived");
    expect(
      trackedEventBlocker(event({ startTime: "not a date" }), convention(), 0),
    ).toBe("invalid");
    expect(trackedEventBlocker(event(), convention(), END)).toBe("ended");
  });

  it("holds back a start more than the lead time away", () => {
    expect(
      trackedEventBlocker(
        event(),
        convention(),
        START - TRACKED_EVENT_LEAD_MS - 1,
      ),
    ).toBe("too-early");
    expect(
      trackedEventBlocker(event(), convention(), START - TRACKED_EVENT_LEAD_MS),
    ).toBeNull();
  });
});

describe("planTrackedEvent", () => {
  it("never stops an already tracked event for being early", () => {
    expect(
      planTrackedEvent(
        event(),
        convention(),
        START - TRACKED_EVENT_LEAD_MS * 3,
        context,
      ).kind,
    ).toBe("show");
  });

  it.each([
    ["deleted", undefined, convention(), BEFORE],
    ["unsaved", event({ isInSchedule: false }), convention(), BEFORE],
    ["cancelled", event({ feedStatus: "cancelled" }), convention(), BEFORE],
    ["removed", event({ feedStatus: "removed" }), convention(), BEFORE],
    [
      "archived",
      event(),
      convention({ archivedAt: "2026-07-02T00:00:00Z" }),
      BEFORE,
    ],
    ["invalid", event({ startTime: "" }), convention(), BEFORE],
    ["ended", event(), convention(), END + 1],
  ] as const)("stops with %s", (reason, sourceEvent, con, nowMs) => {
    expect(planTrackedEvent(sourceEvent, con, nowMs, context)).toEqual({
      kind: "stop",
      reason,
    });
  });

  it("shows the real title, place, times and link", () => {
    expect(shown(event())).toEqual({
      eventId: "evt_1",
      conventionId: "con_1",
      title: "Fursuit Parade",
      conventionName: "Aurora Fur Fest",
      place: "Hall A",
      startAtMs: START,
      endAtMs: END,
      cleanupAtMs: END,
      timeLabel: "10:00 AM – 11:00 AM",
      labels,
      url: "conpaws://convention/con_1?highlightEventId=evt_1",
    });
  });

  it("keeps a missing end null and cleans up an hour after the start", () => {
    const props = shown(event({ endTime: null }));
    expect(props.endAtMs).toBeNull();
    expect(props.cleanupAtMs).toBe(START + TRACKED_EVENT_OPEN_END_MS);
    expect(props.timeLabel).toBe("10:00 AM");
    expect(
      planTrackedEvent(
        event({ endTime: null }),
        convention(),
        START + TRACKED_EVENT_OPEN_END_MS,
        context,
      ),
    ).toEqual({ kind: "stop", reason: "ended" });
  });

  it("treats an end at or before the start as no end", () => {
    for (const endTime of [
      "2026-07-03T13:00:00.000Z",
      "2026-07-03T14:00:00.000Z",
      "garbage",
    ]) {
      const props = shown(event({ endTime }));
      expect(props.endAtMs).toBeNull();
      expect(props.cleanupAtMs).toBe(START + TRACKED_EVENT_OPEN_END_MS);
      expect(props.timeLabel).toBe("10:00 AM");
    }
  });

  describe("drop-ins", () => {
    // Open six hours, so it counts as a drop-in rather than a panel.
    const dropIn = {
      startTime: "2026-07-03T14:00:00.000Z",
      endTime: "2026-07-03T20:00:00.000Z",
    };

    it("tracks the visit the user planned, not the opening hours", () => {
      const props = shown(
        event({
          ...dropIn,
          visitStartTime: "2026-07-03T16:00:00.000Z",
          visitEndTime: "2026-07-03T16:30:00.000Z",
        }),
      );
      expect(props.startAtMs).toBe(Date.parse("2026-07-03T16:00:00.000Z"));
      expect(props.endAtMs).toBe(Date.parse("2026-07-03T16:30:00.000Z"));
      expect(props.timeLabel).toBe("12:00 PM – 12:30 PM");
    });

    it("reads as unsaved without a valid visit", () => {
      expect(trackedEventBlocker(event(dropIn), convention(), BEFORE)).toBe(
        "unsaved",
      );
      expect(
        trackedEventBlocker(
          event({
            ...dropIn,
            // Outside the opening hours.
            visitStartTime: "2026-07-03T21:00:00.000Z",
            visitEndTime: "2026-07-03T21:30:00.000Z",
          }),
          convention(),
          BEFORE,
        ),
      ).toBe("unsaved");
    });
  });

  it("formats in the convention's zone with the user's clock", () => {
    expect(
      shown(event(), convention({ timeZone: "Europe/Berlin" }), BEFORE, {
        ...context,
        locale: "en-GB",
        hour12: false,
      }).timeLabel,
    ).toBe("16:00 – 17:00");
  });

  it("falls back to the device zone when the convention's is unusable", () => {
    for (const timeZone of [null, "Mars/Olympus_Mons"]) {
      expect(shown(event(), convention({ timeZone })).timeLabel).toBe(
        "9:00 AM – 10:00 AM",
      );
    }
  });

  it("marks an end on another convention day with its weekday", () => {
    expect(
      shown(
        event({
          startTime: "2026-07-04T02:00:00.000Z",
          endTime: "2026-07-04T05:00:00.000Z",
        }),
        convention(),
        Date.parse("2026-07-04T01:00:00.000Z"),
      ).timeLabel,
    ).toBe("10:00 PM – Sat 1:00 AM");
  });

  it("uses the room, else the location, else nothing", () => {
    expect(shown(event({ room: "  Hall A  " })).place).toBe("Hall A");
    expect(shown(event({ room: "   ", location: " Lobby " })).place).toBe(
      "Lobby",
    );
    expect(shown(event({ room: null, location: null })).place).toBeNull();
  });

  it("encodes ids in the link and uses the variant's scheme", () => {
    const props = shown(
      event({ id: "evt/1 &x", conventionId: "con?2" }),
      convention({ id: "con?2" }),
      BEFORE,
      { ...context, appScheme: "conpaws-dev" },
    );
    expect(props.url).toBe(
      "conpaws-dev://convention/con%3F2?highlightEventId=evt%2F1%20%26x",
    );
  });
});
