import { MemoryRepo } from "./memoryRepo";
import type { Repo } from "./repo";
import { sampleData } from "./sample";
import { SqliteRepo, type SqlDriver } from "./sqliteRepo";

export const isDesktopApp = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Opens identity.db through the Tauri SQL plugin. Migrations run on the Rust side at load. */
async function tauriDriver(): Promise<SqlDriver> {
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  const db = await Database.load("sqlite:identity.db");
  return {
    execute: async (sql, params = []) => {
      await db.execute(sql, params);
    },
    select: (sql, params = []) => db.select(sql, params),
  };
}

export async function openRepo(): Promise<Repo> {
  if (isDesktopApp) return new SqliteRepo(await tauriDriver());
  return new MemoryRepo(sampleData(), "identity-preview-v5");
}

export type { Repo } from "./repo";
