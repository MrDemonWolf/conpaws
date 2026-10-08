import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { conventions } from "./schema";

describe("published convention slug storage", () => {
  it("keeps a unique index over active published slugs", () => {
    const config = getTableConfig(conventions);
    expect(config.columns.map((column) => column.name)).toContain(
      "published_slug",
    );
    const index = config.indexes.find(
      (candidate) =>
        candidate.config.name === "conventions_published_slug_unique",
    );
    expect(index?.config.unique).toBe(true);
    expect(index?.config.where).toBeDefined();
  });
});
