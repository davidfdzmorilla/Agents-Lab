import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AgentDefinitionSchema } from "./agent-definition.js";
import { AgentInvocationResultSchema } from "./agent-invocation-result.js";
import { BudgetSchema } from "./budget.js";
import { JsonSchemaSchema } from "./json-schema.js";
import { ProviderCapabilitiesSchema } from "./provider-capabilities.js";
import { RunRequestSchema } from "./run-request.js";
import { TeamDefinitionSchema } from "./team-definition.js";

const agent = {
  id: randomUUID(),
  name: "Researcher",
  role: "researcher",
  systemPrompt: "You research.",
  promptVersion: "1.0.0",
  providerId: randomUUID(),
  modelId: "model-x",
  toolAllowlist: [],
  maxCalls: 3,
  maxTokens: 1000,
  timeoutMs: 30000,
  outputSchema: { type: "object" },
  enabled: true,
};

const team = {
  id: randomUUID(),
  name: "Research",
  graphBuilder: "research",
  agentIds: [randomUUID()],
};
const request = {
  projectId: randomUUID(),
  teamId: randomUUID(),
  input: "What is X?",
};
const budget = {
  maxModelCalls: 20,
  maxConcurrentAgents: 3,
  maxReviewIterations: 2,
  timeoutMs: 300000,
  maxTokensPerCall: 4000,
  maxTotalTokens: 60000,
  maxContextRatio: 0.8,
  maxToolsPerInvocation: 0,
  maxResultChars: 20000,
  maxGraphDepth: 5,
};
const capabilities = {
  tools: false,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};
const result = {
  content: { a: 1 },
  status: "ok",
  errors: [],
  references: [{ kind: "url", uri: "https://example.com" }],
  usage: { inputTokens: 1 },
};

function without<T extends object>(obj: T, key: keyof T): object {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

describe("AgentDefinitionSchema", () => {
  it("accepts the canonical agent", () => {
    expect(AgentDefinitionSchema.safeParse(agent).success).toBe(true);
  });
  it.each([
    ["missing field", without(agent, "name")],
    ["unknown key", { ...agent, extra: 1 }],
    ["role outside the six", { ...agent, role: "intern" }],
    ["non-semver promptVersion", { ...agent, promptVersion: "v1" }],
    ["non-uuid id", { ...agent, id: "abc" }],
    ["non-positive maxCalls", { ...agent, maxCalls: 0 }],
  ])("rejects %s", (_name, value) => {
    expect(AgentDefinitionSchema.safeParse(value).success).toBe(false);
  });
});

describe("TeamDefinitionSchema", () => {
  it("accepts the canonical team", () => {
    expect(TeamDefinitionSchema.safeParse(team).success).toBe(true);
  });
  it.each([
    ["coordination", { ...team, coordination: {} }],
    ["empty agentIds", { ...team, agentIds: [] }],
    ["missing name", without(team, "name")],
  ])("rejects %s", (_name, value) => {
    expect(TeamDefinitionSchema.safeParse(value).success).toBe(false);
  });
});

describe("RunRequestSchema", () => {
  it("accepts and trims the input", () => {
    expect(RunRequestSchema.parse({ ...request, input: "  hi  " }).input).toBe(
      "hi",
    );
  });
  it.each([
    ["injected budget", { ...request, budget }],
    ["blank input", { ...request, input: "   " }],
    ["non-uuid projectId", { ...request, projectId: "p" }],
  ])("rejects %s", (_name, value) => {
    expect(RunRequestSchema.safeParse(value).success).toBe(false);
  });
});

describe("BudgetSchema", () => {
  it("accepts the canonical budget", () => {
    expect(BudgetSchema.safeParse(budget).success).toBe(true);
  });
  it.each([
    ["missing limit", without(budget, "maxGraphDepth")],
    ["unknown key", { ...budget, extra: 1 }],
    ["ratio above 1", { ...budget, maxContextRatio: 1.5 }],
    ["zero ratio", { ...budget, maxContextRatio: 0 }],
    ["zero model calls", { ...budget, maxModelCalls: 0 }],
  ])("rejects %s", (_name, value) => {
    expect(BudgetSchema.safeParse(value).success).toBe(false);
  });
});

describe("AgentInvocationResultSchema", () => {
  it("accepts the canonical result", () => {
    expect(AgentInvocationResultSchema.safeParse(result).success).toBe(true);
  });
  it.each([
    ["unknown status", { ...result, status: "weird" }],
    ["unknown usage key", { ...result, usage: { tokens: 1 } }],
    ["invalid error entry", { ...result, errors: [{ code: "X" }] }],
  ])("rejects %s", (_name, value) => {
    expect(AgentInvocationResultSchema.safeParse(value).success).toBe(false);
  });
});

describe("ProviderCapabilitiesSchema", () => {
  it("accepts the canonical capabilities", () => {
    expect(ProviderCapabilitiesSchema.safeParse(capabilities).success).toBe(
      true,
    );
  });
  it.each([
    ["missing field", without(capabilities, "tools")],
    [
      "undefined maxContextTokens",
      { ...capabilities, maxContextTokens: undefined },
    ],
    ["unknown key", { ...capabilities, extra: true }],
  ])("rejects %s", (_name, value) => {
    expect(ProviderCapabilitiesSchema.safeParse(value).success).toBe(false);
  });
});

describe("JsonSchemaSchema", () => {
  it("accepts objects and rejects arrays", () => {
    expect(JsonSchemaSchema.safeParse({ type: "string" }).success).toBe(true);
    expect(JsonSchemaSchema.safeParse([]).success).toBe(false);
  });
});
