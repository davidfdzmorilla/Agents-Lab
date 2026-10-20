import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { setupCheckpointer } from "./checkpointer/setup.js";
import { createDatabase } from "./pool.js";

// Arbitrary constant key ("AGLB") shared by every process that migrates this database.
const MIGRATION_LOCK_KEY = 1095060546;

const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../migrations", import.meta.url),
);

/**
 * Applies the Drizzle migrations and then the LangGraph checkpointer setup, serialized across
 * processes with a transaction-level advisory lock. The lock lives on a dedicated client and the
 * work runs on other pool connections (Drizzle opens its own transaction), so the pool needs max >= 2.
 */
export async function runMigrations(
  pool: pg.Pool,
  options: { readonly migrationsFolder?: string } = {},
): Promise<void> {
  const lockClient = await pool.connect();
  let failure: Error | undefined;
  try {
    await lockClient.query("BEGIN");
    await lockClient.query("SELECT pg_advisory_xact_lock($1)", [
      MIGRATION_LOCK_KEY,
    ]);
    await migrate(createDatabase(pool), {
      migrationsFolder: options.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER,
    });
    await setupCheckpointer(pool);
    await lockClient.query("COMMIT");
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    try {
      await lockClient.query("ROLLBACK");
    } catch {
      // Keep the original error; the client is discarded below.
    }
    throw error;
  } finally {
    lockClient.release(failure);
  }
}
