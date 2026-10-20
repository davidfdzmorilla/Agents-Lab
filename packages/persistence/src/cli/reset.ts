import { loadTestDatabaseUrl } from "@agentlab/core";
import { resetTestDatabase } from "../testing/reset.js";

try {
  await resetTestDatabase(loadTestDatabaseUrl());
  process.stdout.write(
    `${JSON.stringify({ level: "info", msg: "test database reset" })}\n`,
  );
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
    `${JSON.stringify({ level: "error", msg: "reset failed", ...failure })}\n`,
  );
  process.exitCode = 1;
}
