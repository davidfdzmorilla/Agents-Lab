import { loadTestDatabaseUrl } from "@agentlab/core";
import {
  createAgentDefinitionsRepository,
  createDatabase,
  createPool,
  createProjectsRepository,
  createProviderConfigsRepository,
} from "@agentlab/persistence";
import { truncateAll } from "@agentlab/persistence/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getProjectView, listProjectSummaries } from "./projects.js";

const pool = createPool(loadTestDatabaseUrl(), { max: 2 });
const db = createDatabase(pool);

const budget = {
  maxModelCalls: 10,
  maxConcurrentAgents: 2,
  maxReviewIterations: 1,
  timeoutMs: 60000,
  maxTokensPerCall: 1000,
  maxTotalTokens: 10000,
  maxContextRatio: 0.8,
  maxToolsPerInvocation: 2,
  maxResultChars: 5000,
  maxGraphDepth: 3,
};

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await pool.end();
});

function newAgent(projectId: string, providerConfigId: string, name: string) {
  return {
    projectId,
    name,
    role: "researcher" as const,
    systemPrompt: "prompt",
    promptVersion: "1.0.0",
    providerConfigId,
    modelId: `${name}-model`,
    toolAllowlist: [],
    maxCalls: 1,
    maxTokens: 1,
    timeoutMs: 1,
    outputSchema: { type: "object" },
  };
}

describe("getProjectView", () => {
  it("returns null for an id that is not a uuid and for one that does not exist", async () => {
    expect(await getProjectView(db, "not-a-uuid")).toBeNull();
    expect(
      await getProjectView(db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
  });

  it("returns configurations and agents of the project and flags foreign and invalid configurations", async () => {
    const projects = createProjectsRepository(db);
    const configs = createProviderConfigsRepository(db);
    const agents = createAgentDefinitionsRepository(db);
    const mine = await projects.create({ name: "mine", budgetProfile: budget });
    const other = await projects.create({
      name: "other",
      budgetProfile: budget,
    });
    const valid = await configs.create({
      projectId: mine.id,
      providerType: "ollama",
      baseUrl: null,
      defaultModel: "llama",
      apiKeyEnv: null,
    });
    const invalid = await configs.create({
      projectId: mine.id,
      providerType: "bogus",
      baseUrl: null,
      defaultModel: "x",
      apiKeyEnv: null,
    });
    const foreign = await configs.create({
      projectId: other.id,
      providerType: "ollama",
      baseUrl: null,
      defaultModel: "y",
      apiKeyEnv: null,
    });
    await agents.create(newAgent(mine.id, valid.id, "ok"));
    await agents.create(newAgent(mine.id, invalid.id, "bad"));
    await agents.create(newAgent(mine.id, foreign.id, "alien"));
    await agents.create(newAgent(other.id, foreign.id, "not-mine"));

    const view = await getProjectView(db, mine.id);

    expect(view?.name).toBe("mine");
    expect(view?.providers.map((p) => [p.id, p.valid])).toEqual([
      [valid.id, true],
      [invalid.id, false],
    ]);
    expect(view?.agents.map((a) => [a.name, a.issues])).toEqual([
      ["ok", []],
      ["bad", ["provider_invalid"]],
      ["alien", ["provider_other_project"]],
    ]);
  });
});

describe("listProjectSummaries", () => {
  it("lists id and name of every project", async () => {
    const project = await createProjectsRepository(db).create({
      name: "only",
      budgetProfile: budget,
    });

    expect(await listProjectSummaries(db)).toEqual([
      { id: project.id, name: "only" },
    ]);
  });
});
