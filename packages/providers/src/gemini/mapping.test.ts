import { describe, expect, it } from "vitest";
import { GenerateContentResponse } from "@google/genai";
import {
  ProviderCapabilityError,
  ProviderResponseError,
  type GenerateRequest,
} from "@agentlab/core";
import {
  assertRepresentable,
  fromGenerateContentResponse,
  toGenerateParams,
} from "./mapping.js";

function req(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 64,
    timeoutMs: 1000,
    ...extra,
  };
}

function response(init: object): GenerateContentResponse {
  return Object.assign(new GenerateContentResponse(), init);
}

function answer(parts: object[], extra: object = {}): GenerateContentResponse {
  return response({
    candidates: [{ content: { role: "model", parts } }],
    ...extra,
  });
}

describe("toGenerateParams", () => {
  it("joins the leading system messages into systemInstruction", () => {
    const { config, contents } = toGenerateParams(
      req({
        messages: [
          { role: "system", content: "a" },
          { role: "system", content: "b" },
          { role: "user", content: "q" },
        ],
      }),
    );
    expect(config.systemInstruction).toBe("a\n\nb");
    expect(contents).toEqual([{ role: "user", parts: [{ text: "q" }] }]);
  });

  it("maps assistant to the model role and omits systemInstruction without system", () => {
    const { config, contents } = toGenerateParams(
      req({
        messages: [
          { role: "user", content: "q" },
          { role: "assistant", content: "a" },
        ],
      }),
    );
    expect(contents.map((c) => c.role)).toEqual(["user", "model"]);
    expect("systemInstruction" in config).toBe(false);
  });

  it("always disables continuation and automatic function calling", () => {
    const { config } = toGenerateParams(req());
    expect(config.automaticContinuation).toBe(false);
    expect(config.automaticFunctionCalling).toEqual({ disable: true });
    expect(config.maxOutputTokens).toBe(64);
  });

  it("sends temperature only when given", () => {
    expect("temperature" in toGenerateParams(req()).config).toBe(false);
    expect(toGenerateParams(req({ temperature: 0 })).config.temperature).toBe(
      0,
    );
  });

  it("maps tools to functionDeclarations with parametersJsonSchema", () => {
    const parameters = { type: "object", properties: {} };
    const { config } = toGenerateParams(
      req({ tools: [{ name: "t", description: "d", parameters }] }),
    );
    expect(config.tools).toEqual([
      {
        functionDeclarations: [
          { name: "t", description: "d", parametersJsonSchema: parameters },
        ],
      },
    ]);
  });

  it("omits tools when the list is empty", () => {
    expect("tools" in toGenerateParams(req({ tools: [] })).config).toBe(false);
  });

  it("maps responseSchema to a JSON mime type and responseJsonSchema", () => {
    const schema = { type: "object" };
    const { config } = toGenerateParams(req({ responseSchema: schema }));
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toEqual(schema);
  });
});

describe("assertRepresentable", () => {
  it("accepts leading system messages followed by turns", () => {
    expect(() => {
      assertRepresentable(
        "g",
        req({
          messages: [
            { role: "system", content: "s" },
            { role: "user", content: "u" },
            { role: "assistant", content: "a" },
          ],
        }),
      );
    }).not.toThrow();
  });

  it("rejects a system message after a turn", () => {
    expect(() => {
      assertRepresentable(
        "g",
        req({
          messages: [
            { role: "user", content: "u" },
            { role: "system", content: "s" },
          ],
        }),
      );
    }).toThrow(ProviderCapabilityError);
  });

  it.each([[[]], [[{ role: "system" as const, content: "s" }]]])(
    "rejects a conversation without user or assistant turns",
    (messages) => {
      expect(() => {
        assertRepresentable("g", req({ messages }));
      }).toThrow(ProviderCapabilityError);
    },
  );
});

describe("fromGenerateContentResponse", () => {
  it("concatenates text parts and skips thought parts", () => {
    const res = fromGenerateContentResponse(
      answer([
        { text: "hidden", thought: true },
        { text: "Hel" },
        { text: "lo" },
      ]),
      "g",
    );
    expect(res.content).toBe("Hello");
    expect(res.toolCalls).toEqual([]);
    expect(res.costReported).toBeNull();
    expect("raw" in res).toBe(false);
  });

  it("maps function calls, using the provider id or a positional fallback", () => {
    const res = fromGenerateContentResponse(
      answer([
        { functionCall: { name: "a", args: { x: 1 } } },
        { functionCall: { id: "fc-9", name: "b" } },
        { functionCall: { id: "", name: "c", args: {} } },
      ]),
      "g",
    );
    expect(res.content).toBeNull();
    expect(res.toolCalls).toEqual([
      { id: "call_0", name: "a", arguments: { x: 1 } },
      { id: "fc-9", name: "b", arguments: {} },
      { id: "call_2", name: "c", arguments: {} },
    ]);
  });

  it("rejects a function call without a name", () => {
    expect(() =>
      fromGenerateContentResponse(
        answer([{ functionCall: { args: {} } }]),
        "g",
      ),
    ).toThrow(ProviderResponseError);
  });

  it("returns null content for a candidate without parts", () => {
    const res = fromGenerateContentResponse(
      response({ candidates: [{ finishReason: "SAFETY" }] }),
      "g",
    );
    expect(res.content).toBeNull();
    expect(res.toolCalls).toEqual([]);
  });

  it("rejects a response without candidates", () => {
    const err = (() => {
      try {
        fromGenerateContentResponse(response({}), "g");
      } catch (e) {
        return e;
      }
      return undefined;
    })();
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty(
      "message",
      'Provider "g" returned a response without candidates',
    );
  });

  it("uses a fixed message when the prompt was blocked, without the reason", () => {
    const err = (() => {
      try {
        fromGenerateContentResponse(
          response({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" } }),
          "g",
        );
      } catch (e) {
        return e;
      }
      return undefined;
    })();
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("message", 'Provider "g" blocked the prompt');
  });

  it.each([[null], ["text"], [42]])(
    "rejects a non-object part %j as a non-retryable malformed response",
    (part) => {
      const err = (() => {
        try {
          fromGenerateContentResponse(
            response({ candidates: [{ content: { parts: [part] } }] }),
            "g",
          );
        } catch (e) {
          return e;
        }
        return undefined;
      })();
      expect(err).toBeInstanceOf(ProviderResponseError);
      expect(err).toHaveProperty("retryable", false);
      expect(err).toHaveProperty(
        "message",
        'Provider "g" returned a malformed response part',
      );
    },
  );

  it("adds thinking tokens to the output tokens (OD-081)", () => {
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], {
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          thoughtsTokenCount: 7,
        },
      }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 12 });
  });

  it("reports output tokens without thinking when thoughts is absent", () => {
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], {
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 4 },
      }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: 1, outputTokens: 4 });
  });

  it("reports only the thinking tokens when candidatesTokenCount is missing (OD-084 b)", () => {
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], {
        usageMetadata: { promptTokenCount: 1, thoughtsTokenCount: 3 },
      }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: 1, outputTokens: 3 });
  });

  it("reports null output tokens when the provider reports neither figure, never an estimate", () => {
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], { usageMetadata: { promptTokenCount: 1 } }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: 1, outputTokens: null });
  });

  it("ignores an invalid figure when the other one is valid", () => {
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], {
        usageMetadata: { candidatesTokenCount: 4, thoughtsTokenCount: -2 },
      }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: null, outputTokens: 4 });
  });

  it("reports null usage without usageMetadata and rejects invalid counts", () => {
    expect(
      fromGenerateContentResponse(answer([{ text: "x" }]), "g").usage,
    ).toEqual({ inputTokens: null, outputTokens: null });
    const res = fromGenerateContentResponse(
      answer([{ text: "x" }], {
        usageMetadata: { promptTokenCount: -1, candidatesTokenCount: 1.5 },
      }),
      "g",
    );
    expect(res.usage).toEqual({ inputTokens: null, outputTokens: null });
  });
});
