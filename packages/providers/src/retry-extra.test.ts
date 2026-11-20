import { describe, expect, it, vi } from "vitest";
import {
  type GenerateRequest,
  type GenerateResponse,
  type ModelProvider,
} from "@agentlab/core";
import { FakeProvider } from "./testing/fake-provider.js";
import { generateWithRetry } from "./retry.js";

const req: GenerateRequest = {
  model: "writer",
  messages: [{ role: "user", content: "hi" }],
  requires: {},
  maxOutputTokens: 16,
  timeoutMs: 5000,
};

const response: GenerateResponse = {
  content: "ok",
  toolCalls: [],
  usage: { inputTokens: null, outputTokens: null },
  costReported: null,
};

function stub(rejection: unknown) {
  const generate = vi.fn<ModelProvider["generate"]>();
  generate.mockRejectedValueOnce(rejection);
  generate.mockResolvedValue(response);
  const provider: ModelProvider = {
    id: "stub",
    capabilities: new FakeProvider({ script: {} }).capabilities,
    listModels: () => Promise.resolve([]),
    generate,
  };
  return { provider, generate };
}

describe("generateWithRetry: tester additions (mutation survivors)", () => {
  it("never retries an object that is not an AgentLabError, even with retryable: true", async () => {
    const duck = Object.assign(new Error("duck"), { retryable: true });
    const { provider, generate } = stub(duck);
    const reserve = vi.fn<(kind: "model") => void>();
    const sleep = vi.fn(() => Promise.resolve());
    const err = await generateWithRetry(provider, req, {
      signal: new AbortController().signal,
      budget: { reserve },
      sleep,
    }).catch((e: unknown) => e);
    expect(err).toBe(duck);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("makes no further call when the signal aborts while the injected sleep resolves", async () => {
    const { ProviderTimeoutError } = await import("@agentlab/core");
    const { provider, generate } = stub(new ProviderTimeoutError("t"));
    const controller = new AbortController();
    const reason = new Error("stop");
    const err = await generateWithRetry(provider, req, {
      signal: controller.signal,
      budget: { reserve: () => undefined },
      sleep: () => {
        controller.abort(reason);
        return Promise.resolve();
      },
    }).catch((e: unknown) => e);
    expect(err).toBe(reason);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
