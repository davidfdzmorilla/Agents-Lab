import type {
  AgentDefinitionRow,
  ProviderConfigRow,
} from "@agentlab/persistence";

// Row factories for unit tests of the pure view builders.
export const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
export const CONFIG_ID = "00000000-0000-4000-8000-0000000000c1";
const NOW = new Date(0);

export function configRow(
  overrides: Partial<ProviderConfigRow> = {},
): ProviderConfigRow {
  return {
    id: CONFIG_ID,
    createdAt: NOW,
    updatedAt: NOW,
    projectId: PROJECT_ID,
    providerType: "openrouter",
    baseUrl: "http://169.254.169.254/CANARY-URL",
    defaultModel: "default-model",
    apiKeyEnv: "OPENROUTER_API_KEY",
    ...overrides,
  };
}

export function agentRow(
  overrides: Partial<AgentDefinitionRow> = {},
): AgentDefinitionRow {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    createdAt: NOW,
    updatedAt: NOW,
    projectId: PROJECT_ID,
    name: "agent",
    role: "researcher",
    systemPrompt: "prompt",
    promptVersion: "1.0.0",
    providerConfigId: CONFIG_ID,
    modelId: "agent-model",
    toolAllowlist: [],
    maxCalls: 1,
    maxTokens: 1,
    timeoutMs: 1,
    outputSchema: { type: "object" },
    enabled: true,
    ...overrides,
  };
}
