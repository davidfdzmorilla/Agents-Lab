import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { ProviderResponseError, type GenerateRequest } from "@agentlab/core";
import { fromChatCompletion, toChatParams } from "./mapping.js";

function req(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: "m",
    messages: [
      { role: "system", content: "s" },
      { role: "user", content: "u" },
    ],
    requires: {},
    maxOutputTokens: 50,
    timeoutMs: 1000,
    ...extra,
  };
}

// Server payloads are untrusted shapes: build them from JSON so tests can omit fields.
function completion(body: object): OpenAI.Chat.Completions.ChatCompletion {
  return JSON.parse(JSON.stringify(body));
}

function withMessage(
  message: object,
  usage?: object,
): OpenAI.Chat.Completions.ChatCompletion {
  return completion({
    id: "c",
    object: "chat.completion",
    created: 0,
    model: "m",
    choices: [{ index: 0, finish_reason: "stop", message }],
    ...(usage === undefined ? {} : { usage }),
  });
}

describe("toChatParams", () => {
  it("maps the minimal request and omits temperature, tools and response_format", () => {
    expect(toChatParams(req())).toEqual({
      model: "m",
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
      max_tokens: 50,
      stream: false,
    });
  });

  it("passes temperature, including 0", () => {
    expect(toChatParams(req({ temperature: 0 })).temperature).toBe(0);
  });

  it("maps tools to function tools", () => {
    const params = toChatParams(
      req({ tools: [{ name: "t", description: "d", parameters: { a: 1 } }] }),
    );
    expect(params.tools).toEqual([
      {
        type: "function",
        function: { name: "t", description: "d", parameters: { a: 1 } },
      },
    ]);
  });

  it("omits tools when the list is empty", () => {
    expect(toChatParams(req({ tools: [] })).tools).toBeUndefined();
  });

  it("maps responseSchema to json_schema without strict", () => {
    expect(
      toChatParams(req({ responseSchema: { type: "object" } })).response_format,
    ).toEqual({
      type: "json_schema",
      json_schema: { name: "response", schema: { type: "object" } },
    });
  });
});

describe("fromChatCompletion", () => {
  it("returns content and usage as reported", () => {
    const out = fromChatCompletion(
      withMessage(
        { role: "assistant", content: "hi" },
        { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
      ),
      "p",
    );
    expect(out).toEqual({
      content: "hi",
      toolCalls: [],
      usage: { inputTokens: 3, outputTokens: 4 },
      costReported: null,
    });
    expect("raw" in out).toBe(false);
  });

  it("returns null usage fields when usage is missing", () => {
    const out = fromChatCompletion(
      withMessage({ role: "assistant", content: "hi" }),
      "p",
    );
    expect(out.usage).toEqual({ inputTokens: null, outputTokens: null });
  });

  it("nulls only the missing or invalid usage field and never derives it from total_tokens", () => {
    const out = fromChatCompletion(
      withMessage(
        { role: "assistant", content: "hi" },
        { prompt_tokens: 3, completion_tokens: -1, total_tokens: 10 },
      ),
      "p",
    );
    expect(out.usage).toEqual({ inputTokens: 3, outputTokens: null });
    const noPrompt = fromChatCompletion(
      withMessage(
        { role: "assistant", content: "hi" },
        { completion_tokens: 4, total_tokens: 10 },
      ),
      "p",
    );
    expect(noPrompt.usage).toEqual({ inputTokens: null, outputTokens: 4 });
  });

  it("reports cost only when it is a finite non-negative number", () => {
    const at = (cost: unknown) =>
      fromChatCompletion(
        withMessage({ role: "assistant", content: "x" }, { cost }),
        "p",
      ).costReported;
    expect(at(0.002)).toBe(0.002);
    expect(at(0)).toBe(0);
    expect(at(-1)).toBeNull();
    expect(at("1")).toBeNull();
  });

  it("returns null content when the message has none", () => {
    expect(
      fromChatCompletion(withMessage({ role: "assistant", content: null }), "p")
        .content,
    ).toBeNull();
  });

  it("parses tool call arguments as JSON and keeps invalid JSON as a string", () => {
    const out = fromChatCompletion(
      withMessage({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "1",
            type: "function",
            function: { name: "a", arguments: '{"x":1}' },
          },
          {
            id: "2",
            type: "function",
            function: { name: "b", arguments: "{oops" },
          },
        ],
      }),
      "p",
    );
    expect(out.toolCalls).toEqual([
      { id: "1", name: "a", arguments: { x: 1 } },
      { id: "2", name: "b", arguments: "{oops" },
    ]);
  });

  it("rejects non-function tool calls", () => {
    expect(() =>
      fromChatCompletion(
        withMessage({
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "1", type: "custom", custom: { name: "a", input: "" } },
          ],
        }),
        "p",
      ),
    ).toThrow(ProviderResponseError);
  });

  it("rejects a response without choices", () => {
    for (const body of [{ choices: [] }, {}, { choices: [{}] }]) {
      expect(() => fromChatCompletion(completion(body), "p")).toThrow(
        ProviderResponseError,
      );
    }
  });
});
