import { describe, expect, it } from "vitest";
import * as core from "./index.js";

describe("public API", () => {
  it("exports the runtime values consumers rely on", () => {
    expect(Object.keys(core).sort()).toEqual(
      [
        "AGENT_ROLES",
        "AgentDefinitionSchema",
        "AgentInvocationResultSchema",
        "AgentLabError",
        "AgentRoleSchema",
        "BudgetExceededError",
        "BudgetSchema",
        "EnvSchema",
        "EnvValidationError",
        "InvalidApiKeyEnvError",
        "InvalidTransitionError",
        "InvocationErrorSchema",
        "InvocationUsageSchema",
        "JsonSchemaSchema",
        "ProviderAuthError",
        "ProviderCapabilitiesSchema",
        "ProviderCapabilityError",
        "ProviderRateLimitError",
        "ProviderResponseError",
        "ProviderTimeoutError",
        "RUN_EVENT_TYPES",
        "RUN_STATUSES",
        "RunEventSchema",
        "RunRequestSchema",
        "RunStatusSchema",
        "TERMINAL_RUN_STATUSES",
        "TeamDefinitionSchema",
        "canTransition",
        "createSecretResolver",
        "isApiKeyEnvName",
        "isTerminalRunStatus",
        "loadEnv",
        "loadTestDatabaseUrl",
      ].sort(),
    );
  });
});
