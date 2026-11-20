import {
  AgentLabError,
  ProviderRateLimitError,
  ProviderResponseError,
  type GenerateRequest,
  type GenerateResponse,
  type ModelProvider,
} from "@agentlab/core";
import { assertCapabilities } from "./capabilities.js";

// Structural port: `BudgetGuard.reserve` (ARCHITECTURE §3.3) satisfies it. It throws
// `BudgetExceededError` when no call is left.
export interface CallBudget {
  reserve(kind: "model"): void;
}

export interface RetryPolicy {
  /** Retries after the first call, so at most `maxRetries + 1` calls to `generate`. */
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  /** 0..1: the delay is reduced by up to this fraction. */
  readonly jitterRatio: number;
  /** A larger `retryAfterMs` is not waited for: the original error is rethrown (OD-085). */
  readonly maxRetryAfterMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  jitterRatio: 0.25,
  maxRetryAfterMs: 60_000,
});

export interface GenerateWithRetryOptions {
  readonly signal: AbortSignal;
  readonly budget: CallBudget;
  readonly policy?: Partial<RetryPolicy>;
  readonly sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Returns a number in [0, 1). */
  readonly random?: () => number;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function resolvePolicy(partial: Partial<RetryPolicy> | undefined): RetryPolicy {
  const policy = { ...DEFAULT_RETRY_POLICY, ...partial };
  const valid =
    Number.isInteger(policy.maxRetries) &&
    isNonNegativeFinite(policy.maxRetries) &&
    isNonNegativeFinite(policy.baseDelayMs) &&
    isNonNegativeFinite(policy.maxDelayMs) &&
    isNonNegativeFinite(policy.maxRetryAfterMs) &&
    isNonNegativeFinite(policy.jitterRatio) &&
    policy.jitterRatio <= 1 &&
    policy.baseDelayMs <= policy.maxDelayMs;
  if (!valid) {
    throw new ProviderResponseError("The retry policy is invalid");
  }
  return policy;
}

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function backoffMs(
  retry: number,
  policy: RetryPolicy,
  random: () => number,
): number {
  const capped = Math.min(policy.baseDelayMs * 2 ** retry, policy.maxDelayMs);
  return capped * (1 - random() * policy.jitterRatio);
}

// Capabilities are checked before the first reservation and before any network call. Every
// attempt, the first included, reserves one model call; a retry reserves before it waits so
// an exhausted budget is found out without sleeping (OD-087). Errors are rethrown as they
// came: nothing is wrapped and no `cause` is added.
export async function generateWithRetry(
  provider: ModelProvider,
  req: GenerateRequest,
  options: GenerateWithRetryOptions,
): Promise<GenerateResponse> {
  const { signal, budget } = options;
  const policy = resolvePolicy(options.policy);
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  assertCapabilities(provider.id, provider.capabilities, req);
  signal.throwIfAborted();
  budget.reserve("model");

  for (let retry = 0; ; retry++) {
    try {
      return await provider.generate(req, signal);
    } catch (err: unknown) {
      signal.throwIfAborted();
      if (
        !(err instanceof AgentLabError) ||
        !err.retryable ||
        retry >= policy.maxRetries
      ) {
        throw err;
      }
      let delayMs: number;
      if (
        err instanceof ProviderRateLimitError &&
        err.retryAfterMs !== undefined
      ) {
        if (err.retryAfterMs > policy.maxRetryAfterMs) throw err;
        delayMs = err.retryAfterMs;
      } else {
        delayMs = backoffMs(retry, policy, random);
      }
      budget.reserve("model");
      await sleep(delayMs, signal);
      signal.throwIfAborted();
    }
  }
}
