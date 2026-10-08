import { describe, expect, it } from "vitest";
import {
  isCatalogEdition,
  isCatalogListResponse,
  isCatalogScheduleResponse,
} from "./types";

const session = {
  id: "panel-1",
  title: "Opening panel",
  description: "",
  room: "Main Hall",
  startsAt: "2026-10-20T10:00",
  endsAt: "2026-10-20T11:00",
  status: "scheduled",
};

const edition = {
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
  revision: 1,
  sessions: [session],
};

describe("catalog response guards", () => {
  it("accepts public list, edition, and schedule shapes", () => {
    expect(isCatalogEdition(edition)).toBe(true);
    expect(isCatalogListResponse({ version: 1, conventions: [edition] })).toBe(
      true,
    );
    expect(
      isCatalogScheduleResponse({
        version: 1,
        conventionId: edition.id,
        slug: edition.slug,
        revision: edition.revision,
        timezone: edition.timezone,
        status: edition.scheduleStatus,
        sessions: edition.sessions,
      }),
    ).toBe(true);
  });

  it.each([
    { ...edition, revision: 0 },
    { ...edition, startsOn: "2026-02-30" },
    { ...edition, timezone: "Mars/Olympus_Mons" },
    { ...edition, sessions: [{ ...session, startsAt: "not-a-time" }] },
    {
      ...edition,
      sessions: [
        {
          ...session,
          startsAt: "2026-03-08T02:30",
          endsAt: "2026-03-08T03:30",
        },
      ],
    },
  ])("rejects malformed edition data", (value) => {
    expect(isCatalogEdition(value)).toBe(false);
  });

  it("rejects malformed list and schedule envelopes", () => {
    expect(isCatalogListResponse({ version: 2, conventions: [] })).toBe(false);
    expect(isCatalogListResponse({ version: 1, conventions: [null] })).toBe(
      false,
    );
    expect(
      isCatalogScheduleResponse({
        version: 1,
        conventionId: "id",
        slug: "slug",
        revision: 1,
        timezone: "America/New_York",
        status: "partial",
        sessions: [{ ...session, endsAt: "2026-13-20T11:00" }],
      }),
    ).toBe(false);
  });
});
