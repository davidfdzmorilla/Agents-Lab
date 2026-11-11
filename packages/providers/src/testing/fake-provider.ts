import {
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
  type GenerateRequest,
  type GenerateResponse,
  type ModelInfo,
  type ModelProvider,
  type ProviderCapabilities,
  type ToolCall,
} from "@agentlab/core";
import { assertCapabilities } from "../capabilities.js";

export type FakeStep =
  | {
      readonly kind: "respond";
      readonly content?: string | null;
      readonly toolCalls?: readonly ToolCall[];
      readonly usage?: GenerateResponse["usage"];
      readonly costReported?: number | null;
    }
  | { readonly kind: "rateLimit"; readonly retryAfterMs?: number }
  | { readonly kind: "timeout" }
  | { readonly kind: "invalidOutput"; readonly content?: string };

export interface FakeCall {
  readonly role: string;
  readonly request: GenerateRequest;
}

export interface FakeProviderOptions {
  readonly id?: string;
  readonly capabilities?: ProviderCapabilities;
  readonly script: Readonly<Record<string, readonly FakeStep[]>>;
  readonly roleOf?: (req: GenerateRequest) => string;
  readonly models?: readonly ModelInfo[];
}

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};

const INVALID_OUTPUT = "<<not valid json>>";

export class FakeProvider implements ModelProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  readonly #script: Readonly<Record<string, readonly FakeStep[]>>;
  readonly #roleOf: (req: GenerateRequest) => string;
  readonly #models: readonly ModelInfo[];
  readonly #cursors = new Map<string, number>();
  readonly #calls: FakeCall[] = [];

  constructor(options: FakeProviderOptions) {
    this.id = options.id ?? "fake";
    this.capabilities = Object.freeze({
      ...(options.capabilities ?? DEFAULT_CAPABILITIES),
    });
    this.#script = options.script;
    this.#roleOf = options.roleOf ?? ((req) => req.model);
    this.#models = options.models ?? [];
  }

  get calls(): readonly FakeCall[] {
    return this.#calls;
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve(this.#models.map((m) => ({ ...m })));
  }

  generate(
    req: GenerateRequest,
    signal: AbortSignal,
  ): Promise<GenerateResponse> {
    try {
      return Promise.resolve(this.#next(req, signal));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  #next(req: GenerateRequest, signal: AbortSignal): GenerateResponse {
    assertCapabilities(this.id, this.capabilities, req);
    signal.throwIfAborted();

    const role = this.#roleOf(req);
    this.#calls.push({ role, request: req });
    const steps = Object.hasOwn(this.#script, role)
      ? this.#script[role]
      : undefined;
    const index = this.#cursors.get(role) ?? 0;
    const step = steps?.[index];
    if (step === undefined) {
      throw new ProviderResponseError(
        `FakeProvider script for role "${role}" is missing or exhausted`,
      );
    }
    this.#cursors.set(role, index + 1);

    switch (step.kind) {
      case "respond":
        return {
          content: step.content ?? null,
          toolCalls: step.toolCalls ? [...step.toolCalls] : [],
          usage: step.usage ?? { inputTokens: null, outputTokens: null },
          costReported: step.costReported ?? null,
        };
      case "invalidOutput":
        return {
          content: step.content ?? INVALID_OUTPUT,
          toolCalls: [],
          usage: { inputTokens: null, outputTokens: null },
          costReported: null,
        };
      case "rateLimit":
        throw new ProviderRateLimitError(
          `Provider "${this.id}" rate limited the request (simulated)`,
          step.retryAfterMs === undefined
            ? {}
            : { retryAfterMs: step.retryAfterMs },
        );
      case "timeout":
        throw new ProviderTimeoutError(
          `Provider "${this.id}" request timed out (simulated)`,
        );
    }
  }
}
