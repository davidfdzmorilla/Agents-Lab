import type { BudgetLimit } from "./budget.js";
import type { RunStatus } from "./run-status.js";

export type AgentLabErrorCode =
  | "PROVIDER_AUTH"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_CAPABILITY"
  | "PROVIDER_RESPONSE"
  | "BUDGET_EXCEEDED"
  | "ENV_INVALID"
  | "API_KEY_ENV_INVALID"
  | "INVALID_TRANSITION";

export interface AgentLabErrorOptions {
  readonly cause?: unknown;
}

export abstract class AgentLabError extends Error {
  readonly code: AgentLabErrorCode;
  readonly retryable: boolean;

  protected constructor(
    code: AgentLabErrorCode,
    message: string,
    retryable: boolean,
    options: AgentLabErrorOptions = {},
  ) {
    super(message, "cause" in options ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }
}

export class ProviderAuthError extends AgentLabError {
  constructor(message: string, options?: AgentLabErrorOptions) {
    super("PROVIDER_AUTH", message, false, options);
  }
}

export class ProviderRateLimitError extends AgentLabError {
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    options: AgentLabErrorOptions & { readonly retryAfterMs?: number } = {},
  ) {
    super("PROVIDER_RATE_LIMIT", message, true, options);
    this.retryAfterMs = options.retryAfterMs;
  }
}

export class ProviderTimeoutError extends AgentLabError {
  constructor(message: string, options?: AgentLabErrorOptions) {
    super("PROVIDER_TIMEOUT", message, true, options);
  }
}

export class ProviderCapabilityError extends AgentLabError {
  constructor(message: string, options?: AgentLabErrorOptions) {
    super("PROVIDER_CAPABILITY", message, false, options);
  }
}

export class ProviderResponseError extends AgentLabError {
  constructor(
    message: string,
    options: AgentLabErrorOptions & { readonly retryable?: boolean } = {},
  ) {
    super("PROVIDER_RESPONSE", message, options.retryable ?? false, options);
  }
}

export class BudgetExceededError extends AgentLabError {
  readonly limit: BudgetLimit;

  constructor(
    limit: BudgetLimit,
    message: string,
    options?: AgentLabErrorOptions,
  ) {
    super("BUDGET_EXCEEDED", message, false, options);
    this.limit = limit;
  }
}

export class EnvValidationError extends AgentLabError {
  constructor(message: string, options?: AgentLabErrorOptions) {
    super("ENV_INVALID", message, false, options);
  }
}

export class InvalidTransitionError extends AgentLabError {
  readonly from: RunStatus;
  readonly to: RunStatus;

  constructor(from: RunStatus, to: RunStatus, options?: AgentLabErrorOptions) {
    super(
      "INVALID_TRANSITION",
      `Invalid run transition: ${from} -> ${to}`,
      false,
      options,
    );
    this.from = from;
    this.to = to;
  }
}

export class InvalidApiKeyEnvError extends AgentLabError {
  constructor() {
    super(
      "API_KEY_ENV_INVALID",
      "provider_configs.api_key_env must name an environment variable matching ^[A-Z][A-Z0-9_]*_API_KEY$ (max 40 characters)",
      false,
    );
  }
}
