import type { PublishedCatalogDatabase } from "./catalog";

/**
 * Fixtures shared by the API tests. A published snapshot carrying the private
 * fields the public schema must strip, and a fake D1 that records its calls.
 */
export const snapshot = {
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

export function fakeD1(
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
