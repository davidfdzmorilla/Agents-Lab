import { InvalidApiKeyEnvError, loadTestDatabaseUrl } from "@agentlab/core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, createPool } from "../pool.js";
import { providerConfigs } from "../schema/index.js";
import { createScope, type TestScope } from "../testing/fixtures.js";
import { truncateAll } from "../testing/index.js";
import { createProviderConfigsRepository } from "./provider-configs.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 4 });
const db = createDatabase(pool);
const repo = createProviderConfigsRepository(db);
let scope: TestScope;

const CANARY = "CANARY9f3a7c1e5b";

beforeEach(async () => {
  await truncateAll(db);
  scope = await createScope(db);
});

afterAll(async () => {
  await pool.end();
});

function input(apiKeyEnv: string | null) {
  return {
    projectId: scope.projectId,
    providerType: "openai-compatible",
    baseUrl: null,
    defaultModel: "test-model",
    apiKeyEnv,
  };
}

const rejected = [
  ["an sk- prefixed value", `sk-test-${CANARY}`],
  ["an AIza prefixed value", `AIzaTest${CANARY}`],
  ["a canary-bearing name that is not a valid variable", `${CANARY}_API_KEY`],
  ["a well-formed name of 41 characters", `${"A".repeat(33)}_API_KEY`],
  ["a lowercase name", "openrouter_api_key"],
  ["a name without the _API_KEY suffix", "OPENROUTER_TOKEN"],
] as const;

describe("api_key_env validation", () => {
  it.each(rejected)(
    "rejects %s without inserting, querying or leaking the value",
    async (_label, value) => {
      const spy = vi.spyOn(pool, "query");
      const error = await repo.create(input(value)).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();

      expect(error).toBeInstanceOf(InvalidApiKeyEnvError);
      expect(error).toMatchObject({ code: "API_KEY_ENV_INVALID" });
      if (!(error instanceof Error)) throw new TypeError("expected an Error");
      expect(error.message).not.toContain(CANARY);
      expect(error.stack ?? "").not.toContain(CANARY);
      expect(error.cause).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain(CANARY);
      expect(await db.select().from(providerConfigs)).toHaveLength(0);
    },
  );

  it("accepts a valid variable name", async () => {
    const row = await repo.create(input("OPENROUTER_API_KEY"));
    expect(row.apiKeyEnv).toBe("OPENROUTER_API_KEY");
  });

  it("accepts a well-formed name of exactly 40 characters", async () => {
    const name = `${"A".repeat(32)}_API_KEY`;
    expect(name).toHaveLength(40);
    const row = await repo.create(input(name));
    expect(row.apiKeyEnv).toBe(name);
  });

  it("accepts null for providers without a key", async () => {
    const row = await repo.create(input(null));
    expect(row.apiKeyEnv).toBeNull();
  });
});

describe("reads", () => {
  it("returns null for an id that does not exist", async () => {
    expect(await repo.get(randomUUID())).toBeNull();
  });

  it("gets a created config and lists by project", async () => {
    const row = await repo.create(input("GEMINI_API_KEY"));
    expect(await repo.get(row.id)).toEqual(row);
    expect(await repo.listByProject(scope.projectId)).toEqual([row]);
    expect(await repo.listByProject(randomUUID())).toEqual([]);
  });
});
