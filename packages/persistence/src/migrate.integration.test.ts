import { EnvValidationError, loadTestDatabaseUrl } from "@agentlab/core";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import { createPool } from "./pool.js";
import { resetTestDatabase } from "./testing/index.js";

const testUrl = loadTestDatabaseUrl();
const migrationsDir = fileURLToPath(new URL("../migrations", import.meta.url));
const configPath = fileURLToPath(
  new URL("../drizzle.config.ts", import.meta.url),
);

const PUBLIC_TABLES = [
  "agent_definitions",
  "agent_invocations",
  "projects",
  "provider_configs",
  "run_events",
  "runs",
  "tasks",
  "team_definitions",
];
const LANGGRAPH_TABLES = [
  "checkpoint_blobs",
  "checkpoint_migrations",
  "checkpoint_writes",
  "checkpoints",
];

const pool = createPool(testUrl, { max: 4 });

async function tablesIn(
  target: { query: typeof pool.query },
  schema: string,
): Promise<string[]> {
  const result = await target.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = $1 order by table_name",
    [schema],
  );
  return result.rows.map((row) => row.table_name);
}

beforeAll(async () => {
  await runMigrations(pool);
});

afterAll(async () => {
  await pool.end();
});

describe("initial migration", () => {
  it("creates exactly the 8 M1 tables in public and the 4 checkpointer tables in langgraph", async () => {
    expect(await tablesIn(pool, "public")).toEqual(PUBLIC_TABLES);
    expect(await tablesIn(pool, "langgraph")).toEqual(LANGGRAPH_TABLES);
  });

  it("can run twice in a row without failing", async () => {
    await runMigrations(pool);
    await runMigrations(pool);
    expect(await tablesIn(pool, "public")).toEqual(PUBLIC_TABLES);
  });

  it("has unique(run_id, seq) and the (status, created_at) index", async () => {
    const result = await pool.query<{ indexdef: string }>(
      "select indexdef from pg_indexes where schemaname = 'public' and tablename in ('run_events', 'runs')",
    );
    const defs = result.rows.map((row) => row.indexdef).join("\n");
    expect(defs).toContain("UNIQUE INDEX run_events_run_id_seq_unique");
    expect(defs).toContain("(run_id, seq)");
    expect(defs).toContain("(status, created_at)");
  });

  it("keeps langgraph, coordination and any api_key_env CHECK out of 0000_init.sql", () => {
    const sqlFile = readdirSync(migrationsDir).find((file) =>
      file.endsWith("_init.sql"),
    );
    expect(sqlFile).toBe("0000_init.sql");
    const content = readFileSync(`${migrationsDir}/0000_init.sql`, "utf8");
    expect(content).not.toContain("langgraph");
    expect(content).not.toContain("coordination");
    expect(content).not.toMatch(/CHECK \([^)]*api_key_env/);
  });

  it("limits Drizzle to the public schema in drizzle.config.ts", () => {
    expect(readFileSync(configPath, "utf8")).toContain(
      'schemaFilter: ["public"]',
    );
  });
});

describe("migration lock", () => {
  it("lets two concurrent runMigrations on a blank database both succeed", async () => {
    await pool.query(
      "drop schema public, drizzle, langgraph cascade; create schema public",
    );
    const poolA = createPool(testUrl, { max: 4 });
    const poolB = createPool(testUrl, { max: 4 });
    try {
      await Promise.all([runMigrations(poolA), runMigrations(poolB)]);
      expect(await tablesIn(pool, "public")).toEqual(PUBLIC_TABLES);
      expect(await tablesIn(pool, "langgraph")).toEqual(LANGGRAPH_TABLES);
      const control = await pool.query<{ n: string }>(
        "select count(*) as n from drizzle.__drizzle_migrations",
      );
      expect(control.rows[0]?.n).toBe("1");
      const locks = await pool.query<{ n: string }>(
        "select count(*) as n from pg_locks where locktype = 'advisory'",
      );
      expect(locks.rows[0]?.n).toBe("0");
    } finally {
      await Promise.all([poolA.end(), poolB.end()]);
    }
  });
});

describe("resetTestDatabase guard", () => {
  it("refuses a database whose name does not end in _test and does not echo the URL", async () => {
    const url = new URL(testUrl);
    url.pathname = "/agentlab";
    const error = await resetTestDatabase(url.toString()).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EnvValidationError);
    expect(error instanceof Error ? error.message : "").not.toContain(url.host);
    expect(await tablesIn(pool, "public")).toEqual(PUBLIC_TABLES);
  });
});
