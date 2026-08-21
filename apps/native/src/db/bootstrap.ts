export const CONNECTION_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

export const MIGRATION_1_SQL = `
CREATE TABLE IF NOT EXISTS conventions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  ical_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS convention_events (
  id TEXT PRIMARY KEY NOT NULL,
  convention_id TEXT NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  location TEXT,
  room TEXT,
  category TEXT,
  type TEXT,
  is_in_schedule INTEGER NOT NULL DEFAULT 0,
  reminder_minutes INTEGER,
  source_uid TEXT,
  source_url TEXT,
  is_age_restricted INTEGER NOT NULL DEFAULT 0,
  content_warning INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS convention_events_convention_id_idx
  ON convention_events(convention_id);

CREATE TABLE IF NOT EXISTS offline_queue (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

PRAGMA user_version = 1;
`;

export const MIGRATION_2_SQL = `
BEGIN IMMEDIATE;
ALTER TABLE conventions ADD COLUMN time_zone TEXT;
PRAGMA user_version = 2;
COMMIT;
`;

const COMPLETE_MIGRATION_2_SQL = `
BEGIN IMMEDIATE;
PRAGMA user_version = 2;
COMMIT;
`;

export const MIGRATION_3_SQL = `
BEGIN IMMEDIATE;
ALTER TABLE conventions ADD COLUMN location TEXT;
PRAGMA user_version = 3;
COMMIT;
`;

const COMPLETE_MIGRATION_3_SQL = `
BEGIN IMMEDIATE;
PRAGMA user_version = 3;
COMMIT;
`;

export const MIGRATION_4_SQL = `
BEGIN IMMEDIATE;
ALTER TABLE convention_events ADD COLUMN age_rating TEXT;
PRAGMA user_version = 4;
COMMIT;
`;

const COMPLETE_MIGRATION_4_SQL = `
BEGIN IMMEDIATE;
PRAGMA user_version = 4;
COMMIT;
`;

interface MigrationDatabase {
  execSync(source: string): void;
  getFirstSync<T>(source: string): T | null;
}

export function initializeDatabase(database: MigrationDatabase): void {
  database.execSync(CONNECTION_SQL);
  const version =
    database.getFirstSync<{ user_version: number }>("PRAGMA user_version")
      ?.user_version ?? 0;

  if (version < 1) database.execSync(MIGRATION_1_SQL);
  if (version < 2) applyColumnMigration(database, "time_zone");
  if (version < 3) applyColumnMigration(database, "location");
  if (version < 4) applyColumnMigration(database, "age_rating");
}

const COLUMN_MIGRATIONS = {
  time_zone: {
    table: "conventions",
    migrate: () => MIGRATION_2_SQL,
    complete: () => COMPLETE_MIGRATION_2_SQL,
  },
  location: {
    table: "conventions",
    migrate: () => MIGRATION_3_SQL,
    complete: () => COMPLETE_MIGRATION_3_SQL,
  },
  age_rating: {
    table: "convention_events",
    migrate: () => MIGRATION_4_SQL,
    complete: () => COMPLETE_MIGRATION_4_SQL,
  },
} as const;

/**
 * Adds one nullable column and bumps the schema version.
 *
 * A previous process may have stopped after ALTER TABLE but before the version
 * bump, which would make the ALTER fail forever on every launch. Detect that
 * and just finish the bump instead of retrying the ALTER.
 */
function applyColumnMigration(
  database: MigrationDatabase,
  column: keyof typeof COLUMN_MIGRATIONS,
): void {
  const migration = COLUMN_MIGRATIONS[column];
  const alreadyPresent =
    database.getFirstSync<{ present: number }>(
      `SELECT 1 AS present FROM pragma_table_info('${migration.table}') WHERE name = '${column}'`,
    )?.present === 1;

  try {
    database.execSync(
      alreadyPresent ? migration.complete() : migration.migrate(),
    );
  } catch (error) {
    try {
      database.execSync("ROLLBACK;");
    } catch {}
    throw error;
  }
}
