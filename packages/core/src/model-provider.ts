import type { JsonSchema } from "./json-schema.js";
import type { ProviderCapabilities } from "./provider-capabilities.js";

export interface ModelInfo {
  id: string;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface GenerateRequest {
  model: string;
  messages: Message[];
  requires: Partial<Pick<ProviderCapabilities, "tools" | "structuredOutput">>;
  tools?: ToolSpec[];
  responseSchema?: JsonSchema;
  maxOutputTokens: number;
  temperature?: number;
  timeoutMs: number;
}

export interface GenerateResponse {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { inputTokens: number | null; outputTokens: number | null };
  costReported: number | null;
  raw?: unknown;
}

export interface ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  listModels(): Promise<ModelInfo[]>;
  generate(
    req: GenerateRequest,
    signal: AbortSignal,
  ): Promise<GenerateResponse>;
}
