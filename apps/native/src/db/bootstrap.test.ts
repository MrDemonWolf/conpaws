import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { initializeDatabase, MIGRATION_1_SQL } from "./bootstrap";

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

describe("database bootstrap", () => {
  it("creates the current schema and cascades convention deletion", () => {
    const database = new DatabaseSync(":memory:");
    initializeDatabase(migrationAdapter(database));

    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date, time_zone)
      VALUES (
        'con-1',
        'Test Con',
        '2026-01-01',
        '2026-01-02',
        'America/Chicago'
      );
      INSERT INTO convention_events (id, convention_id, title, start_time)
      VALUES ('event-1', 'con-1', 'Opening', '2026-01-01T15:00:00Z');
      DELETE FROM conventions WHERE id = 'con-1';
    `);

    const eventCount = database
      .prepare("SELECT COUNT(*) AS count FROM convention_events")
      .get();
    const version = database.prepare("PRAGMA user_version").get();

    expect(eventCount).toEqual({ count: 0 });
    expect(version).toEqual({ user_version: 6 });
    database.close();
  });

  it("migrates v1 rows without losing data", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(MIGRATION_1_SQL);
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date)
      VALUES ('legacy-con', 'Legacy Con', '2026-01-01', '2026-01-02');
    `);

    initializeDatabase(migrationAdapter(database));
    initializeDatabase(migrationAdapter(database));

    const convention = database
      .prepare(
        "SELECT name, time_zone, location, archived_at FROM conventions WHERE id = ?",
      )
      .get("legacy-con");

    expect(convention).toEqual({
      name: "Legacy Con",
      time_zone: null,
      location: null,
      archived_at: null,
    });
    database.close();
  });

  it("adds age_rating to events without touching existing rows", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(MIGRATION_1_SQL);
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date)
      VALUES ('con-1', 'Con', '2026-01-01', '2026-01-02');
      INSERT INTO convention_events (id, convention_id, title, start_time)
      VALUES ('event-1', 'con-1', 'Opening', '2026-01-01T15:00:00Z');
    `);

    initializeDatabase(migrationAdapter(database));

    expect(
      database
        .prepare("SELECT title, age_rating FROM convention_events WHERE id = ?")
        .get("event-1"),
    ).toEqual({ title: "Opening", age_rating: null });
    database.close();
  });

  it("repairs an interrupted v3 migration without retrying ADD COLUMN", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(MIGRATION_1_SQL);
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date)
      VALUES ('legacy-con', 'Legacy Con', '2026-01-01', '2026-01-02');
      ALTER TABLE conventions ADD COLUMN time_zone TEXT;
      ALTER TABLE conventions ADD COLUMN location TEXT;
      PRAGMA user_version = 2;
    `);

    initializeDatabase(migrationAdapter(database));
    initializeDatabase(migrationAdapter(database));

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 6,
    });
    expect(
      database
        .prepare("SELECT id, location FROM conventions WHERE id = ?")
        .get("legacy-con"),
    ).toEqual({ id: "legacy-con", location: null });
    database.close();
  });

  it("repairs an interrupted v2 migration without retrying ADD COLUMN", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(MIGRATION_1_SQL);
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date)
      VALUES ('legacy-con', 'Legacy Con', '2026-01-01', '2026-01-02');
      ALTER TABLE conventions ADD COLUMN time_zone TEXT;
    `);

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });

    initializeDatabase(migrationAdapter(database));
    initializeDatabase(migrationAdapter(database));

    expect(database.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 6,
    });
    expect(
      database
        .prepare(
          "SELECT id, name, time_zone, location FROM conventions WHERE id = ?",
        )
        .get("legacy-con"),
    ).toEqual({
      id: "legacy-con",
      name: "Legacy Con",
      time_zone: null,
      location: null,
    });
    database.close();
  });

  // v2 and v3 already have interrupted-repair coverage above; these complete
  // the matrix so every rung of the ladder proves the same recovery property.
  it.each([
    { column: "archived_at", table: "conventions" },
    { column: "age_rating", table: "convention_events" },
    { column: "feed_status", table: "convention_events" },
  ])(
    "repairs an interrupted $column migration without retrying ADD COLUMN",
    ({ column, table }) => {
      const database = new DatabaseSync(":memory:");
      database.exec(MIGRATION_1_SQL);
      database.exec(`
        INSERT INTO conventions (id, name, start_date, end_date)
        VALUES ('legacy-con', 'Legacy Con', '2026-01-01', '2026-01-02');
        ALTER TABLE ${table} ADD COLUMN ${column} TEXT;
      `);

      initializeDatabase(migrationAdapter(database));
      initializeDatabase(migrationAdapter(database));

      expect(database.prepare("PRAGMA user_version").get()).toEqual({
        user_version: 6,
      });
      expect(
        database
          .prepare("SELECT name FROM conventions WHERE id = ?")
          .get("legacy-con"),
      ).toEqual({ name: "Legacy Con" });
      database.close();
    },
  );

  it("keeps every migration past the initial schema additive-only", async () => {
    // The no-data-loss guarantee rests on migrations never rewriting or
    // dropping user data. Nothing structural enforces that, so this tripwire
    // does: a future migration containing destructive SQL fails here and has
    // to argue its case in a code review instead of shipping silently.
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./bootstrap.ts", import.meta.url), "utf8"),
    );
    // Anchored on `export const` so the COMPLETE_MIGRATION_* version-bump
    // constants (which legitimately contain no ADD COLUMN) don't match.
    const migrations =
      source.match(/export const MIGRATION_\d+_SQL = `([^`]+)`/g) ?? [];
    expect(migrations.length).toBeGreaterThanOrEqual(5);
    for (const migration of migrations) {
      if (migration.includes("MIGRATION_1_SQL")) continue; // initial CREATEs
      expect(migration).not.toMatch(
        /\b(DROP|DELETE|TRUNCATE|UPDATE|REPLACE)\b/i,
      );
      expect(migration).toMatch(/ADD COLUMN/);
    }
  });
});
