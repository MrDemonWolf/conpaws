import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

const expoDb = openDatabaseSync("conpaws.db");
export const db = drizzle(expoDb, { schema });

export async function initDatabase() {
  expoDb.execSync(`
    CREATE TABLE IF NOT EXISTS conventions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      ical_url TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS convention_events (
      id TEXT PRIMARY KEY,
      convention_id TEXT NOT NULL REFERENCES conventions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      room TEXT,
      category TEXT,
      type TEXT NOT NULL DEFAULT 'custom',
      is_shareable INTEGER NOT NULL DEFAULT 1,
      is_age_restricted INTEGER NOT NULL DEFAULT 0,
      content_warning TEXT,
      source_uid TEXT,
      source_url TEXT,
      is_in_schedule INTEGER NOT NULL DEFAULT 0,
      reminder_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_queue (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL
    );

    PRAGMA foreign_keys = ON;
  `);
}
