import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { adminInvites, adminSessions, adminSignInCodes } from "../db/schema";
import { addMember, createTestCatalog } from "./d1-sqlite";

describe("the catalog migrations", () => {
  it("create the sign-in tables with the columns the Drizzle schema declares", () => {
    const catalog = createTestCatalog();
    for (const table of [adminInvites, adminSignInCodes, adminSessions]) {
      const config = getTableConfig(table);
      const columns = catalog
        .rows<{ name: string }>(`PRAGMA table_info(${config.name})`)
        .map((column) => column.name)
        .sort();
      expect(columns, config.name).toEqual(
        config.columns.map((column) => column.name).sort(),
      );
      const indexes = catalog
        .rows<{ name: string }>(`PRAGMA index_list(${config.name})`)
        .map((index) => index.name);
      for (const index of config.indexes) {
        expect(indexes, config.name).toContain(index.config.name);
      }
    }
  });

  it("drops a member's sessions when the member is deleted", () => {
    const catalog = createTestCatalog();
    addMember(catalog, "a@example.com");
    catalog.exec(
      "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at) VALUES ('h', 'a@example.com', 0, 1, 0)",
    );
    catalog.exec("DELETE FROM admin_members WHERE email = 'a@example.com'");
    expect(catalog.rows("SELECT * FROM admin_sessions")).toEqual([]);
  });

  it("refuses a session for an address that is not a member", () => {
    const catalog = createTestCatalog();
    expect(() =>
      catalog.exec(
        "INSERT INTO admin_sessions (token_hash, email, created_at, expires_at, verified_at) VALUES ('h', 'nobody@example.com', 0, 1, 0)",
      ),
    ).toThrow(/FOREIGN KEY/);
  });
});
