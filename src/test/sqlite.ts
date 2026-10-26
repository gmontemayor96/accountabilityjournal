import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { SqlDriver } from "../data/sqliteRepo";

export const migration = (name: string) =>
  readFileSync(new URL(`../../src-tauri/migrations/${name}`, import.meta.url), "utf8");

/** Wraps Node's built-in SQLite in the driver interface the app uses. */
export function driverFor(db: DatabaseSync): SqlDriver {
  type P = null | number | string;
  return {
    execute: async (sql, params = []) => { db.prepare(sql).run(...(params as P[])); },
    select: async <T,>(sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as P[])) as T[],
  };
}

/** An in-memory database with every real migration applied. */
export function memoryDriver(): SqlDriver {
  const db = new DatabaseSync(":memory:");
  db.exec(migration("001_init.sql"));
  db.exec(migration("002_sync.sql"));
  db.exec(migration("003_tasks.sql"));
  db.exec(migration("004_goals.sql"));
  return driverFor(db);
}
