import type {
  Content,
  GenerateContentConfig,
  GenerateContentResponse,
} from "@google/genai";
import {
  ProviderCapabilityError,
  ProviderResponseError,
  type GenerateRequest,
  type GenerateResponse,
  type ToolCall,
} from "@agentlab/core";

export interface GenerateParams {
  readonly model: string;
  readonly contents: Content[];
  readonly config: GenerateContentConfig;
}

// Gemini has one systemInstruction and only user/model turns. A system message after a
// turn, or a conversation without turns, cannot be represented without changing its
// meaning, so it fails before the network (OD-082, SPEC §2.1: never degrade silently).
export function assertRepresentable(
  providerId: string,
  req: GenerateRequest,
): void {
  const firstTurn = req.messages.findIndex((m) => m.role !== "system");
  const misplacedSystem =
    firstTurn !== -1 &&
    req.messages.slice(firstTurn).some((m) => m.role === "system");
  if (firstTurn === -1 || misplacedSystem) {
    throw new ProviderCapabilityError(
      `Provider "${providerId}" cannot represent these messages: system messages must come first and at least one user or assistant message is required`,
    );
  }
}

export function toGenerateParams(req: GenerateRequest): GenerateParams {
  const system: string[] = [];
  const contents: Content[] = [];
  for (const m of req.messages) {
    if (m.role === "system") system.push(m.content);
    else {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
  }

  const config: GenerateContentConfig = {
    maxOutputTokens: req.maxOutputTokens,
    // Both default to enabled in the SDK; either would make extra HTTP calls that the
    // budget does not see. One generate() is one request.
    automaticContinuation: false,
    automaticFunctionCalling: { disable: true },
    ...(system.length > 0 ? { systemInstruction: system.join("\n\n") } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    // parametersJsonSchema takes plain JSON Schema; `parameters` is the OpenAPI subset.
    ...(req.tools !== undefined && req.tools.length > 0
      ? {
          tools: [
            {
              functionDeclarations: req.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
              })),
            },
          ],
        }
      : {}),
    // The real validation is Zod in the orchestrator.
    ...(req.responseSchema !== undefined
      ? {
          responseMimeType: "application/json",
          responseJsonSchema: req.responseSchema,
        }
      : {}),
  };
  return { model: req.model, contents, config };
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Output tokens are billed as candidates plus thinking tokens (OD-081, OD-084 b; SPEC §13).
// Both figures come from the provider; nothing is estimated, and null only when the
// provider reported neither.
function outputTokens(candidates: unknown, thoughts: unknown): number | null {
  const base = tokenCount(candidates);
  const thinking = tokenCount(thoughts);
  if (base === null && thinking === null) return null;
  return (base ?? 0) + (thinking ?? 0);
}

// Reads fields directly: the `.text` and `.functionCalls` getters console.warn.
export function fromGenerateContentResponse(
  res: GenerateContentResponse,
  providerId: string,
): GenerateResponse {
  const candidate = res.candidates?.[0];
  if (candidate === undefined || candidate === null) {
    throw new ProviderResponseError(
      res.promptFeedback?.blockReason !== undefined
        ? `Provider "${providerId}" blocked the prompt`
        : `Provider "${providerId}" returned a response without candidates`,
    );
  }

  const texts: string[] = [];
  const toolCalls: ToolCall[] = [];
  for (const part of candidate.content?.parts ?? []) {
    // The SDK types are a promise, not a check: a 200 can carry anything in `parts`.
    const untyped: unknown = part;
    if (!isRecord(untyped)) {
      throw new ProviderResponseError(
        `Provider "${providerId}" returned a malformed response part`,
      );
    }
    const call = part.functionCall;
    if (call !== undefined && call !== null) {
      if (typeof call.name !== "string" || call.name === "") {
        throw new ProviderResponseError(
          `Provider "${providerId}" returned a tool call without a name`,
        );
      }
      toolCalls.push({
        id:
          typeof call.id === "string" && call.id !== ""
            ? call.id
            : `call_${toolCalls.length}`,
        name: call.name,
        arguments: call.args ?? {},
      });
    } else if (typeof part.text === "string" && part.thought !== true) {
      texts.push(part.text);
    }
  }

  const usage = res.usageMetadata;
  return {
    content: texts.length > 0 ? texts.join("") : null,
    toolCalls,
    usage: {
      inputTokens: tokenCount(usage?.promptTokenCount),
      outputTokens: outputTokens(
        usage?.candidatesTokenCount,
        usage?.thoughtsTokenCount,
      ),
    },
    costReported: null,
  };
}
