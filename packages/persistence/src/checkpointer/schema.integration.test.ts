import { loadTestDatabaseUrl } from "@agentlab/core";
import { afterAll, describe, expect, it } from "vitest";
import { createPool } from "../pool.js";
import { checkpointSchemaExists } from "./setup.js";

const testUrl = loadTestDatabaseUrl();
const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";

const testPool = createPool(testUrl, { max: 1 });
const adminPool = createPool(adminUrl.toString(), { max: 1 });

afterAll(async () => {
  await testPool.end();
  await adminPool.end();
});

describe("checkpointSchemaExists", () => {
  it("returns true on a migrated test database", async () => {
    expect(await checkpointSchemaExists(testPool)).toBe(true);
  });

  it("returns false on a database without the langgraph schema", async () => {
    expect(await checkpointSchemaExists(adminPool)).toBe(false);
  });
});
