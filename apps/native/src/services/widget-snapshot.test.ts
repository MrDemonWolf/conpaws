import { describe, expect, it, vi } from "vitest";
import type { Convention, ConventionEvent } from "@/db/schema";
import {
  buildWidgetPresentation,
  buildWidgetSnapshot,
} from "./widget-snapshot";

vi.mock("expo", () => ({ requireOptionalNativeModule: () => null }));
vi.mock("expo-constants", () => ({ default: { expoConfig: {} } }));
vi.mock("expo-localization", () => ({
  getCalendars: () => [{ uses24hourClock: true }],
}));
vi.mock("@/lib/appearance-storage", () => ({
  getAppearancePreference: () => "system",
}));
vi.mock("@/lib/device-clock", () => ({
  getTimeFormatPreference: () => "system",
}));
vi.mock("@/db/repositories/conventions", () => ({ getAll: vi.fn() }));
vi.mock("@/db/repositories/events", () => ({ getByConventionId: vi.fn() }));
vi.mock("@/lib/i18n", () => ({
  default: {
    t: (key: string, values: { start?: string; end?: string; lng?: string }) =>
      key.startsWith("convention.ageRatings.")
        ? `pill:${key.split(".").pop()}:${values.lng}`
        : key === "home.dateRange"
          ? `${values.start} – ${values.end}`
          : `${key}:${values.lng}`,
  },
}));

describe("widget presentation", () => {
  it("uses paired native tokens when Material colors are unavailable", () => {
    expect(buildWidgetPresentation(null, null, "system", "en")).toMatchObject({
      palette: { light: { background: "#ffffff", accent: "#005575" } },
    });
  });

  it("preserves paired Material roles, strips trailing alpha and uses app language", () => {
    const light = {
      surfaceContainer: "#F0F1F2FF",
      onSurface: "#101112FF",
      onSurfaceVariant: "#404142FF",
      primary: "#005575FF",
    } as const;
    const dark = {
      ...light,
      surfaceContainer: "#101112FF",
      onSurface: "#F0F1F2FF",
    } as const;
    const presentation = buildWidgetPresentation(light, dark, "dark", "de");
    expect(presentation).toMatchObject({
      appearance: "dark",
      palette: {
        light: {
          background: "#F0F1F2",
          foreground: "#101112",
          secondary: "#404142",
          accent: "#005575",
        },
        dark: { background: "#101112", foreground: "#F0F1F2" },
      },
      labels: {
        next: "convention.now.upNext:de",
        current: "convention.now.happeningNow:de",
      },
    });
    // Without the container roles the card colours are derived, not missing.
    expect(presentation.palette.light).toMatchObject({
      container: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      onContainer: "#101112",
      track: expect.stringMatching(/^#[0-9a-f]{6}$/i),
    });
  });

  it("passes the container and track roles without their alpha", () => {
    const colors = {
      surfaceContainer: "#F0F1F2FF",
      onSurface: "#101112FF",
      onSurfaceVariant: "#404142FF",
      primary: "#005575FF",
      primaryContainer: "#C4E7FFFF",
      onPrimaryContainer: "#001E2CFF",
      surfaceContainerHighest: "#E0E3E8FF",
    } as const;
    const { palette } = buildWidgetPresentation(colors, colors, "light", "en");
    expect(palette.dark).toEqual({
      background: "#F0F1F2",
      foreground: "#101112",
      secondary: "#404142",
      accent: "#005575",
      container: "#C4E7FF",
      onContainer: "#001E2C",
      track: "#E0E3E8",
    });
  });

  it("derives readable container fallbacks from the theme tokens", () => {
    const { palette } = buildWidgetPresentation(null, null, "system", "en");
    // 16% of the brand primary over the plain surface.
    expect(palette.light.container).toBe("#d6e4e9");
    expect(palette.dark).toMatchObject({
      container: "#041d27",
      onContainer: "#ffffff",
    });
  });

  it("reuses translated app phrases as widget templates with named slots", () => {
    const { labels } = buildWidgetPresentation(null, null, "system", "fr");
    expect(labels).toMatchObject({
      until: "convention.plan.until:fr",
      nextAt: "convention.now.next:fr",
      inDays: "home.countdown.days:fr",
      checkedAt: "convention.scheduleUpdate.checkedAt:fr",
      finishedHint: "schedule.caughtUp.subtitle:fr",
    });
  });
});

const convention: Convention = {
  id: "con-1",
  name: "ConPaws",
  startDate: "2026-09-03",
  endDate: "2026-09-06",
  timeZone: "America/Chicago",
  location: null,
  archivedAt: null,
  icalUrl: null,
  catalogSlug: null,
  catalogRevision: null,
  status: "upcoming",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function event(
  id: string,
  startTime: string,
  isInSchedule: boolean,
): ConventionEvent {
  return {
    id,
    conventionId: convention.id,
    title: id,
    description: null,
    startTime,
    endTime: null,
    location: null,
    room: null,
    category: null,
    type: null,
    isInSchedule,
    reminderMinutes: 15,
    sourceUid: null,
    sourceUrl: null,
    isAgeRestricted: false,
    ageRating: null,
    contentWarning: false,
    feedStatus: null,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

describe("buildWidgetSnapshot", () => {
  it.each(["system", "12", "24"] as const)(
    "carries the %s clock choice without changing the snapshot schema",
    (timeFormat) => {
      const snapshot = buildWidgetSnapshot(
        [],
        new Map(),
        "en",
        1000,
        timeFormat,
      );
      expect(snapshot.schemaVersion).toBe(2);
      expect(snapshot.timeFormat).toBe(timeFormat);
    },
  );

  it("uses convention time and includes only scheduled events in time order", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            event("later", "2026-09-03T16:00:00-05:00", true),
            event("not-saved", "2026-09-03T14:00:00-05:00", false),
            event("first", "2026-09-03T15:00:00-05:00", true),
          ],
        ],
      ]),
      "en",
      123,
    );

    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.generatedAtMs).toBe(123);
    expect(snapshot.conventions[0]?.startAtMs).toBe(
      Date.parse("2026-09-03T00:00:00-05:00"),
    );
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "first",
      "later",
    ]);
  });

  it("drops an archived convention, saved events and all", () => {
    const snapshot = buildWidgetSnapshot(
      [
        { ...convention, archivedAt: "2026-08-01T00:00:00Z" },
        { ...convention, id: "con-2", name: "Still going", archivedAt: null },
      ],
      new Map([
        [convention.id, [event("archived", "2026-09-03T15:00:00-05:00", true)]],
      ]),
      "en",
      123,
    );

    // Archiving cancels the convention's reminders and refuses tracking, so
    // the widget and Watch must not offer it as the next thing to go to.
    expect(snapshot.conventions.map(({ id }) => id)).toEqual(["con-2"]);
  });

  it("clamps inverted convention dates and nulls an inverted event end", () => {
    const invertedConvention = { ...convention, endDate: "2026-09-02" };
    const malformed = {
      ...event("bad-end", "2026-09-03T15:00:00Z", true),
      endTime: "2026-09-03T14:00:00Z",
    };
    const snapshot = buildWidgetSnapshot(
      [invertedConvention],
      new Map([[convention.id, [malformed]]]),
      "en",
      123,
    );
    expect(snapshot.conventions[0]?.endAtMs).toBe(
      snapshot.conventions[0]?.startAtMs,
    );
    expect(snapshot.conventions[0]?.events[0]?.endAtMs).toBeNull();
  });

  it("leaves a saved event out once the feed stops publishing it", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            {
              ...event("cancelled", "2026-09-03T15:00:00-05:00", true),
              feedStatus: "cancelled" as const,
            },
            {
              ...event("dropped", "2026-09-03T16:00:00-05:00", true),
              feedStatus: "removed" as const,
            },
            event("running", "2026-09-03T17:00:00-05:00", true),
          ],
        ],
      ]),
      "en",
      123,
    );

    // The phone still shows these, marked, because the user needs to know what
    // happened. The widget and the Watch only answer "what is next", and a
    // panel that is not happening is never the answer.
    expect(snapshot.conventions[0]?.events.map(({ id }) => id)).toEqual([
      "running",
    ]);
  });

  it("localizes restrictive age ratings into pill labels and drops the rest", () => {
    const snapshot = buildWidgetSnapshot(
      [convention],
      new Map([
        [
          convention.id,
          [
            {
              ...event("teen", "2026-09-03T15:00:00-05:00", true),
              ageRating: "teen" as const,
            },
            {
              ...event("adult", "2026-09-03T16:00:00-05:00", true),
              ageRating: "adult" as const,
            },
            {
              ...event("all", "2026-09-03T17:00:00-05:00", true),
              ageRating: "all-ages" as const,
            },
            event("unrated", "2026-09-03T18:00:00-05:00", true),
          ],
        ],
      ]),
      "de",
    );

    expect(
      snapshot.conventions[0]?.events.map(({ id, ageRating }) => [
        id,
        ageRating,
      ]),
    ).toEqual([
      ["teen", "pill:teen:de"],
      ["adult", "pill:adult:de"],
      ["all", null],
      ["unrated", null],
    ]);
  });

  it.each([
    ["2024-02-29", true],
    ["2025-02-29", false],
    ["2026-04-30", true],
    ["2026-04-31", false],
  ])("validates calendar date %s", (date, isValid) => {
    const snapshot = buildWidgetSnapshot(
      [{ ...convention, startDate: date, endDate: date }],
      new Map(),
      "en",
    );

    expect(snapshot.conventions).toHaveLength(isValid ? 1 : 0);
  });
});

it("publishes personal visit times to Widget and Watch, omitting invalidated visits", () => {
  const visit = {
    ...event("market", "2026-09-03T10:00:00-05:00", true),
    endTime: "2026-09-03T18:00:00-05:00",
    visitStartTime: "2026-09-03T16:00:00-05:00",
    visitEndTime: "2026-09-03T16:30:00-05:00",
  };
  const build = (row: ConventionEvent) =>
    buildWidgetSnapshot([convention], new Map([[convention.id, [row]]]), "en")
      .conventions[0].events;
  expect(build(visit)[0]).toMatchObject({
    startAtMs: Date.parse(visit.visitStartTime),
    endAtMs: Date.parse(visit.visitEndTime),
  });
  expect(build({ ...visit, endTime: "2026-09-03T15:00:00-05:00" })).toEqual([]);
});
