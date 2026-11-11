import { describe, expect, it } from "vitest";
import {
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
  type GenerateRequest,
} from "@agentlab/core";
import { FakeProvider } from "./index.js";

function req(
  model: string,
  extra: Partial<GenerateRequest> = {},
): GenerateRequest {
  return {
    model,
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 10,
    timeoutMs: 1000,
    ...extra,
  };
}
const live = new AbortController().signal;

describe("FakeProvider", () => {
  it("consumes the script in order and independently per role", async () => {
    const p = new FakeProvider({
      script: {
        writer: [
          { kind: "respond", content: "w1" },
          { kind: "respond", content: "w2" },
        ],
        critic: [{ kind: "respond", content: "c1" }],
      },
    });
    expect((await p.generate(req("writer"), live)).content).toBe("w1");
    expect((await p.generate(req("critic"), live)).content).toBe("c1");
    expect((await p.generate(req("writer"), live)).content).toBe("w2");
  });

  it("is deterministic: two instances with the same script give the same sequence", async () => {
    const script = {
      a: [{ kind: "respond", content: "x" }, { kind: "invalidOutput" }],
    } as const;
    const run = async () => {
      const p = new FakeProvider({ script });
      return [
        await p.generate(req("a"), live),
        await p.generate(req("a"), live),
      ];
    };
    expect(await run()).toEqual(await run());
  });

  it("returns null usage and cost by default and passes configured ones through", async () => {
    const p = new FakeProvider({
      script: {
        a: [
          { kind: "respond", content: "x" },
          {
            kind: "respond",
            content: null,
            toolCalls: [{ id: "1", name: "t", arguments: { q: 1 } }],
            usage: { inputTokens: 1, outputTokens: 2 },
            costReported: 0.5,
          },
        ],
      },
    });
    expect(await p.generate(req("a"), live)).toEqual({
      content: "x",
      toolCalls: [],
      usage: { inputTokens: null, outputTokens: null },
      costReported: null,
    });
    expect(await p.generate(req("a"), live)).toEqual({
      content: null,
      toolCalls: [{ id: "1", name: "t", arguments: { q: 1 } }],
      usage: { inputTokens: 1, outputTokens: 2 },
      costReported: 0.5,
    });
  });

  it("simulates a 429 with and without retryAfterMs", async () => {
    const p = new FakeProvider({
      script: {
        a: [{ kind: "rateLimit", retryAfterMs: 1500 }, { kind: "rateLimit" }],
      },
    });
    const first = await p.generate(req("a"), live).catch((e: unknown) => e);
    expect(first).toBeInstanceOf(ProviderRateLimitError);
    expect(first).toMatchObject({ retryAfterMs: 1500, retryable: true });
    const second = await p.generate(req("a"), live).catch((e: unknown) => e);
    expect(second).toBeInstanceOf(ProviderRateLimitError);
    expect(second).toMatchObject({ retryAfterMs: undefined });
  });

  it("simulates a timeout immediately", async () => {
    const p = new FakeProvider({ script: { a: [{ kind: "timeout" }] } });
    const err = await p.generate(req("a"), live).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect(err).toMatchObject({ retryable: true });
  });

  it("simulates invalid output with a default and a custom body", async () => {
    const p = new FakeProvider({
      script: {
        a: [
          { kind: "invalidOutput" },
          { kind: "invalidOutput", content: "{}x" },
        ],
      },
    });
    const first = await p.generate(req("a"), live);
    expect(() => JSON.parse(first.content ?? "")).toThrow();
    expect((await p.generate(req("a"), live)).content).toBe("{}x");
  });

  it("fails visibly when the script of a role is exhausted or missing", async () => {
    const p = new FakeProvider({
      script: { a: [{ kind: "respond", content: "x" }] },
    });
    await p.generate(req("a"), live);
    for (const model of ["a", "unknown", "toString"]) {
      const err = await p.generate(req(model), live).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect(err).toMatchObject({ retryable: false });
    }
  });

  it("records every call with its role and request", async () => {
    const p = new FakeProvider({
      script: { hi: [{ kind: "respond" }] },
      roleOf: (r) => r.messages[0]?.content ?? "",
    });
    const request = req("whatever");
    await p.generate(request, live);
    expect(p.calls).toEqual([{ role: "hi", request }]);
  });

  it("uses roleOf instead of the model when given", async () => {
    const p = new FakeProvider({
      script: { custom: [{ kind: "respond", content: "ok" }] },
      roleOf: () => "custom",
    });
    expect((await p.generate(req("any"), live)).content).toBe("ok");
  });

  it("rejects unsupported capabilities before consuming the script", async () => {
    const p = new FakeProvider({
      capabilities: {
        tools: false,
        structuredOutput: false,
        streaming: false,
        maxContextTokens: null,
        reportsUsage: false,
        reportsCost: false,
      },
      script: { a: [{ kind: "respond", content: "x" }] },
    });
    await expect(
      p.generate(req("a", { requires: { tools: true } }), live),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);
    expect(p.calls).toHaveLength(0);
    expect((await p.generate(req("a"), live)).content).toBe("x");
  });

  it("rethrows the reason of an already aborted signal without consuming the script", async () => {
    const p = new FakeProvider({
      script: { a: [{ kind: "respond", content: "x" }] },
    });
    const ac = new AbortController();
    const reason = new Error("cancelled");
    ac.abort(reason);
    await expect(p.generate(req("a"), ac.signal)).rejects.toBe(reason);
    expect(p.calls).toHaveLength(0);
  });

  it("exposes id, frozen default capabilities and listModels", async () => {
    const p = new FakeProvider({ script: {}, models: [{ id: "m1" }] });
    expect(p.id).toBe("fake");
    expect(p.capabilities).toMatchObject({
      tools: true,
      structuredOutput: true,
      reportsCost: false,
    });
    expect(Object.isFrozen(p.capabilities)).toBe(true);
    expect(await p.listModels()).toEqual([{ id: "m1" }]);
    expect(
      await new FakeProvider({ script: {}, id: "x" }).listModels(),
    ).toEqual([]);
  });
});
