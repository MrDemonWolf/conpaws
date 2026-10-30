import { describe, expect, it } from "vitest";
import {
  getPublishedSnapshot,
  listPublishedSnapshots,
  parsePublicSnapshot,
} from "./catalog";
import { fakeD1, snapshot } from "./test-support";

describe("published convention data", () => {
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
