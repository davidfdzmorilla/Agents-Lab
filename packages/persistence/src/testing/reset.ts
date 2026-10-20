import { EnvValidationError } from "@agentlab/core";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { createDatabase, createPool, type Database } from "../pool.js";
import { runMigrations } from "../migrate.js";
import * as schema from "../schema/index.js";

const TEST_DATABASE_NAME = /^[a-z_][a-z0-9_]*_test$/;

function testDatabaseName(testUrl: string): string {
  let name = "";
  try {
    name = decodeURIComponent(new URL(testUrl).pathname.slice(1));
  } catch {
    // Falls through to the guard below; the URL is never echoed.
  }
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new EnvValidationError(
      "DATABASE_URL_TEST must point to a database whose name ends in _test; refusing to reset it",
    );
  }
  return name;
}

/** Drops and recreates the test database, then migrates it (including the checkpointer setup). */
export async function resetTestDatabase(testUrl: string): Promise<void> {
  const name = testDatabaseName(testUrl);
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";

  const admin = createPool(adminUrl.toString(), { max: 1 });
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const pool = createPool(testUrl);
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

/** Empties every table that Drizzle manages; leaves the langgraph and drizzle schemas alone. */
export async function truncateAll(db: Database): Promise<void> {
  const tables: PgTable[] = [];
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) tables.push(value);
  }
  const names = tables.map((table) => sql.identifier(getTableName(table)));
  await db.execute(
    sql`truncate table ${sql.join(names, sql`, `)} restart identity cascade`,
  );
}

export function createTestDatabase(testUrl: string) {
  const pool = createPool(testUrl);
  return { pool, db: createDatabase(pool) };
}
