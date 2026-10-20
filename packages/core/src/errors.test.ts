import { describe, expect, it } from "vitest";
import {
  AgentLabError,
  BudgetExceededError,
  EnvValidationError,
  InvalidApiKeyEnvError,
  InvalidTransitionError,
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "./errors.js";

describe("AgentLabError subclasses", () => {
  const cause = new TypeError("root");

  it.each([
    [
      "ProviderAuthError",
      new ProviderAuthError("m", { cause }),
      "PROVIDER_AUTH",
      false,
    ],
    [
      "ProviderRateLimitError",
      new ProviderRateLimitError("m", { cause }),
      "PROVIDER_RATE_LIMIT",
      true,
    ],
    [
      "ProviderTimeoutError",
      new ProviderTimeoutError("m", { cause }),
      "PROVIDER_TIMEOUT",
      true,
    ],
    [
      "ProviderCapabilityError",
      new ProviderCapabilityError("m", { cause }),
      "PROVIDER_CAPABILITY",
      false,
    ],
    [
      "ProviderResponseError",
      new ProviderResponseError("m", { cause }),
      "PROVIDER_RESPONSE",
      false,
    ],
    [
      "BudgetExceededError",
      new BudgetExceededError("maxModelCalls", "m", { cause }),
      "BUDGET_EXCEEDED",
      false,
    ],
    [
      "EnvValidationError",
      new EnvValidationError("m", { cause }),
      "ENV_INVALID",
      false,
    ],
    [
      "InvalidTransitionError",
      new InvalidTransitionError("completed", "running", { cause }),
      "INVALID_TRANSITION",
      false,
    ],
  ])(
    "%s has stable code, retryable and cause",
    (name, err, code, retryable) => {
      expect(err).toBeInstanceOf(AgentLabError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(name);
      expect(err.code).toBe(code);
      expect(err.retryable).toBe(retryable);
      expect(err.cause).toBe(cause);
    },
  );

  it("leaves cause undefined when not given", () => {
    expect(new ProviderAuthError("m").cause).toBeUndefined();
    expect("cause" in new ProviderAuthError("m")).toBe(false);
  });

  it("keeps retryAfterMs on rate limit errors", () => {
    expect(
      new ProviderRateLimitError("m", { retryAfterMs: 1500 }).retryAfterMs,
    ).toBe(1500);
    expect(new ProviderRateLimitError("m").retryAfterMs).toBeUndefined();
  });

  it("lets ProviderResponseError be marked retryable", () => {
    expect(new ProviderResponseError("m", { retryable: true }).retryable).toBe(
      true,
    );
  });

  it("keeps the exceeded limit on BudgetExceededError", () => {
    const err = new BudgetExceededError("maxTotalTokens", "m");
    expect(err.limit).toBe("maxTotalTokens");
    expect(err).toBeInstanceOf(BudgetExceededError);
  });

  it("keeps from and to on InvalidTransitionError", () => {
    const err = new InvalidTransitionError("completed", "running");
    expect(err.from).toBe("completed");
    expect(err.to).toBe("running");
    expect(err.message).toContain("completed -> running");
  });

  it("builds InvalidApiKeyEnvError with a fixed message and no cause", () => {
    const err = new InvalidApiKeyEnvError();
    expect(err).toBeInstanceOf(AgentLabError);
    expect(err.code).toBe("API_KEY_ENV_INVALID");
    expect(err.retryable).toBe(false);
    expect(err.name).toBe("InvalidApiKeyEnvError");
    expect(err.message).toBe(
      "provider_configs.api_key_env must name an environment variable matching ^[A-Z][A-Z0-9_]*_API_KEY$ (max 40 characters)",
    );
    expect("cause" in err).toBe(false);
  });
});
