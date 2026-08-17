import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { initializeDatabase } from "./bootstrap";
import * as schema from "./schema";

const sqlite = openDatabaseSync("conpaws.db", { enableChangeListener: true });
initializeDatabase(sqlite);

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
