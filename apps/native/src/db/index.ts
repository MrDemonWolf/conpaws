import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { reportError } from "@/lib/error-reporting";
import { initializeDatabase } from "./bootstrap";
import * as schema from "./schema";

// Opening and migrating the store is the first thing that happens on launch,
// before any React tree exists that could contain a throw. Unguarded, a
// corrupt file, a full disk during `PRAGMA journal_mode = WAL`, or a bad
// migration killed the app at the splash on every launch, with nothing
// rendered and nothing reported. Catching it here turns that into a state the
// root layout can render and Sentry can see.
let databaseInitError: Error | null = null;

function openConventionStore(): SQLiteDatabase {
  const database = openDatabaseSync("conpaws.db", {
    enableChangeListener: true,
  });
  initializeDatabase(database);
  return database;
}

function resolveStore(): SQLiteDatabase {
  try {
    return openConventionStore();
  } catch (error) {
    databaseInitError =
      error instanceof Error ? error : new Error(String(error));
    reportError(databaseInitError, { scope: "db.open" });
  }

  try {
    // A throwaway in-memory store keeps `db` a real Drizzle instance, so
    // importing a repository cannot itself throw. Nothing is ever written to
    // it: the root layout refuses to render the app while
    // getDatabaseInitError() is set.
    const fallback = openDatabaseSync(":memory:");
    initializeDatabase(fallback);
    return fallback;
  } catch (fallbackError) {
    reportError(fallbackError, { scope: "db.openFallback" });
    // SQLite itself is unusable. Nothing can render, but the original failure
    // has now reached Sentry, which is the part that used to be missing.
    throw databaseInitError;
  }
}

export const db = drizzle(resolveStore(), { schema });

/** Non-null when the real store could not be opened and `db` is a stand-in. */
export function getDatabaseInitError(): Error | null {
  return databaseInitError;
}

export type Database = typeof db;
