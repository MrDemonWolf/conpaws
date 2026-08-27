import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { initializeDatabase, LATEST_SCHEMA_VERSION } from "./bootstrap";

function migrationAdapter(database: DatabaseSync) {
  return {
    execSync(source: string) {
      database.exec(source);
    },
    getFirstSync<T>(source: string): T | null {
      return (database.prepare(source).get() as T | undefined) ?? null;
    },
  };
}

describe("schema version ladder", () => {
  it("refuses a database written by a newer build", () => {
    const database = new DatabaseSync(":memory:");
    initializeDatabase(migrationAdapter(database));
    database.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1};`);

    expect(() => initializeDatabase(migrationAdapter(database))).toThrow(
      /newer than the/,
    );
    database.close();
  });

  it("still opens a database at exactly the version it understands", () => {
    const database = new DatabaseSync(":memory:");
    initializeDatabase(migrationAdapter(database));

    expect(() => initializeDatabase(migrationAdapter(database))).not.toThrow();
    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: LATEST_SCHEMA_VERSION,
    });
    database.close();
  });
});
