import { loadEnv } from "@agentlab/core";
import { runMigrations } from "../migrate.js";
import { createPool } from "../pool.js";

// Only name/code/message are reported: never the Env object or the connection URL (TD-011).
async function main(): Promise<void> {
  const pool = createPool(loadEnv().DATABASE_URL);
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
  process.stdout.write(
    `${JSON.stringify({ level: "info", msg: "migrations applied" })}\n`,
  );
}

try {
  await main();
} catch (error) {
  const failure =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          ...("code" in error ? { code: error.code } : {}),
        }
      : { name: "UnknownError" };
  process.stderr.write(
    `${JSON.stringify({ level: "error", msg: "migration failed", ...failure })}\n`,
  );
  process.exitCode = 1;
}
