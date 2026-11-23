import {
  EnvSchema,
  isApiKeyEnvName,
  loadTestDatabaseUrl,
} from "@agentlab/core";
import {
  createDatabase,
  createPool,
  createProjectsRepository,
  createProviderConfigsRepository,
} from "@agentlab/persistence";
import { truncateAll } from "@agentlab/persistence/testing";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "./route.js";

const testUrl = loadTestDatabaseUrl();
const pool = createPool(testUrl, { max: 2 });
const db = createDatabase(pool);

const KEY_NAMES = [
  ...Object.keys(EnvSchema.shape).filter(isApiKeyEnvName),
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
  "FOO_API_KEY",
];
const KEY_CANARIES = KEY_NAMES.map((name, i) => `KEYCANARY${i}x9f3a7c`);
const PASSWORD_CANARY = "PWCANARY4417b2e";
const URL_CANARY = "URLCANARY8821d4";

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

function expectNoLeak(
  text: string,
  headers: Headers,
  canaries: readonly string[],
): void {
  const headerText = [...headers.entries()].flat().join("\n");
  for (const canary of canaries) {
    const escaped = JSON.stringify(canary).slice(1, -1);
    for (const haystack of [text, headerText]) {
      expect(haystack).not.toContain(canary);
      expect(haystack).not.toContain(escaped);
    }
  }
  expect(text).not.toContain("api_key_env");
  expect(text).not.toContain("apiKeyEnv");
  expect(text).not.toContain("base_url");
  expect(text).not.toContain("baseUrl");
  for (const name of KEY_NAMES) expect(text).not.toContain(name);
}

async function seed(): Promise<void> {
  const project = await createProjectsRepository(db).create({
    name: "p",
    budgetProfile: budget,
  });
  const configs = createProviderConfigsRepository(db);
  const baseUrl = `http://169.254.169.254/${URL_CANARY}`;
  await configs.create({
    projectId: project.id,
    providerType: "openrouter",
    baseUrl,
    defaultModel: "m",
    apiKeyEnv: "OPENROUTER_API_KEY",
  });
  await configs.create({
    projectId: project.id,
    providerType: "gemini",
    baseUrl,
    defaultModel: "g",
    apiKeyEnv: "GOOGLE_API_KEY",
  });
  await configs.create({
    projectId: project.id,
    providerType: "mystery",
    baseUrl,
    defaultModel: "x",
    apiKeyEnv: "FOO_API_KEY",
  });
}

beforeEach(async () => {
  await truncateAll(db);
  vi.stubEnv("DATABASE_URL", testUrl);
  KEY_NAMES.forEach((name, i) => vi.stubEnv(name, KEY_CANARIES[i]));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /api/providers does not leak secrets", () => {
  it("covers every declared *_API_KEY name plus undeclared ones", () => {
    expect(KEY_NAMES).toEqual(
      expect.arrayContaining([
        "OPENROUTER_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "OPENAI_API_KEY",
        "FOO_API_KEY",
      ]),
    );
    expect(new Set(KEY_CANARIES).size).toBe(KEY_NAMES.length);
  });

  it("leaks no canary on the empty path", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expectNoLeak(await response.text(), response.headers, KEY_CANARIES);
  });

  it("leaks no canary on the path with valid and invalid rows", async () => {
    await seed();

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(text).providers).toHaveLength(3);
    expectNoLeak(text, response.headers, [...KEY_CANARIES, URL_CANARY]);
  });

  it("leaks no canary on the database-down path, password included", async () => {
    const url = new URL(testUrl);
    url.hostname = "127.0.0.1";
    url.port = "1";
    url.password = PASSWORD_CANARY;
    vi.stubEnv("DATABASE_URL", url.toString());

    const response = await call();
    const text = await response.text();

    expect(response.status).toBe(500);
    expectNoLeak(text, response.headers, [...KEY_CANARIES, PASSWORD_CANARY]);
  });
});
