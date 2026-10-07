import { describe, expect, it } from "vitest";
import {
  getPublishedSnapshot,
  listPublishedSnapshots,
  type PublishedCatalogDatabase,
  parsePublicSnapshot,
} from "./public-catalog";

const snapshot = {
  id: "demo-id",
  slug: "demo-con",
  name: "Demo Con",
  acronym: "DC",
  city: "Sample City",
  region: "EX",
  country: "United States",
  startsOn: "2030-10-12",
  endsOn: "2030-10-14",
  timezone: "America/Chicago",
  venue: "Sample Hall",
  availability: "open",
  scheduleStatus: "partial",
  revision: 2,
  sessions: [
    {
      id: "event-one",
      title: "Welcome",
      description: "Demo session",
      room: "Main Hall",
      startsAt: "2030-10-12T10:00",
      endsAt: "2030-10-12T11:00",
      status: "scheduled",
      privateStaffNote: "Do not expose",
    },
  ],
  officialUrl: "https://organizer.example/private",
  sourceVerifiedAt: "2030-10-01",
};

function fakeD1(
  rows: Array<{ snapshot_json: string }>,
  first?: { snapshot_json: string },
) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const database = {
    prepare(sql: string) {
      const call = { sql, values: [] as unknown[] };
      calls.push(call);
      return {
        bind(...values: unknown[]) {
          call.values = values;
          return {
            first: async () => first ?? null,
          };
        },
        all: async () => ({ results: rows }),
      };
    },
  } as unknown as PublishedCatalogDatabase;
  return { database, calls };
}

describe("published convention API data", () => {
  it("returns only the current published snapshot rows and strips private fields", async () => {
    const { database, calls } = fakeD1([
      { snapshot_json: JSON.stringify(snapshot) },
    ]);

    const result = await listPublishedSnapshots(database);

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("officialUrl");
    expect(result[0]).not.toHaveProperty("sourceVerifiedAt");
    expect(result[0]?.sessions[0]).not.toHaveProperty("privateStaffNote");
    expect(calls[0]?.sql).toContain("c.published_revision = r.revision");
    expect(calls[0]?.sql).toContain("c.status = 'published'");
    expect(calls[0]?.sql).toContain("r.snapshot_json");
    expect(calls[0]?.sql).not.toContain("c.official_url");
  });

  it("looks up by the unique current published slug", async () => {
    const { database, calls } = fakeD1([], {
      snapshot_json: JSON.stringify(snapshot),
    });

    const result = await getPublishedSnapshot(database, "demo-con");

    expect(result?.slug).toBe("demo-con");
    expect(calls[0]?.values).toEqual(["demo-con"]);
    expect(calls[0]?.sql).toContain("c.published_slug = ?");
    expect(calls[0]?.sql).not.toContain(
      "json_extract(r.snapshot_json, '$.slug')",
    );
    expect(calls[0]?.sql).not.toContain("c.slug");
  });

  it("rejects malformed stored snapshots rather than returning guessed data", () => {
    expect(() => parsePublicSnapshot("not json")).toThrow("valid JSON");
    expect(() =>
      parsePublicSnapshot(JSON.stringify({ ...snapshot, revision: -1 })),
    ).toThrow("public schema");
  });
});
