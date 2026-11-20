import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BudgetExceededError,
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
  type GenerateRequest,
  type GenerateResponse,
  type ModelProvider,
  type ProviderCapabilities,
} from "@agentlab/core";
import { FakeProvider, type FakeStep } from "./testing/fake-provider.js";
import {
  DEFAULT_RETRY_POLICY,
  generateWithRetry,
  type CallBudget,
  type RetryPolicy,
} from "./retry.js";

const ROLE = "writer";

function req(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: ROLE,
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 16,
    timeoutMs: 5000,
    ...extra,
  };
}

function fake(steps: readonly FakeStep[], capabilities?: ProviderCapabilities) {
  return new FakeProvider({
    script: { [ROLE]: steps },
    ...(capabilities === undefined ? {} : { capabilities }),
  });
}

const OK: FakeStep = { kind: "respond", content: "done" };
const RATE: FakeStep = { kind: "rateLimit" };

function counter() {
  const reserve = vi.fn<(kind: "model") => void>();
  const budget: CallBudget = { reserve };
  return { budget, reserve };
}

function sleeper() {
  const waits: number[] = [];
  const sleep = (ms: number): Promise<void> => {
    waits.push(ms);
    return Promise.resolve();
  };
  return { sleep, waits };
}

const live = new AbortController().signal;

function stub(
  errors: readonly unknown[],
): ModelProvider & { readonly generate: ReturnType<typeof vi.fn> } {
  const generate = vi.fn<ModelProvider["generate"]>();
  for (const e of errors) generate.mockRejectedValueOnce(e);
  const response: GenerateResponse = {
    content: "ok",
    toolCalls: [],
    usage: { inputTokens: null, outputTokens: null },
    costReported: null,
  };
  generate.mockResolvedValue(response);
  const caps = new FakeProvider({ script: {} }).capabilities;
  return {
    id: "stub",
    capabilities: caps,
    listModels: () => Promise.resolve([]),
    generate,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("DEFAULT_RETRY_POLICY", () => {
  it("has the documented values and is frozen", () => {
    expect(DEFAULT_RETRY_POLICY).toEqual({
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 8000,
      jitterRatio: 0.25,
      maxRetryAfterMs: 60000,
    });
    expect(Object.isFrozen(DEFAULT_RETRY_POLICY)).toBe(true);
  });
});

describe("generateWithRetry: success and capabilities", () => {
  it("returns the response of the first call without waiting", async () => {
    const provider = fake([OK]);
    const { budget, reserve } = counter();
    const { sleep, waits } = sleeper();
    const res = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep,
    });
    expect(res.content).toBe("done");
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledWith("model");
    expect(provider.calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("throws ProviderCapabilityError before any reservation or call", async () => {
    const provider = fake([OK], {
      ...new FakeProvider({ script: {} }).capabilities,
      tools: false,
    });
    const { budget, reserve } = counter();
    const err = await generateWithRetry(
      provider,
      req({ requires: { tools: true } }),
      { signal: live, budget },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderCapabilityError);
    expect(reserve).not.toHaveBeenCalled();
    expect(provider.calls).toHaveLength(0);
  });
});

describe("generateWithRetry: what is retried", () => {
  it("retries a retryable AgentLabError and returns the later success", async () => {
    const provider = fake([{ kind: "timeout" }, OK]);
    const { budget } = counter();
    const { sleep } = sleeper();
    const res = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep,
    });
    expect(res.content).toBe("done");
    expect(provider.calls).toHaveLength(2);
  });

  it("retries a retryable ProviderResponseError (5xx-like)", async () => {
    const provider = stub([
      new ProviderResponseError("boom", { retryable: true }),
    ]);
    const { budget } = counter();
    const { sleep } = sleeper();
    await generateWithRetry(provider, req(), { signal: live, budget, sleep });
    expect(provider.generate).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable AgentLabError and rethrows the same object", async () => {
    const original = new ProviderAuthError("nope");
    const provider = stub([original]);
    const { budget, reserve } = counter();
    const { sleep, waits } = sleeper();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep,
    }).catch((e: unknown) => e);
    expect(err).toBe(original);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it("does not retry an error that is not an AgentLabError", async () => {
    const original = new TypeError("not ours");
    const provider = stub([original]);
    const { budget } = counter();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
    }).catch((e: unknown) => e);
    expect(err).toBe(original);
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it("does not retry the signal reason when generate rejects after an abort", async () => {
    const controller = new AbortController();
    const reason = new Error("run cancelled");
    const provider = stub([]);
    provider.generate.mockImplementationOnce(() => {
      controller.abort(reason);
      return Promise.reject(new ProviderTimeoutError("late"));
    });
    const { budget, reserve } = counter();
    const err = await generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget,
    }).catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
  });
});

describe("generateWithRetry: backoff", () => {
  const timeouts: FakeStep[] = [
    { kind: "timeout" },
    { kind: "timeout" },
    { kind: "timeout" },
  ];

  it("waits min(base * 2^n, max) at random = 0", async () => {
    const provider = fake([...timeouts, OK]);
    const { sleep, waits } = sleeper();
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep,
      random: () => 0,
      policy: { maxRetries: 3, maxDelayMs: 1500 },
    });
    expect(waits).toEqual([500, 1000, 1500]);
  });

  it("subtracts the jitter at random = 0.999...", async () => {
    const provider = fake([...timeouts, OK]);
    const { sleep, waits } = sleeper();
    const r = 0.999;
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep,
      random: () => r,
      policy: { maxRetries: 3, maxDelayMs: 1500 },
    });
    const f = 1 - r * 0.25;
    expect(waits).toEqual([500 * f, 1000 * f, 1500 * f]);
    for (const w of waits) expect(w).toBeLessThan(1500);
  });

  it("uses Math.random and the real sleep when none is injected", async () => {
    vi.useFakeTimers();
    const provider = fake([RATE, OK]);
    const promise = generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
    });
    await vi.advanceTimersByTimeAsync(500);
    expect((await promise).content).toBe("done");
  });
});

describe("generateWithRetry: retryAfterMs", () => {
  it("waits exactly retryAfterMs, without jitter", async () => {
    const provider = fake([{ kind: "rateLimit", retryAfterMs: 1234 }, OK]);
    const { sleep, waits } = sleeper();
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep,
      random: () => 0.999,
    });
    expect(waits).toEqual([1234]);
  });

  it("waits retryAfterMs equal to the cap", async () => {
    const provider = fake([{ kind: "rateLimit", retryAfterMs: 60_000 }, OK]);
    const { sleep, waits } = sleeper();
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep,
    });
    expect(waits).toEqual([60_000]);
  });

  it("does not retry, wait or reserve when retryAfterMs exceeds the cap", async () => {
    const original = new ProviderRateLimitError("limited", {
      retryAfterMs: 999_999_999_000,
    });
    const provider = stub([original]);
    const { budget, reserve } = counter();
    const { sleep, waits } = sleeper();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep,
    }).catch((e: unknown) => e);
    expect(err).toBe(original);
    expect(original.retryAfterMs).toBe(999_999_999_000);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it("honours a custom maxRetryAfterMs", async () => {
    const provider = fake([{ kind: "rateLimit", retryAfterMs: 101 }, OK]);
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep: () => Promise.resolve(),
      policy: { maxRetryAfterMs: 100 },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderRateLimitError);
    expect(provider.calls).toHaveLength(1);
  });

  it("falls back to the backoff for a 429 without retryAfterMs", async () => {
    const provider = fake([RATE, OK]);
    const { sleep, waits } = sleeper();
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep,
      random: () => 0,
    });
    expect(waits).toEqual([500]);
  });
});

describe("generateWithRetry: maxRetries", () => {
  it("makes at most maxRetries + 1 calls and rethrows the last error", async () => {
    const errors = [1, 2, 3, 4].map(() => new ProviderTimeoutError("t"));
    const provider = stub(errors);
    const { budget, reserve } = counter();
    const { sleep, waits } = sleeper();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep,
      random: () => 0,
      policy: { maxRetries: 3 },
    }).catch((e: unknown) => e);
    expect(err).toBe(errors[3]);
    expect(provider.generate).toHaveBeenCalledTimes(4);
    expect(reserve).toHaveBeenCalledTimes(4);
    expect(waits).toHaveLength(3);
  });

  it("with maxRetries 0 makes one call and rethrows the original", async () => {
    const original = new ProviderTimeoutError("t");
    const provider = stub([original]);
    const { budget, reserve } = counter();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      policy: { maxRetries: 0 },
    }).catch((e: unknown) => e);
    expect(err).toBe(original);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
  });

  it("uses the default of two retries", async () => {
    const provider = stub([
      new ProviderTimeoutError("a"),
      new ProviderTimeoutError("b"),
      new ProviderTimeoutError("c"),
    ]);
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: counter().budget,
      sleep: () => Promise.resolve(),
    }).catch(() => undefined);
    expect(provider.generate).toHaveBeenCalledTimes(3);
  });

  it.each<[string, Partial<RetryPolicy>]>([
    ["negative maxRetries", { maxRetries: -1 }],
    ["fractional maxRetries", { maxRetries: 1.5 }],
    ["NaN maxRetries", { maxRetries: Number.NaN }],
    ["infinite maxRetries", { maxRetries: Infinity }],
    ["negative baseDelayMs", { baseDelayMs: -1 }],
    ["infinite maxDelayMs", { maxDelayMs: Infinity }],
    ["negative maxRetryAfterMs", { maxRetryAfterMs: -1 }],
    ["jitterRatio above 1", { jitterRatio: 1.01 }],
    ["negative jitterRatio", { jitterRatio: -0.1 }],
    ["baseDelayMs above maxDelayMs", { baseDelayMs: 9000 }],
    ["a string value", { maxRetries: "2" as unknown as number }],
  ])(
    "rejects an invalid policy (%s) before reserving or calling",
    async (_n, policy) => {
      const provider = fake([OK]);
      const { budget, reserve } = counter();
      const err = await generateWithRetry(provider, req(), {
        signal: live,
        budget,
        policy,
      }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect(err).toHaveProperty("retryable", false);
      expect(reserve).not.toHaveBeenCalled();
      expect(provider.calls).toHaveLength(0);
    },
  );

  it("accepts jitterRatio at both ends of its range", async () => {
    for (const jitterRatio of [0, 1]) {
      const provider = fake([RATE, OK]);
      const res = await generateWithRetry(provider, req(), {
        signal: live,
        budget: counter().budget,
        sleep: () => Promise.resolve(),
        policy: { jitterRatio },
      });
      expect(res.content).toBe("done");
    }
  });
});

describe("generateWithRetry: budget", () => {
  it("reserves once per attempt, so N retries mean N + 1 reservations", async () => {
    const provider = fake([RATE, RATE, OK]);
    const { budget, reserve } = counter();
    await generateWithRetry(provider, req(), {
      signal: live,
      budget,
      sleep: () => Promise.resolve(),
    });
    expect(reserve).toHaveBeenCalledTimes(3);
    for (const call of reserve.mock.calls) expect(call).toEqual(["model"]);
  });

  it("reserves the next attempt before waiting for it", async () => {
    const events: string[] = [];
    const provider = fake([RATE, OK]);
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: { reserve: () => void events.push("reserve") },
      sleep: () => {
        events.push("sleep");
        return Promise.resolve();
      },
    });
    expect(events).toEqual(["reserve", "reserve", "sleep"]);
  });

  it("reserves before the call to generate", async () => {
    const events: string[] = [];
    const provider = stub([]);
    provider.generate.mockImplementationOnce(() => {
      events.push("generate");
      return Promise.reject(new ProviderAuthError("x"));
    });
    await generateWithRetry(provider, req(), {
      signal: live,
      budget: { reserve: () => void events.push("reserve") },
    }).catch(() => undefined);
    expect(events).toEqual(["reserve", "generate"]);
  });

  it("propagates BudgetExceededError of the retry without more calls or waits", async () => {
    const exceeded = new BudgetExceededError("maxModelCalls", "no calls left");
    const reserve = vi
      .fn<(kind: "model") => void>()
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw exceeded;
      });
    const provider = fake([RATE, OK]);
    const { sleep, waits } = sleeper();
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget: { reserve },
      sleep,
    }).catch((e: unknown) => e);
    expect(err).toBe(exceeded);
    expect(provider.calls).toHaveLength(1);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([]);
  });

  it("propagates BudgetExceededError of the first reservation without calling", async () => {
    const exceeded = new BudgetExceededError("maxModelCalls", "no calls left");
    const provider = fake([OK]);
    const err = await generateWithRetry(provider, req(), {
      signal: live,
      budget: {
        reserve: () => {
          throw exceeded;
        },
      },
    }).catch((e: unknown) => e);
    expect(err).toBe(exceeded);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("generateWithRetry: AbortSignal", () => {
  it("rejects with signal.reason, reserving and calling nothing, when already aborted", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    controller.abort(reason);
    const provider = fake([OK]);
    const { budget, reserve } = counter();
    const err = await generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget,
    }).catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect(reserve).not.toHaveBeenCalled();
    expect(provider.calls).toHaveLength(0);
  });

  it("rejects with signal.reason during the wait, without waiting for the timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error("stop");
    const provider = fake([RATE, OK]);
    const settled = generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget: counter().budget,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.getTimerCount()).toBe(1);
    controller.abort(reason);
    expect(await settled).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
    expect(provider.calls).toHaveLength(1);
  });

  it("removes the abort listener once the wait is over", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const provider = fake([RATE, OK]);
    const promise = generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget: counter().budget,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await promise;
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects with signal.reason if aborted while the injected sleep resolves", async () => {
    const controller = new AbortController();
    const reason = new Error("stop");
    const provider = fake([RATE, OK]);
    const err = await generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget: counter().budget,
      sleep: () => {
        controller.abort(reason);
        return Promise.resolve();
      },
    }).catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect(provider.calls).toHaveLength(1);
  });

  it("the default sleep rejects at once on an aborted signal", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const reason = new Error("stop");
    const provider = fake([RATE, OK]);
    let reservations = 0;
    const err = await generateWithRetry(provider, req(), {
      signal: controller.signal,
      budget: {
        reserve: () => {
          reservations += 1;
          if (reservations === 2) controller.abort(reason);
        },
      },
    }).catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });
});
