import { describe, expect, it } from "vitest";
import {
  conventionInputSchema,
  getPublicationIssues,
  getSnapshotChanges,
  scheduleEventInputSchema,
  toPublicConvention,
} from "./catalog";

const validConvention = {
  name: "Furry Convention",
  acronym: "FC",
  slug: "furry-convention",
  city: "Seattle",
  region: "WA",
  country: "United States",
  startsOn: "2027-02-26",
  endsOn: "2027-02-28",
  timezone: "America/Los_Angeles",
  venue: "Convention Center",
  officialUrl: "https://example.org",
  availability: "unknown" as const,
  scheduleStatus: "not-released" as const,
};

describe("convention catalog validation", () => {
  it("accepts valid convention details and rejects impossible dates or insecure links", () => {
    expect(conventionInputSchema.safeParse(validConvention).success).toBe(true);
    expect(
      conventionInputSchema.safeParse({
        ...validConvention,
        startsOn: "2027-02-30",
      }).success,
    ).toBe(false);
    expect(
      conventionInputSchema.safeParse({
        ...validConvention,
        officialUrl: "http://example.org",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed local schedule date-times and reversed sessions", () => {
    expect(
      scheduleEventInputSchema.safeParse({
        title: "Opening ceremony",
        description: "",
        room: "Main hall",
        startsAt: "2027-02-30T10:00",
        endsAt: "2027-02-30T11:00",
        status: "scheduled",
      }).success,
    ).toBe(false);
    expect(
      scheduleEventInputSchema.safeParse({
        title: "Opening ceremony",
        startsAt: "2027-02-26T11:00",
        endsAt: "2027-02-26T10:00",
      }).success,
    ).toBe(false);
  });

  it("keeps organizer-only fields out of the attendee snapshot", () => {
    const convention = {
      ...validConvention,
      id: "convention-id",
      venue: "Convention Center",
      createdBy: "private@example.org",
      officialUrl: "https://organizer.example.org/private",
    };
    const snapshot = toPublicConvention({
      convention,
      revision: 1,
      sessions: [],
    });

    expect(snapshot).not.toHaveProperty("officialUrl");
    expect(snapshot).not.toHaveProperty("createdBy");
    expect(JSON.stringify(snapshot)).not.toContain("private@example.org");
  });

  it("blocks publication until source provenance and schedule status agree", () => {
    const convention = conventionInputSchema.parse({
      ...validConvention,
      sourceVerifiedAt: "",
    });
    expect(
      getPublicationIssues({ convention, sessions: [], today: "2026-10-04" }),
    ).toContain("Record the date you checked the organizer source.");

    const checked = conventionInputSchema.parse({
      ...validConvention,
      sourceVerifiedAt: "2026-10-04",
      scheduleStatus: "partial",
    });
    expect(
      getPublicationIssues({
        convention: checked,
        sessions: [],
        today: "2026-10-04",
      }),
    ).toContain("Add at least one session or mark the schedule not released.");
  });

  it("shows attendee-visible convention and session changes before publishing", () => {
    const previous = {
      id: "convention-id",
      slug: "furry-convention",
      name: "Furry Convention",
      acronym: "FC",
      city: "Seattle",
      region: "WA",
      country: "United States",
      startsOn: "2027-02-26",
      endsOn: "2027-02-28",
      timezone: "America/Los_Angeles",
      venue: "Convention Center",
      availability: "unknown" as const,
      scheduleStatus: "not-released" as const,
      revision: 1,
      sessions: [],
    };
    const next = {
      ...previous,
      availability: "open" as const,
      revision: 2,
      sessions: [
        {
          id: "welcome",
          title: "Opening ceremony",
          description: "",
          room: "Main hall",
          startsAt: "2027-02-26T10:00",
          endsAt: "2027-02-26T11:00",
          status: "scheduled" as const,
        },
      ],
    };
    expect(getSnapshotChanges(previous, next)).toEqual([
      "Registration: unknown → open",
      "Added session: Opening ceremony (2027-02-26T10:00–2027-02-26T11:00 · Main hall).",
    ]);
  });
});
