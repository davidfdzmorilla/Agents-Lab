import { loadTestDatabaseUrl } from "@agentlab/core";
import { resetTestDatabase } from "@agentlab/persistence/testing";

// Runs once per Vitest run. A missing DATABASE_URL_TEST fails the run with the loader's message (it is never skipped).
export default async function setup(): Promise<void> {
  await resetTestDatabase(loadTestDatabaseUrl());
}
