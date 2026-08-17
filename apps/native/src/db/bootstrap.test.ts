import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { BOOTSTRAP_SQL } from "./bootstrap";

describe("database bootstrap", () => {
  it("creates the v1 tables and cascades convention deletion", () => {
    const database = new DatabaseSync(":memory:");

    database.exec(BOOTSTRAP_SQL);
    database.exec(`
      INSERT INTO conventions (id, name, start_date, end_date)
      VALUES ('con-1', 'Test Con', '2026-01-01', '2026-01-02');
      INSERT INTO convention_events (id, convention_id, title, start_time)
      VALUES ('event-1', 'con-1', 'Opening', '2026-01-01T09:00:00Z');
      DELETE FROM conventions WHERE id = 'con-1';
    `);

    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all()
      .map((row) => row.name);
    const eventCount = database
      .prepare("SELECT COUNT(*) AS count FROM convention_events")
      .get();

    expect(tables).toEqual([
      "convention_events",
      "conventions",
      "offline_queue",
    ]);
    expect(eventCount).toEqual({ count: 0 });
    database.close();
  });
});
