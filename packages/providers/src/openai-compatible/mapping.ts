import type OpenAI from "openai";
import {
  ProviderResponseError,
  type GenerateRequest,
  type GenerateResponse,
  type ToolCall,
} from "@agentlab/core";

export type ChatParams =
  OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

export function toChatParams(req: GenerateRequest): ChatParams {
  return {
    model: req.model,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    // Ollama documents max_tokens, not max_completion_tokens.
    max_tokens: req.maxOutputTokens,
    stream: false,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools !== undefined && req.tools.length > 0
      ? {
          tools: req.tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })),
        }
      : {}),
    // No `strict`: OpenAI strict mode demands every property required and
    // additionalProperties:false. The real validation is Zod in the orchestrator.
    ...(req.responseSchema !== undefined
      ? {
          response_format: {
            type: "json_schema" as const,
            json_schema: { name: "response", schema: req.responseSchema },
          },
        }
      : {}),
  };
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function reportedCost(usage: unknown): number | null {
  if (typeof usage !== "object" || usage === null || !("cost" in usage)) {
    return null;
  }
  const cost = usage.cost;
  return typeof cost === "number" && Number.isFinite(cost) && cost >= 0
    ? cost
    : null;
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Kept as-is: validating tool arguments is the tool's Zod schema, downstream.
    return raw;
  }
}

export function fromChatCompletion(
  res: ChatCompletion,
  providerId: string,
): GenerateResponse {
  const message = res.choices?.[0]?.message;
  if (message === undefined || message === null) {
    throw new ProviderResponseError(
      `Provider "${providerId}" returned a response without choices`,
    );
  }

  const toolCalls: ToolCall[] = [];
  for (const call of message.tool_calls ?? []) {
    if (call.type !== "function") {
      throw new ProviderResponseError(
        `Provider "${providerId}" returned an unsupported tool call type`,
      );
    }
    toolCalls.push({
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    });
  }

  const usage: unknown = res.usage;
  const tokens =
    typeof usage === "object" && usage !== null ? usage : undefined;
  return {
    content: typeof message.content === "string" ? message.content : null,
    toolCalls,
    usage: {
      inputTokens: tokenCount(
        tokens !== undefined && "prompt_tokens" in tokens
          ? tokens.prompt_tokens
          : undefined,
      ),
      outputTokens: tokenCount(
        tokens !== undefined && "completion_tokens" in tokens
          ? tokens.completion_tokens
          : undefined,
      ),
    },
    costReported: reportedCost(usage),
  };
}
