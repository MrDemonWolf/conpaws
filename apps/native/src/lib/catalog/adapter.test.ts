import { describe, expect, it } from "vitest";
import { editionToDraft, sessionsToImport } from "./adapter";
import type { CatalogEdition } from "./types";

const baseEdition: CatalogEdition = {
  id: "edition-1",
  slug: "sample-con",
  name: "Sample Con",
  acronym: "SC",
  city: "Sample Harbor",
  region: "Sample Region",
  country: "Sample Country",
  startsOn: "2026-10-20",
  endsOn: "2026-10-22",
  timezone: "America/New_York",
  venue: "Sample Hall",
  availability: "unknown",
  scheduleStatus: "complete",
  revision: 4,
  sessions: [],
};

const session = {
  id: "stable-panel-id",
  title: "Opening panel",
  description: "A sample description",
  room: "Main Hall",
  startsAt: "2026-10-20T10:00",
  endsAt: "2026-10-20T11:00",
  status: "scheduled" as const,
};

describe("catalog schedule adapter", () => {
  it("converts local wall-clock times to instants and stable source identities", () => {
    const result = sessionsToImport(
      { ...baseEdition, sessions: [session] },
      {
        scheduleUrl:
          "https://api.conpaws.com/v1/conventions/sample-con/schedule",
      },
    );

    expect(result.parsedEvents[0]).toMatchObject({
      title: "Opening panel",
      sourceUid: "stable-panel-id",
      sourceUrl: "https://api.conpaws.com/v1/conventions/sample-con/schedule",
      startTime: new Date("2026-10-20T14:00:00.000Z"),
      endTime: new Date("2026-10-20T15:00:00.000Z"),
    });
    expect(result.sourceSnapshot).toMatchObject({
      authoritative: true,
      activeOccurrences: [{ sourceUid: "stable-panel-id" }],
      cancelledOccurrences: [],
    });
  });

  it("records cancelled sessions as tombstones and clamps inverted ends", () => {
    const result = sessionsToImport(
      {
        ...baseEdition,
        sessions: [
          { ...session, status: "cancelled" },
          {
            ...session,
            id: "bad-end",
            startsAt: "2026-10-20T12:00",
            endsAt: "2026-10-20T11:00",
          },
        ],
      },
      { scheduleUrl: "https://catalog.test/schedule" },
    );

    expect(result.parsedEvents).toHaveLength(1);
    expect(result.parsedEvents[0].endTime).toBeNull();
    expect(result.sourceSnapshot.cancelledOccurrences).toMatchObject([
      { sourceUid: "stable-panel-id", title: "Opening panel" },
    ]);
  });

  it("drops wall-clock values in a daylight-saving gap", () => {
    const result = sessionsToImport(
      {
        ...baseEdition,
        sessions: [
          {
            ...session,
            startsAt: "2026-03-08T02:30",
            endsAt: "2026-03-08T03:30",
          },
        ],
      },
      { scheduleUrl: "https://catalog.test/schedule" },
    );

    expect(result.parsedEvents).toEqual([]);
    expect(result.sourceSnapshot.activeOccurrences).toEqual([]);
  });

  it("maps the edition metadata to the existing convention draft shape", () => {
    expect(editionToDraft(baseEdition)).toMatchObject({
      name: "Sample Con",
      startDate: "2026-10-20",
      endDate: "2026-10-22",
      timeZone: "America/New_York",
      location: "Sample Hall · Sample Harbor",
      icalUrl: null,
      catalogSlug: "sample-con",
      catalogRevision: 4,
    });
  });
});
