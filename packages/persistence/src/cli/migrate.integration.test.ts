import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTestDatabaseUrl } from "@agentlab/core";
import { describe, expect, it } from "vitest";
import { createPool } from "../pool.js";

// Real child process (the same entry point as `pnpm db:migrate`) against a disposable database (success) and an unreachable URL (failure).
const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));
const CHILD_TIMEOUT_MS = 30_000;
// A hung child is killed before the test timeout so that `close` fires and cleanup (DROP) still runs.
const CHILD_KILL_MS = 20_000;

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runMigrateCli(databaseUrl: string): Promise<CliResult> {
  // Built, not copied from process.env (testing-conventions rule 5): the child only gets DATABASE_URL.
  const env: Record<string, string> = { DATABASE_URL: databaseUrl };
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/cli/migrate.ts"],
      {
        cwd: PACKAGE_DIR,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: CHILD_KILL_MS,
        killSignal: "SIGKILL",
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

// Disposable database: its own name (ends in _test), created and dropped from a connection to the
// maintenance database, never from a connection to the disposable one. The shared agentlab_test is not touched.
function urlForDatabase(database: string): string {
  const url = new URL(loadTestDatabaseUrl());
  url.pathname = `/${database}`;
  return url.toString();
}

async function withDisposableDatabase(
  run: (databaseUrl: string) => Promise<void>,
): Promise<void> {
  const name = `cli_migrate_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}_test`;
  const admin = createPool(urlForDatabase("postgres"), { max: 1 });
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    try {
      await run(urlForDatabase(name));
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
  } finally {
    await admin.end();
  }
}

async function tablesPresent(
  pool: ReturnType<typeof createPool>,
): Promise<{ runs: boolean; checkpoints: boolean }> {
  const result = await pool.query<{ runs: boolean; checkpoints: boolean }>(
    "select to_regclass('public.runs') is not null as runs, to_regclass('langgraph.checkpoints') is not null as checkpoints",
  );
  return {
    runs: result.rows[0]?.runs === true,
    checkpoints: result.rows[0]?.checkpoints === true,
  };
}

// Parsing failures are swallowed on purpose: a SyntaxError message may quote the text it failed on.
function parseFailure(stderr: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stderr.trim());
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// Nothing listens on port 1; the password is invented here and built at runtime.
function unreachableUrl(password: string): string {
  const url = new URL("postgres://127.0.0.1:1/agentlab_test");
  url.username = "cli_test_user";
  url.password = password;
  return url.toString();
}

describe("db:migrate CLI (process)", () => {
  it(
    "migrates an empty disposable database (public.runs and langgraph.checkpoints appear), prints the info line and exits 0",
    async () => {
      await withDisposableDatabase(async (databaseUrl) => {
        const pool = createPool(databaseUrl, { max: 1 });
        try {
          // Precondition: the child starts from an empty database, so only the CLI can create the tables.
          const before = await tablesPresent(pool);
          expect(before.runs).toBe(false);
          expect(before.checkpoints).toBe(false);

          const result = await runMigrateCli(databaseUrl);

          // Booleans only: the received value of a failed assertion is printed, and the output could carry connection data.
          expect(result.code).toBe(0);
          expect(
            result.stdout.trim() ===
              JSON.stringify({ level: "info", msg: "migrations applied" }),
          ).toBe(true);
          expect(result.stderr === "").toBe(true);

          const after = await tablesPresent(pool);
          expect(after.runs).toBe(true);
          expect(after.checkpoints).toBe(true);
        } finally {
          await pool.end();
        }
      });
    },
    CHILD_TIMEOUT_MS,
  );

  it(
    "exits 1 with a JSON error on stderr that shows neither the password nor the URL when the connection fails",
    async () => {
      const password = `pw-${crypto.randomUUID()}`;
      const url = unreachableUrl(password);

      const result = await runMigrateCli(url);

      expect(result.code).toBe(1);
      expect(result.stdout === "").toBe(true);
      const failure = parseFailure(result.stderr);
      expect(failure !== null).toBe(true);
      expect(failure?.["level"] === "error").toBe(true);
      expect(failure?.["msg"] === "migration failed").toBe(true);
      expect(typeof failure?.["name"]).toBe("string");
      expect(typeof failure?.["message"]).toBe("string");
      expect(failure?.["code"] === "ECONNREFUSED").toBe(true);

      const output = result.stdout + result.stderr;
      expect(output.includes(password)).toBe(false);
      expect(output.includes(url)).toBe(false);
      expect(output.includes(encodeURIComponent(password))).toBe(false);
    },
    CHILD_TIMEOUT_MS,
  );
});
