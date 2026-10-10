/**
 * A D1 stand-in for tests, on Node's built-in SQLite, with the real catalog
 * migrations applied. It runs the exact SQL the Worker sends, so tests catch
 * what a mocked `prepare` never would: a typo in a column, an upsert that does
 * not parse, a `changes()` that does not mean what the code assumes.
 *
 * Like D1 it enforces foreign keys, runs a batch as one transaction on one
 * connection, and rejects `undefined` as a bind value.
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type SqliteValue = null | number | bigint | string | Uint8Array;

interface SqliteStatement {
  all(...params: SqliteValue[]): Record<string, unknown>[];
  run(...params: SqliteValue[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

// node:sqlite ships with Node 22.13+; @types/node 20 does not describe it.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const migrationsDir = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../drizzle/migrations",
);

function toSqlite(value: unknown): SqliteValue {
  if (value === undefined) {
    throw new Error("D1_TYPE_ERROR: undefined is not a supported bind value");
  }
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "bigint"
  ) {
    return value;
  }
  if (value instanceof Uint8Array) return value;
  throw new Error(`Unsupported bind value: ${typeof value}`);
}

function result(results: Record<string, unknown>[], changes: number) {
  return {
    results,
    success: true as const,
    meta: {
      changes,
      last_row_id: 0,
      duration: 0,
      rows_read: 0,
      rows_written: changes,
      changed_db: changes > 0,
      size_after: 0,
    },
  };
}

class TestStatement {
  constructor(
    private readonly sqlite: SqliteDatabase,
    readonly sql: string,
    private readonly params: SqliteValue[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new TestStatement(this.sqlite, this.sql, values.map(toSqlite));
  }

  execute() {
    const statement = this.sqlite.prepare(this.sql);
    const returnsRows =
      /^\s*(SELECT|WITH|PRAGMA)\b/i.test(this.sql) ||
      /\bRETURNING\b/i.test(this.sql);
    if (returnsRows) {
      const rows = statement.all(...this.params).map((row) => ({ ...row }));
      const isWrite = /^\s*(INSERT|UPDATE|DELETE)\b/i.test(this.sql);
      return result(rows, isWrite ? rows.length : 0);
    }
    const info = statement.run(...this.params);
    return result([], Number(info.changes));
  }

  async first<T = Record<string, unknown>>(column?: string) {
    const row = this.execute().results[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async all<T = Record<string, unknown>>() {
    return this.execute() as ReturnType<TestStatement["execute"]> & {
      results: T[];
    };
  }

  async run() {
    return this.execute();
  }

  async raw() {
    return this.execute().results.map((row) => Object.values(row));
  }
}

export interface TestCatalog {
  database: D1Database;
  sqlite: SqliteDatabase;
  /** Reads rows directly, for assertions. */
  rows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  /** Runs a statement directly, for setting up state. */
  exec(sql: string, ...params: unknown[]): void;
}

export function createTestCatalog(): TestCatalog {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const text = readFileSync(join(migrationsDir, file), "utf8");
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) sqlite.exec(statement);
    }
  }

  const database = {
    prepare: (sql: string) => new TestStatement(sqlite, sql),
    batch: async (statements: TestStatement[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((statement) => statement.execute());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
  };

  return {
    database: database as unknown as D1Database,
    sqlite,
    rows: <T>(sql: string, ...params: unknown[]) =>
      sqlite
        .prepare(sql)
        .all(...params.map(toSqlite))
        .map((row) => ({ ...row })) as T[],
    exec: (sql: string, ...params: unknown[]) => {
      sqlite.prepare(sql).run(...params.map(toSqlite));
    },
  };
}

export function addMember(
  catalog: TestCatalog,
  email: string,
  role: "owner" | "editor" = "editor",
  status: "active" | "disabled" = "active",
) {
  catalog.exec(
    "INSERT INTO admin_members (email, role, status, created_at) VALUES (?, ?, ?, ?)",
    email,
    role,
    status,
    0,
  );
}

export function addInvite(
  catalog: TestCatalog,
  email: string,
  input: { role?: "owner" | "editor"; expiresAt: number; invitedBy?: string },
) {
  catalog.exec(
    "INSERT INTO admin_invites (email, role, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    email,
    input.role ?? "editor",
    input.invitedBy ?? "owner@example.com",
    0,
    input.expiresAt,
  );
}
