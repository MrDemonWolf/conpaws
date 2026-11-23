import { describe, expect, it } from "vitest";
import type { ConventionEvent } from "@/db/schema";
import {
  plainTextSummary,
  selectWatchOptions,
  utf8ByteLength,
  WATCH_LONGEST_COUNTED_PANEL_MS,
  WATCH_OPTIONS_LIMIT,
  WATCH_OPTIONS_PER_HOUR,
  WATCH_PAYLOAD_MAX_BYTES,
  WATCH_SUMMARY_MAX_LENGTH,
  type WatchConventionSnapshot,
  watchLastActiveMs,
  withWatchExtras,
} from "./watch-snapshot";
import type {
  WidgetConventionSnapshot,
  WidgetEventSnapshot,
  WidgetSnapshot,
} from "./widget-snapshot";

const NOW = Date.parse("2026-09-04T15:20:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function row(
  id: string,
  startOffsetMinutes: number,
  overrides: Partial<ConventionEvent> & {
    durationMinutes?: number | null;
  } = {},
): ConventionEvent {
  const { durationMinutes = 60, ...rest } = overrides;
  const start = NOW + startOffsetMinutes * MINUTE;
  return {
    id,
    conventionId: "con-1",
    title: id,
    description: null,
    startTime: new Date(start).toISOString(),
    endTime:
      durationMinutes === null
        ? null
        : new Date(start + durationMinutes * MINUTE).toISOString(),
    location: "Center",
    room: "Hall A",
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
    ...rest,
  };
}

function toOption(event: ConventionEvent): WidgetEventSnapshot | null {
  const startAtMs = Date.parse(event.startTime);
  if (!Number.isFinite(startAtMs)) return null;
  return {
    id: event.id,
    title: event.title,
    startAtMs,
    endAtMs: event.endTime ? Date.parse(event.endTime) : null,
    location: event.location,
    room: event.room,
    reminderMinutes: null,
    ageRating: null,
  };
}

function savedSnapshot(rows: readonly ConventionEvent[]): WidgetSnapshot {
  return {
    schemaVersion: 2,
    generatedAtMs: NOW,
    localeIdentifier: "en",
    timeFormat: "system",
    presentation: {
      appearance: "system",
      palette: {
        light: {
          background: "#fff",
          foreground: "#000",
          secondary: "#555",
          accent: "#05f",
        },
        dark: {
          background: "#000",
          foreground: "#fff",
          secondary: "#aaa",
          accent: "#5af",
        },
      },
      labels: {
        next: "Up next",
        current: "Now",
        noEvents: "None",
        finished: "Done",
      },
    },
    conventions: [
      {
        id: "con-1",
        name: "ConPaws",
        startAtMs: NOW - 24 * HOUR,
        endAtMs: NOW + 48 * HOUR,
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "Sep 3 – 6",
        events: rows
          .filter((event) => event.isInSchedule)
          .flatMap((event) => {
            const snapshot = toOption(event);
            return snapshot ? [{ ...snapshot, reminderMinutes: 15 }] : [];
          }),
      },
    ],
  };
}

function parse(json: string): {
  presentation?: unknown;
  conventions: WatchConventionSnapshot[];
} {
  return JSON.parse(json);
}

describe("plainTextSummary", () => {
  it("turns an HTML description into one line of plain text", () => {
    expect(
      plainTextSummary(
        "<p>Bring your <b>fur</b>suit&nbsp;&amp; water.</p>\n\n<p>Ages&nbsp;18+ &mdash; ID&#39;s checked&hellip;</p><script>alert(1)</script>",
      ),
    ).toBe("Bring your fursuit & water. Ages 18+ — ID's checked…");
  });

  it("keeps text that only looks like markup and decodes once", () => {
    expect(plainTextSummary("5 < 6 and 7 > 3")).toBe("5 < 6 and 7 > 3");
    expect(plainTextSummary("&lt;b&gt; &amp;mdash;")).toBe("<b> &mdash;");
  });

  it.each([null, undefined, "", "   \n\t", "<p> </p><br/>"])(
    "omits an empty description (%j)",
    (description) => {
      expect(plainTextSummary(description)).toBeUndefined();
    },
  );

  it("cuts a long description on a word boundary with an ellipsis", () => {
    const summary = plainTextSummary("word ".repeat(100)) ?? "";
    expect(Array.from(summary).length).toBeLessThanOrEqual(
      WATCH_SUMMARY_MAX_LENGTH,
    );
    expect(summary.endsWith("word…")).toBe(true);
    expect(summary).not.toMatch(/\s…$/);
  });

  it("hard-cuts one enormous token and never splits an emoji", () => {
    const token = plainTextSummary(`https://example.test/${"a".repeat(400)}`);
    expect(Array.from(token ?? "")).toHaveLength(WATCH_SUMMARY_MAX_LENGTH);
    const emoji = plainTextSummary("🐾".repeat(400)) ?? "";
    expect(Array.from(emoji)).toHaveLength(WATCH_SUMMARY_MAX_LENGTH);
    expect(emoji.endsWith("🐾…")).toBe(true);
  });

  it("leaves a description of exactly the limit alone", () => {
    const exact = "x".repeat(WATCH_SUMMARY_MAX_LENGTH);
    expect(plainTextSummary(exact)).toBe(exact);
  });
});

describe("selectWatchOptions", () => {
  it("offers unsaved timed panels overlapping the next six hours", () => {
    const events = [
      row("running", -30),
      row("saved", 10, { isInSchedule: true }),
      row("cancelled", 10, { feedStatus: "cancelled" }),
      row("drop-in", -60, { durationMinutes: 8 * 60 }),
      row("visit", 10, {
        visitStartTime: new Date(NOW).toISOString(),
        visitEndTime: new Date(NOW + HOUR).toISOString(),
      }),
      row("ended", -90),
      row("no-end-running", -50, { durationMinutes: null }),
      row("no-end-over", -61, { durationMinutes: null }),
      row("last-in-window", 6 * 60 - 1),
      row("beyond-window", 6 * 60),
      row("bad-start", 0, { startTime: "not a date" }),
    ];
    expect(selectWatchOptions(events, NOW).map((event) => event.id)).toEqual([
      "no-end-running",
      "running",
      "last-in-window",
    ]);
  });

  it("sorts by start then title and stops at the limit", () => {
    const events = Array.from({ length: 30 }, (_, index) =>
      row(`panel-${String(29 - index).padStart(2, "0")}`, index % 2 ? 30 : 0),
    );
    const options = selectWatchOptions(events, NOW);
    expect(options).toHaveLength(WATCH_OPTIONS_LIMIT);
    const firstLater = options.findIndex(
      (event) => Date.parse(event.startTime) > NOW,
    );
    expect(firstLater).toBe(15);
    expect(options.slice(0, 3).map((event) => event.id)).toEqual([
      "panel-01",
      "panel-03",
      "panel-05",
    ]);
  });
});

describe("selectWatchOptions when more qualify than are sent", () => {
  // Twelve rooms with a panel every hour on the hour, from the one running
  // now (15:00 UTC) to the last that starts inside the window (21:00).
  const hours = [0, 1, 2, 3, 4, 5, 6];
  const rooms = Array.from({ length: 12 }, (_, room) => room);
  const crowded = hours.flatMap((hour) =>
    rooms.map((room) =>
      row(`h${hour}-room-${String(room).padStart(2, "0")}`, hour * 60 - 20, {
        title: `Hour ${hour} room ${String(room).padStart(2, "0")}`,
      }),
    ),
  );

  it("shares the places out over every hour of the window", () => {
    const options = selectWatchOptions(crowded, NOW, "UTC");
    expect(options).toHaveLength(WATCH_OPTIONS_LIMIT);
    const perHour = new Map<number, number>();
    for (const event of options) {
      const hour = Number(event.id.split("-")[0]?.slice(1));
      perHour.set(hour, (perHour.get(hour) ?? 0) + 1);
    }
    // 24 over 7 hours: every hour gets three or four, earliest hours first.
    expect([...perHour.keys()].sort()).toEqual(hours);
    expect(hours.map((hour) => perHour.get(hour))).toEqual([
      4, 4, 4, 3, 3, 3, 3,
    ]);
    // Within an hour, the ones the Watch would list first.
    expect(
      options.filter((event) => event.id.startsWith("h0-")).map((e) => e.id),
    ).toEqual(["h0-room-00", "h0-room-01", "h0-room-02", "h0-room-03"]);
  });

  it("still returns them soonest first, then by title", () => {
    const options = selectWatchOptions(crowded, NOW, "UTC");
    const sorted = [...options].sort(
      (left, right) =>
        Date.parse(left.startTime) - Date.parse(right.startTime) ||
        left.title.localeCompare(right.title),
    );
    expect(options).toEqual(sorted);
  });

  it("gives an hour at most the Watch's five before the rest go by start", () => {
    // Two hours: thirty panels now, three in the last hour of the window.
    const events = [
      ...Array.from({ length: 30 }, (_, index) =>
        row(`now-${String(index).padStart(2, "0")}`, 0),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        row(`late-${index}`, 5 * 60 + 50),
      ),
    ];
    const options = selectWatchOptions(events, NOW, "UTC");
    expect(options).toHaveLength(WATCH_OPTIONS_LIMIT);
    expect(
      options.filter((event) => event.id.startsWith("late-")),
    ).toHaveLength(3);
    expect(WATCH_OPTIONS_PER_HOUR).toBe(5);
  });

  it("cuts the hours in the convention's zone", () => {
    // Kolkata is UTC+5:30: 15:20 UTC is 20:50 local, so the local hour
    // started at 14:30 UTC and the next one at 15:30.
    const events = [
      ...Array.from({ length: 30 }, (_, index) =>
        row(`this-hour-${String(index).padStart(2, "0")}`, -5, {
          durationMinutes: 10,
        }),
      ),
      // 15:35-15:55 UTC: the next hour in Kolkata, the same hour in UTC.
      row("next-local-hour", 15, { durationMinutes: 20 }),
    ];
    const ids = (timeZone: string) =>
      selectWatchOptions(events, NOW, timeZone).map((event) => event.id);
    expect(ids("Asia/Kolkata")).toContain("next-local-hour");
    expect(ids("UTC")).not.toContain("next-local-hour");
    // An unknown zone falls back to UTC hours rather than failing.
    expect(ids("Not/AZone")).toEqual(ids("UTC"));
  });
});

describe("utf8ByteLength", () => {
  it("counts what WatchConnectivity will measure", () => {
    const value = 'Café — 🐾 "東京" \ud800';
    expect(utf8ByteLength(value)).toBe(Buffer.byteLength(value, "utf8"));
    const json = JSON.stringify({ value });
    expect(utf8ByteLength(json)).toBe(Buffer.byteLength(json, "utf8"));
  });
});

describe("watchLastActiveMs", () => {
  const convention = (
    events: Array<{ start: number; end: number | null }>,
  ): Pick<WidgetConventionSnapshot, "endAtMs" | "events"> => ({
    endAtMs: NOW,
    events: events.map(({ start, end }, index) => ({
      id: `panel-${index}`,
      title: "Panel",
      startAtMs: NOW + start,
      endAtMs: end === null ? null : NOW + end,
      location: null,
      room: null,
      reminderMinutes: null,
      ageRating: null,
    })),
  });

  // The same cases as ScheduleStateTests.lastActiveMomentFollowsTheLatestSavedPanelsEnd.
  it.each([
    ["no panels", [], 0],
    ["a panel over before the end", [{ start: -2 * HOUR, end: -HOUR }], 0],
    [
      "a panel running past the end",
      [{ start: -HOUR, end: 45 * MINUTE }],
      45 * MINUTE,
    ],
    ["a panel with no end", [{ start: -30 * MINUTE, end: null }], 30 * MINUTE],
    [
      "a bad end weeks out",
      [{ start: -HOUR, end: 30 * DAY }],
      -HOUR + WATCH_LONGEST_COUNTED_PANEL_MS,
    ],
    [
      "a panel after the convention",
      [{ start: 2 * DAY, end: 2 * DAY + HOUR }],
      2 * DAY + HOUR,
    ],
  ] as const)("counts %s", (_name, events, after) => {
    expect(watchLastActiveMs(convention([...events]))).toBe(NOW + after);
  });
});

describe("withWatchExtras", () => {
  const rows = [
    row("saved", 30, {
      isInSchedule: true,
      description: "<p>Meet the <i>artists</i>.</p>",
    }),
    row("saved-plain", 90, { isInSchedule: true }),
    row("option", 15, { description: "Open &amp; free" }),
    row("option-plain", 45),
  ];

  it("keeps Android's payload exactly as it was", () => {
    const snapshot = savedSnapshot(rows);
    const json = withWatchExtras(snapshot, new Map([["con-1", rows]]), {
      os: "android",
      nowMs: NOW,
      toOption,
    });
    expect(json).toBe(JSON.stringify({ ...snapshot, presentation: undefined }));
  });

  it("adds summaries and options on iOS without touching the phone widget's snapshot", () => {
    const snapshot = savedSnapshot(rows);
    const before = JSON.stringify(snapshot);
    const payload = parse(
      withWatchExtras(snapshot, new Map([["con-1", rows]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
      }),
    );

    expect(payload).not.toHaveProperty("presentation");
    const [convention] = payload.conventions;
    expect(
      convention?.events.map((event) => [event.id, event.summary]),
    ).toEqual([
      ["saved", "Meet the artists."],
      ["saved-plain", undefined],
    ]);
    expect(convention?.events[1]).not.toHaveProperty("summary");
    expect(
      convention?.options?.map((event) => [event.id, event.summary]),
    ).toEqual([
      ["option", "Open & free"],
      ["option-plain", undefined],
    ]);
    expect(convention?.options?.[0]?.reminderMinutes).toBeNull();
    // publishPhoneWidget receives this object afterwards.
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("lists the commands the phone has handled, on iOS only", () => {
    const snapshot = savedSnapshot(rows);
    const events = new Map([["con-1", rows]]);
    const ios = JSON.parse(
      withWatchExtras(snapshot, events, {
        os: "ios",
        nowMs: NOW,
        toOption,
        handledCommandIds: ["cmd-1", "cmd-2"],
      }),
    );
    expect(ios.handledCommandIds).toEqual(["cmd-1", "cmd-2"]);
    expect(
      JSON.parse(
        withWatchExtras(snapshot, events, { os: "ios", nowMs: NOW, toOption }),
      ),
    ).not.toHaveProperty("handledCommandIds");
    expect(
      JSON.parse(
        withWatchExtras(snapshot, events, {
          os: "android",
          nowMs: NOW,
          toOption,
          handledCommandIds: ["cmd-1"],
        }),
      ),
    ).not.toHaveProperty("handledCommandIds");
  });

  describe("a convention past its end", () => {
    /** The same convention, ended half an hour ago. */
    const over = (saved: readonly ConventionEvent[]): WidgetSnapshot => {
      const snapshot = savedSnapshot(saved);
      return {
        ...snapshot,
        conventions: snapshot.conventions.map((convention) => ({
          ...convention,
          endAtMs: NOW - 30 * MINUTE,
        })),
      };
    };
    const send = (saved: readonly ConventionEvent[]) =>
      parse(
        withWatchExtras(over(saved), new Map([["con-1", saved]]), {
          os: "ios",
          nowMs: NOW,
          toOption,
        }),
      ).conventions[0];

    /**
     * The Watch keeps showing a closing panel that runs past the end, and
     * one that starts after it, until it finishes; their detail screens
     * lost the description the moment the convention ended.
     */
    it("keeps descriptions of the saved panels the Watch still shows", () => {
      const sent = send([
        row("ended", -180, {
          isInSchedule: true,
          description: "Over before the end.",
        }),
        row("closing-night", -60, {
          isInSchedule: true,
          durationMinutes: 120,
          description: "<p>Runs past the end.</p>",
        }),
        row("after-party", 30, {
          isInSchedule: true,
          durationMinutes: null,
          description: "Starts after the end.",
        }),
        row("option", -10, { description: "Not saved." }),
      ]);
      expect(sent?.events.map((event) => [event.id, event.summary])).toEqual([
        ["ended", undefined],
        ["closing-night", "Runs past the end."],
        ["after-party", "Starts after the end."],
      ]);
      expect(sent?.events[0]).not.toHaveProperty("summary");
      expect(sent).not.toHaveProperty("options");
    });

    it("sends nothing extra once every saved panel is over", () => {
      const saved = [
        row("ended", -180, { isInSchedule: true, description: "Over." }),
        // Ends the moment the payload is made, so it has ended.
        row("closing-night", -60, {
          isInSchedule: true,
          description: "Over too.",
        }),
        row("option", -10, { description: "Not saved." }),
      ];
      expect(send(saved)).toEqual(over(saved).conventions[0]);
    });
  });

  describe("conventions the Watch can no longer show", () => {
    const panel = (
      id: string,
      startAtMs: number,
      endAtMs: number | null = startAtMs + HOUR,
    ): WidgetEventSnapshot => ({
      id,
      title: `Saved panel ${id} with a long enough title`,
      startAtMs,
      endAtMs,
      location: "Convention Center",
      room: "Hall A",
      reminderMinutes: 15,
      ageRating: null,
    });
    /** Over `daysAgo` days ago, with a full plan of 60 saved panels. */
    const past = (daysAgo: number): WidgetConventionSnapshot => {
      const endAtMs = NOW - daysAgo * DAY;
      return {
        id: `past-${daysAgo}`,
        name: `Past Con ${daysAgo}`,
        startAtMs: endAtMs - 3 * DAY,
        endAtMs,
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "Earlier",
        events: Array.from({ length: 60 }, (_, index) =>
          panel(`past-${daysAgo}-${index}`, endAtMs - 2 * DAY + index * HOUR),
        ),
      };
    };
    const history = [past(400), past(300), past(200), past(100), past(30)];
    const ids = (json: string) =>
      parse(json).conventions.map((convention) => convention.id);

    it("keeps only the convention that ended last when every one is over", () => {
      const snapshot = { ...savedSnapshot([]), conventions: history };
      expect(utf8ByteLength(JSON.stringify(history))).toBeGreaterThan(
        WATCH_PAYLOAD_MAX_BYTES,
      );
      const json = withWatchExtras(snapshot, new Map(), {
        os: "ios",
        nowMs: NOW,
        toOption,
      });
      expect(ids(json)).toEqual(["past-30"]);
      expect(parse(json).conventions[0]?.events).toHaveLength(60);
      expect(utf8ByteLength(json)).toBeLessThanOrEqual(WATCH_PAYLOAD_MAX_BYTES);
    });

    it("leaves room for the active convention's options and summaries", () => {
      const rows = [
        ...Array.from({ length: 30 }, (_, index) =>
          row(`saved-${index}`, index * 20, {
            isInSchedule: true,
            description: `Saved panel ${index}. ${"Details. ".repeat(30)}`,
          }),
        ),
        ...Array.from({ length: WATCH_OPTIONS_LIMIT }, (_, index) =>
          row(`option-${index}`, index * 10, {
            description: `Option ${index}. ${"Details. ".repeat(30)}`,
          }),
        ),
      ];
      const snapshot = savedSnapshot(rows);
      snapshot.conventions = [...history, ...snapshot.conventions];
      const json = withWatchExtras(snapshot, new Map([["con-1", rows]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
      });
      expect(ids(json)).toEqual(["con-1"]);
      const [active] = parse(json).conventions;
      expect(active?.options).toHaveLength(WATCH_OPTIONS_LIMIT);
      expect(active?.options?.every((event) => event.summary)).toBe(true);
      expect(active?.events.every((event) => event.summary)).toBe(true);
    });

    it("keeps one whose closing panel still runs, and the next one", () => {
      const closing: WidgetConventionSnapshot = {
        ...past(0),
        id: "closing",
        endAtMs: NOW - 30 * MINUTE,
        events: [panel("closing-night", NOW - HOUR, NOW + 15 * MINUTE)],
      };
      const next: WidgetConventionSnapshot = {
        ...past(0),
        id: "next",
        startAtMs: NOW + 26 * DAY,
        endAtMs: NOW + 29 * DAY,
        events: [],
      };
      const snapshot = {
        ...savedSnapshot([]),
        conventions: [past(100), closing, next],
      };
      const json = withWatchExtras(snapshot, new Map(), {
        os: "ios",
        nowMs: NOW,
        toOption,
      });
      expect(ids(json)).toEqual(["closing", "next"]);
    });

    it("leaves Android's payload and the phone widget's snapshot alone", () => {
      const snapshot = { ...savedSnapshot([]), conventions: history };
      const before = JSON.stringify(snapshot);
      withWatchExtras(snapshot, new Map(), { os: "ios", nowMs: NOW, toOption });
      expect(JSON.stringify(snapshot)).toBe(before);
      expect(
        ids(
          withWatchExtras(snapshot, new Map(), {
            os: "android",
            nowMs: NOW,
            toOption,
          }),
        ),
      ).toEqual(history.map((convention) => convention.id));
    });
  });

  it("leaves options off a convention that has none", () => {
    const saved = [row("saved", 30, { isInSchedule: true })];
    const payload = parse(
      withWatchExtras(savedSnapshot(saved), new Map([["con-1", saved]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
      }),
    );
    expect(payload.conventions[0]).not.toHaveProperty("options");
  });

  describe("size guard", () => {
    const long = (label: string) => `${label} ${"description ".repeat(40)}`;
    // 120 saved panels, a third already over, every one with a description,
    // and a full set of options: well past what WatchConnectivity accepts.
    const large = [
      ...Array.from({ length: 120 }, (_, index) =>
        row(`saved-${index}`, (index - 40) * 45, {
          isInSchedule: true,
          title: `Saved panel number ${index} with a long title`,
          description: long(`saved ${index}`),
        }),
      ),
      ...Array.from({ length: 30 }, (_, index) =>
        row(`option-${String(index).padStart(2, "0")}`, index * 10, {
          title: `Option panel number ${index} with a long title`,
          description: long(`option ${index}`),
        }),
      ),
    ];
    const build = (maxBytes?: number) =>
      withWatchExtras(savedSnapshot(large), new Map([["con-1", large]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
        maxBytes,
      });
    const unbounded = build(Number.POSITIVE_INFINITY);
    const ended = (event: WidgetEventSnapshot) =>
      (event.endAtMs ?? event.startAtMs + HOUR) <= NOW;

    it("starts over the limit", () => {
      expect(utf8ByteLength(unbounded)).toBeGreaterThan(
        WATCH_PAYLOAD_MAX_BYTES + 16 * 1024,
      );
      expect(parse(unbounded).conventions[0]?.options).toHaveLength(
        WATCH_OPTIONS_LIMIT,
      );
    });

    it("fits within 48 KB", () => {
      expect(utf8ByteLength(build())).toBeLessThanOrEqual(
        WATCH_PAYLOAD_MAX_BYTES,
      );
    });

    it("gives up option summaries before anything else", () => {
      const withoutOptionSummaries = utf8ByteLength(unbounded) - 4_000;
      const [convention] = parse(build(withoutOptionSummaries)).conventions;
      expect(convention?.options).toHaveLength(WATCH_OPTIONS_LIMIT);
      expect(convention?.options?.some((event) => event.summary)).toBe(false);
      expect(convention?.events.every((event) => event.summary)).toBe(true);
    });

    it("then summaries of saved panels that have ended, then the latest options", () => {
      const [convention] = parse(build()).conventions;
      expect(
        convention?.events.filter(ended).some((event) => event.summary),
      ).toBe(false);
      expect(
        convention?.events
          .filter((event) => !ended(event))
          .every((event) => event.summary),
      ).toBe(true);
      const kept = convention?.options ?? [];
      expect(kept.length).toBeLessThan(WATCH_OPTIONS_LIMIT);
      // Trimmed from the far end of the window, so what is left is a prefix.
      expect(kept.map((event) => event.id)).toEqual(
        (parse(unbounded).conventions[0]?.options ?? [])
          .slice(0, kept.length)
          .map((event) => event.id),
      );
    });

    /**
     * A convention past its end whose closing panel still runs gives up that
     * description in the same step as the running panels of the convention
     * that is on: last, with every other description.
     */
    it("keeps a closing panel's description until every description goes", () => {
      const closingNight = row("closing-night", -60, {
        conventionId: "closing",
        isInSchedule: true,
        durationMinutes: 120,
        description: long("closing night"),
      });
      const panel = toOption(closingNight);
      if (!panel) throw new Error("fixture");
      const closing: WidgetConventionSnapshot = {
        id: "closing",
        name: "Closing Con",
        startAtMs: NOW - 4 * DAY,
        endAtMs: NOW - 30 * MINUTE,
        timeZoneIdentifier: "America/Chicago",
        dateRangeLabel: "Aug 31 – Sep 4",
        events: [panel],
      };
      const snapshot = savedSnapshot(large);
      snapshot.conventions = [closing, ...snapshot.conventions];
      const events = new Map([
        ["closing", [closingNight]],
        ["con-1", large],
      ]);
      const sent = (maxBytes?: number, os = "ios") =>
        withWatchExtras(snapshot, events, {
          os,
          nowMs: NOW,
          toOption,
          maxBytes,
        });

      const fitted = sent();
      expect(utf8ByteLength(fitted)).toBeLessThanOrEqual(
        WATCH_PAYLOAD_MAX_BYTES,
      );
      const [kept, active] = parse(fitted).conventions;
      expect(kept?.events[0]?.summary).toBeDefined();
      expect(active?.options?.length).toBeLessThan(WATCH_OPTIONS_LIMIT);
      expect(active?.events.filter(ended).some((event) => event.summary)).toBe(
        false,
      );
      expect(sent(1_000)).toBe(sent(undefined, "android"));
    });

    it("keeps the handled command ids however much else goes", () => {
      const json = withWatchExtras(
        savedSnapshot(large),
        new Map([["con-1", large]]),
        {
          os: "ios",
          nowMs: NOW,
          toOption,
          handledCommandIds: ["cmd-1"],
          maxBytes: 1_000,
        },
      );
      expect(JSON.parse(json).handledCommandIds).toEqual(["cmd-1"]);
    });

    it("measures non-ASCII text by the bytes the phone sends", () => {
      // Fifty saved panels and a full set of options, every description in
      // Japanese (three bytes a character in UTF-8), a few with emoji: the
      // shape that measured twice as large once sent as a plist string.
      const japanese = (index: number) =>
        `第${index}回のパネルです。ファースーツの作り方、写真撮影、交流会について話します。🐾 ${"説明文".repeat(70)}`;
      const nonAscii = [
        ...Array.from({ length: 50 }, (_, index) =>
          row(`jp-saved-${index}`, (index - 10) * 30, {
            isInSchedule: true,
            title: `パネル ${index} – “ファースーツ”`,
            room: "ホール A",
            description: japanese(index),
          }),
        ),
        ...Array.from({ length: 30 }, (_, index) =>
          row(`jp-option-${String(index).padStart(2, "0")}`, index * 10, {
            title: `オプション ${index}`,
            description: japanese(index),
          }),
        ),
      ];
      const json = withWatchExtras(
        savedSnapshot(nonAscii),
        new Map([["con-1", nonAscii]]),
        { os: "ios", nowMs: NOW, toOption },
      );
      const unbounded = withWatchExtras(
        savedSnapshot(nonAscii),
        new Map([["con-1", nonAscii]]),
        { os: "ios", nowMs: NOW, toOption, maxBytes: Number.POSITIVE_INFINITY },
      );
      // Over the limit in UTF-8 even though it is under it in characters.
      expect(unbounded.length).toBeLessThan(WATCH_PAYLOAD_MAX_BYTES * 2);
      expect(Buffer.byteLength(unbounded, "utf8")).toBeGreaterThan(
        WATCH_PAYLOAD_MAX_BYTES,
      );
      expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(
        WATCH_PAYLOAD_MAX_BYTES,
      );
      // Running and coming panels keep their descriptions where they fit.
      expect(
        parse(json).conventions[0]?.events.some((event) => event.summary),
      ).toBe(true);
    });

    it("falls back to the plain snapshot when nothing else fits", () => {
      const plain = withWatchExtras(
        savedSnapshot(large),
        new Map([["con-1", large]]),
        { os: "android", nowMs: NOW, toOption },
      );
      expect(build(1_000)).toBe(plain);
    });
  });
});

/**
 * Saved panels the convention's feed cancelled or stopped listing. The phone
 * widget and the Watch's live lists leave them out; the Watch gets them in a
 * list of their own so it can show them struck through instead of dropping
 * them without a word.
 */
describe("withWatchExtras withdrawn panels", () => {
  // NOW is 10:20 in Chicago, so the convention's day began 620 minutes ago.
  const rows = [
    row("live", 30, { isInSchedule: true }),
    row("cancelled", 60, {
      isInSchedule: true,
      feedStatus: "cancelled",
      reminderMinutes: 15,
      description: "<p>Not happening.</p>",
    }),
    row("removed", 120, { isInSchedule: true, feedStatus: "removed" }),
    row("running", -20, { isInSchedule: true, feedStatus: "cancelled" }),
    row("over-today", -300, { isInSchedule: true, feedStatus: "cancelled" }),
    // 22:40-23:40 yesterday, convention time.
    row("over-yesterday", -700, {
      isInSchedule: true,
      feedStatus: "cancelled",
    }),
    // 23:30 yesterday to 01:00 today: Today lists panels by their start.
    row("past-midnight", -650, {
      isInSchedule: true,
      feedStatus: "removed",
      durationMinutes: 90,
    }),
    row("not-saved", 45, { feedStatus: "cancelled" }),
    row("drop-in-visit", -120, {
      isInSchedule: true,
      feedStatus: "cancelled",
      durationMinutes: 8 * 60,
      visitStartTime: new Date(NOW + 90 * MINUTE).toISOString(),
      visitEndTime: new Date(NOW + 120 * MINUTE).toISOString(),
    }),
    row("drop-in-without-visit", -120, {
      isInSchedule: true,
      feedStatus: "cancelled",
      durationMinutes: 8 * 60,
    }),
  ];
  /** The phone widget's snapshot: `eventSnapshot` drops marked rows. */
  const live = savedSnapshot(rows.filter((event) => event.feedStatus === null));
  /** Keeps whatever reminder the row holds, to show the payload drops it. */
  const keepingReminder = (event: ConventionEvent) => {
    const converted = toOption(event);
    return (
      converted && { ...converted, reminderMinutes: event.reminderMinutes }
    );
  };
  const send = (os = "ios") =>
    withWatchExtras(live, new Map([["con-1", rows]]), {
      os,
      nowMs: NOW,
      toOption: keepingReminder,
    });

  it("sends them marked, in a list of their own", () => {
    const [convention] = parse(send()).conventions;
    expect(convention?.events.map((event) => event.id)).toEqual(["live"]);
    expect(
      convention?.withdrawn?.map((event) => [event.id, event.status]),
    ).toEqual([
      ["over-today", "cancelled"],
      ["running", "cancelled"],
      ["cancelled", "cancelled"],
      ["drop-in-visit", "cancelled"],
      ["removed", "removed"],
    ]);
  });

  it("carries the planned times, no reminder and no description", () => {
    const withdrawn = parse(send()).conventions[0]?.withdrawn ?? [];
    expect(withdrawn.find((event) => event.id === "drop-in-visit")).toEqual(
      expect.objectContaining({
        startAtMs: NOW + 90 * MINUTE,
        endAtMs: NOW + 120 * MINUTE,
      }),
    );
    const cancelled = withdrawn.find((event) => event.id === "cancelled");
    expect(cancelled?.reminderMinutes).toBeNull();
    expect(cancelled).not.toHaveProperty("summary");
    expect(cancelled).toEqual(
      expect.objectContaining({ title: "cancelled", room: "Hall A" }),
    );
  });

  it("leaves Android's payload and the phone widget's snapshot alone", () => {
    const before = JSON.stringify(live);
    send();
    expect(JSON.stringify(live)).toBe(before);
    expect(send("android")).toBe(
      JSON.stringify({ ...live, presentation: undefined }),
    );
  });

  it("leaves the list off a convention with nothing withdrawn", () => {
    const saved = [row("saved", 30, { isInSchedule: true })];
    const [convention] = parse(
      withWatchExtras(savedSnapshot(saved), new Map([["con-1", saved]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
      }),
    ).conventions;
    expect(convention).not.toHaveProperty("withdrawn");
  });

  it("still sends what the Watch can show for a convention past its end", () => {
    const over = {
      ...live,
      conventions: live.conventions.map((convention) => ({
        ...convention,
        endAtMs: NOW - 30 * MINUTE,
      })),
    };
    const [convention] = parse(
      withWatchExtras(over, new Map([["con-1", rows]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
      }),
    ).conventions;
    expect(convention?.withdrawn?.map((event) => event.id)).toEqual([
      "over-today",
      "running",
      "cancelled",
      "drop-in-visit",
      "removed",
    ]);
    expect(convention).not.toHaveProperty("options");
  });

  describe("size guard", () => {
    const long = (label: string) => `${label} ${"description ".repeat(40)}`;
    const large = [
      ...Array.from({ length: 120 }, (_, index) =>
        row(`saved-${index}`, (index - 40) * 45, {
          isInSchedule: true,
          title: `Saved panel number ${index} with a long title`,
          description: long(`saved ${index}`),
        }),
      ),
      ...Array.from({ length: 30 }, (_, index) =>
        row(`option-${String(index).padStart(2, "0")}`, index * 10, {
          title: `Option panel number ${index} with a long title`,
          description: long(`option ${index}`),
        }),
      ),
      // Ten over earlier today, ten still to come.
      ...Array.from({ length: 20 }, (_, index) =>
        row(`withdrawn-${String(index).padStart(2, "0")}`, (index - 11) * 30, {
          isInSchedule: true,
          feedStatus: index % 2 === 0 ? "cancelled" : "removed",
          title: `Withdrawn panel number ${index} with a long title`,
          description: long(`withdrawn ${index}`),
        }),
      ),
    ];
    const snapshot = savedSnapshot(
      large.filter((event) => event.feedStatus === null),
    );
    const build = (maxBytes?: number) =>
      withWatchExtras(snapshot, new Map([["con-1", large]]), {
        os: "ios",
        nowMs: NOW,
        toOption,
        maxBytes,
      });
    const unbounded = parse(build(Number.POSITIVE_INFINITY));
    const ended = (event: WidgetEventSnapshot) =>
      (event.endAtMs ?? event.startAtMs + HOUR) <= NOW;
    const upcomingIds = (unbounded.conventions[0]?.withdrawn ?? [])
      .filter((event) => !ended(event))
      .map((event) => event.id);

    /** The payload once option summaries and ended panels' summaries go. */
    const afterEndedSummaries = (() => {
      const payload = parse(build(Number.POSITIVE_INFINITY));
      for (const convention of payload.conventions) {
        for (const option of convention.options ?? []) delete option.summary;
        for (const event of convention.events)
          if (ended(event)) delete event.summary;
      }
      return utf8ByteLength(JSON.stringify(payload));
    })();

    it("sends both kinds when there is room", () => {
      const withdrawn = unbounded.conventions[0]?.withdrawn ?? [];
      expect(withdrawn).toHaveLength(20);
      expect(upcomingIds).toHaveLength(10);
    });

    it("gives up the ones that are over after ended panels' summaries", () => {
      const kept = parse(build(afterEndedSummaries)).conventions[0];
      expect(kept?.withdrawn).toHaveLength(20);

      const trimmed = parse(build(afterEndedSummaries - 1)).conventions[0];
      expect(trimmed?.withdrawn?.map((event) => event.id)).toEqual(upcomingIds);
      // Before any option.
      expect(trimmed?.options).toHaveLength(WATCH_OPTIONS_LIMIT);
    });

    it("keeps the ones still to come through every option and description", () => {
      const fitted = build();
      expect(utf8ByteLength(fitted)).toBeLessThanOrEqual(
        WATCH_PAYLOAD_MAX_BYTES,
      );
      const [convention] = parse(fitted).conventions;
      expect(convention?.withdrawn?.map((event) => event.id)).toEqual(
        upcomingIds,
      );
      expect(convention?.options?.length ?? 0).toBeLessThan(
        WATCH_OPTIONS_LIMIT,
      );

      // Every option and description gone, and still too large: only then.
      const bare = parse(build(Number.POSITIVE_INFINITY));
      for (const convention of bare.conventions) {
        delete convention.options;
        for (const event of convention.events) delete event.summary;
        convention.withdrawn = convention.withdrawn?.filter(
          (event) => !ended(event),
        );
      }
      const lastStep = utf8ByteLength(JSON.stringify(bare));
      expect(
        parse(build(lastStep)).conventions[0]?.withdrawn?.map(
          (event) => event.id,
        ),
      ).toEqual(upcomingIds);
      expect(parse(build(lastStep - 1)).conventions[0]).not.toHaveProperty(
        "withdrawn",
      );
    });

    it("falls back to the plain snapshot when nothing else fits", () => {
      expect(build(1_000)).toBe(
        withWatchExtras(snapshot, new Map([["con-1", large]]), {
          os: "android",
          nowMs: NOW,
          toOption,
        }),
      );
    });
  });
});
