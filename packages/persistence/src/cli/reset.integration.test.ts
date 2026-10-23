import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTestDatabaseUrl } from "@agentlab/core";
import { describe, expect, it } from "vitest";
import { createPool } from "../pool.js";

// Real child process (the same entry point as `pnpm db:reset`) against the real test database.
// The CLI drops and recreates agentlab_test and migrates it again, so it leaves the database in the
// state the other files expect (same as the globalSetup). No pool of this process is open while it runs.
const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));
const CHILD_TIMEOUT_MS = 60_000;
// A hung child is killed before the test timeout so that `close` fires and the test fails on its assertions instead of leaving the child running.
const CHILD_KILL_MS = 45_000;

interface CliResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runResetCli(databaseUrlTest: string): Promise<CliResult> {
  // Built, not copied from process.env (testing-conventions rule 5): the child only gets DATABASE_URL_TEST.
  const env: Record<string, string> = { DATABASE_URL_TEST: databaseUrlTest };
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "src/cli/reset.ts"],
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

async function tableExists(name: string): Promise<boolean> {
  const pool = createPool(loadTestDatabaseUrl(), { max: 1 });
  try {
    const result = await pool.query<{ found: boolean }>(
      "select to_regclass($1) is not null as found",
      [`public.${name}`],
    );
    return result.rows[0]?.found === true;
  } finally {
    await pool.end();
  }
}

// Nothing listens on port 1; the password is invented here and built at runtime.
function unreachableUrl(password: string, database: string): string {
  const url = new URL("postgres://127.0.0.1:1/placeholder");
  url.pathname = `/${database}`;
  url.username = "cli_test_user";
  url.password = password;
  return url.toString();
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

function expectNoLeak(result: CliResult, password: string, url: string): void {
  const output = result.stdout + result.stderr;
  expect(output.includes(password)).toBe(false);
  expect(output.includes(url)).toBe(false);
  expect(output.includes(encodeURIComponent(password))).toBe(false);
}

describe("db:reset CLI (process)", () => {
  it(
    "recreates and migrates the test database, prints the info line and exits 0",
    async () => {
      const pool = createPool(loadTestDatabaseUrl(), { max: 1 });
      try {
        await pool.query("create table cli_reset_marker (id int)");
      } finally {
        await pool.end();
      }
      expect(await tableExists("cli_reset_marker")).toBe(true);

      const result = await runResetCli(loadTestDatabaseUrl());

      // Booleans only: the received value of a failed assertion is printed, and the output could carry connection data.
      expect(result.code).toBe(0);
      expect(
        result.stdout.trim() ===
          JSON.stringify({ level: "info", msg: "test database reset" }),
      ).toBe(true);
      expect(result.stderr === "").toBe(true);
      expect(await tableExists("cli_reset_marker")).toBe(false);
      expect(await tableExists("runs")).toBe(true);
    },
    CHILD_TIMEOUT_MS,
  );

  it(
    "exits 1 with a JSON error on stderr that shows neither the password nor the URL when the connection fails",
    async () => {
      const password = `pw-${crypto.randomUUID()}`;
      const url = unreachableUrl(password, "agentlab_test");

      const result = await runResetCli(url);

      expect(result.code).toBe(1);
      expect(result.stdout === "").toBe(true);
      const failure = parseFailure(result.stderr);
      expect(failure !== null).toBe(true);
      expect(failure?.["level"] === "error").toBe(true);
      expect(failure?.["msg"] === "reset failed").toBe(true);
      expect(typeof failure?.["name"]).toBe("string");
      expect(typeof failure?.["message"]).toBe("string");
      expect(failure?.["code"] === "ECONNREFUSED").toBe(true);
      expectNoLeak(result, password, url);
    },
    CHILD_TIMEOUT_MS,
  );

  it(
    "rejects a database name that does not end in _test with the guard message and shows neither the password nor the URL",
    async () => {
      const password = `pw-${crypto.randomUUID()}`;
      const url = unreachableUrl(password, "agentlab");

      const result = await runResetCli(url);

      expect(result.code).toBe(1);
      expect(result.stdout === "").toBe(true);
      const failure = parseFailure(result.stderr);
      expect(failure !== null).toBe(true);
      expect(failure?.["msg"] === "reset failed").toBe(true);
      expect(
        typeof failure?.["message"] === "string" &&
          failure["message"].includes("ends in _test"),
      ).toBe(true);
      expectNoLeak(result, password, url);
    },
    CHILD_TIMEOUT_MS,
  );
});
