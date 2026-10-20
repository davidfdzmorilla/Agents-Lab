import { loadTestDatabaseUrl } from "@agentlab/core";
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, createPool } from "../pool.js";
import {
  TEST_BUDGET,
  createScope,
  type TestScope,
} from "../testing/fixtures.js";
import { truncateAll } from "../testing/index.js";
import { createAgentDefinitionsRepository } from "./agent-definitions.js";
import { createProjectsRepository } from "./projects.js";
import { createProviderConfigsRepository } from "./provider-configs.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 4 });
const db = createDatabase(pool);
const projects = createProjectsRepository(db);
const providerConfigs = createProviderConfigsRepository(db);
const agentDefinitions = createAgentDefinitionsRepository(db);
let scope: TestScope;

beforeEach(async () => {
  await truncateAll(db);
  scope = await createScope(db);
});

afterAll(async () => {
  await pool.end();
});

describe("projects", () => {
  it("creates, gets and lists projects", async () => {
    const created = await projects.create({
      name: "second",
      budgetProfile: TEST_BUDGET,
    });
    expect(await projects.get(created.id)).toEqual(created);
    const all = await projects.list();
    expect(all.map((project) => project.id)).toContain(created.id);
    expect(all).toHaveLength(2);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await projects.get(randomUUID())).toBeNull();
  });
});

describe("agent definitions", () => {
  async function newDefinition() {
    const provider = await providerConfigs.create({
      projectId: scope.projectId,
      providerType: "fake",
      baseUrl: null,
      defaultModel: "fake-model",
      apiKeyEnv: null,
    });
    return agentDefinitions.create({
      projectId: scope.projectId,
      name: "researcher",
      role: "researcher",
      systemPrompt: "You research.",
      promptVersion: "1.0.0",
      providerConfigId: provider.id,
      modelId: "fake-model",
      maxCalls: 3,
      maxTokens: 500,
      timeoutMs: 1000,
      outputSchema: { type: "object" },
    });
  }

  it("creates with defaults, gets and lists by project", async () => {
    const created = await newDefinition();
    expect(created.enabled).toBe(true);
    expect(created.toolAllowlist).toEqual([]);
    expect(await agentDefinitions.get(created.id)).toEqual(created);
    expect(await agentDefinitions.listByProject(scope.projectId)).toEqual([
      created,
    ]);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await agentDefinitions.get(randomUUID())).toBeNull();
  });
});
