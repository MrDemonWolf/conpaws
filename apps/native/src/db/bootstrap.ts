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
ALTER TABLE conventions ADD COLUMN time_zone TEXT;
PRAGMA user_version = 2;
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
  if (version < 2) database.execSync(MIGRATION_2_SQL);
}
