import { loadTestDatabaseUrl } from "@agentlab/core";
import {
  createAgentDefinitionsRepository,
  createDatabase,
  createPool,
  createProjectsRepository,
  createProviderConfigsRepository,
} from "@agentlab/persistence";
import { truncateAll } from "@agentlab/persistence/testing";
import { PROVIDER_PRESETS } from "@agentlab/providers/presets";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { dynamic, GET } from "./route.js";

const testUrl = loadTestDatabaseUrl();
const pool = createPool(testUrl, { max: 2 });
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

async function call(): Promise<Response> {
  const handler = GET as (request: Request) => Promise<Response>;
  return handler(new Request("http://localhost:3000/api/providers"));
}

beforeEach(async () => {
  await truncateAll(db);
  vi.stubEnv("DATABASE_URL", testUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/providers", () => {
  it("is evaluated per request, never prerendered", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("answers an empty list with no-store when there are no configurations", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({ providers: [] });
  });

  it("lists the three types with preset capabilities, declared models, and an invalid row", async () => {
    const project = await createProjectsRepository(db).create({
      name: "p",
      budgetProfile: budget,
    });
    const configs = createProviderConfigsRepository(db);
    const base = { projectId: project.id, baseUrl: "http://127.0.0.1:9/x" };
    const openrouter = await configs.create({
      ...base,
      providerType: "openrouter",
      defaultModel: "or-default",
      apiKeyEnv: "OPENROUTER_API_KEY",
    });
    const ollama = await configs.create({
      ...base,
      providerType: "ollama",
      defaultModel: "llama",
      apiKeyEnv: null,
    });
    const gemini = await configs.create({
      ...base,
      providerType: "gemini",
      defaultModel: "gem",
      apiKeyEnv: "GEMINI_API_KEY",
    });
    const bad = await configs.create({
      ...base,
      providerType: "openai-compatible",
      defaultModel: "old",
      apiKeyEnv: null,
    });
    await createAgentDefinitionsRepository(db).create({
      projectId: project.id,
      name: "a",
      role: "writer",
      systemPrompt: "p",
      promptVersion: "1.0.0",
      providerConfigId: openrouter.id,
      modelId: "or-agent-model",
      toolAllowlist: [],
      maxCalls: 1,
      maxTokens: 1,
      timeoutMs: 1,
      outputSchema: { type: "object" },
    });

    const response = await call();
    const body = (await response.json()) as {
      providers: Record<string, unknown>[];
    };

    expect(response.status).toBe(200);
    expect(body.providers).toEqual([
      {
        id: openrouter.id,
        projectId: project.id,
        type: "openrouter",
        valid: true,
        error: null,
        defaultModel: "or-default",
        capabilities: PROVIDER_PRESETS.openrouter.capabilities,
        models: [{ id: "or-default" }, { id: "or-agent-model" }],
      },
      {
        id: ollama.id,
        projectId: project.id,
        type: "ollama",
        valid: true,
        error: null,
        defaultModel: "llama",
        capabilities: PROVIDER_PRESETS.ollama.capabilities,
        models: [{ id: "llama" }],
      },
      {
        id: gemini.id,
        projectId: project.id,
        type: "gemini",
        valid: true,
        error: null,
        defaultModel: "gem",
        capabilities: PROVIDER_PRESETS.gemini.capabilities,
        models: [{ id: "gem" }],
      },
      {
        id: bad.id,
        projectId: project.id,
        type: null,
        valid: false,
        error: { code: "PROVIDER_CONFIG_INVALID" },
        defaultModel: "old",
        capabilities: null,
        models: [{ id: "old" }],
      },
    ]);
  });

  it("answers a fixed 500 INTERNAL when the database is down", async () => {
    const url = new URL(testUrl);
    url.hostname = "127.0.0.1";
    url.port = "1";
    vi.stubEnv("DATABASE_URL", url.toString());

    const response = await call();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      code: "INTERNAL",
      message: "Internal server error",
    });
  });
});
