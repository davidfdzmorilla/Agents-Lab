import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { Budget, BudgetLimit } from "./budget.js";
import type {
  GenerateRequest,
  GenerateResponse,
  ModelProvider,
} from "./model-provider.js";
import type { ProviderCapabilities } from "./provider-capabilities.js";
import type { Tool } from "./tool.js";

describe("contracts versus ARCHITECTURE section 3", () => {
  it("ProviderCapabilities matches section 3.1", () => {
    expectTypeOf<ProviderCapabilities>().toEqualTypeOf<{
      tools: boolean;
      structuredOutput: boolean;
      streaming: boolean;
      maxContextTokens: number | null;
      reportsUsage: boolean;
      reportsCost: boolean;
    }>();
  });

  it("Budget matches section 3.3", () => {
    expectTypeOf<Budget>().toEqualTypeOf<{
      maxModelCalls: number;
      maxConcurrentAgents: number;
      maxReviewIterations: number;
      timeoutMs: number;
      maxTokensPerCall: number;
      maxTotalTokens: number;
      maxContextRatio: number;
      maxToolsPerInvocation: number;
      maxResultChars: number;
      maxGraphDepth: number;
    }>();
    expectTypeOf<BudgetLimit>().toEqualTypeOf<keyof Budget>();
  });

  it("GenerateResponse and ModelProvider have the section 3.1 shape", () => {
    expectTypeOf<GenerateResponse["usage"]>().toEqualTypeOf<{
      inputTokens: number | null;
      outputTokens: number | null;
    }>();
    expectTypeOf<GenerateRequest["requires"]>().toEqualTypeOf<{
      tools?: boolean;
      structuredOutput?: boolean;
    }>();
    expectTypeOf<ModelProvider["generate"]>().parameters.toEqualTypeOf<
      [GenerateRequest, AbortSignal]
    >();
  });

  it("Tool carries zod schemas and a sensitivity", () => {
    expectTypeOf<Tool<string, number>["input"]>().toEqualTypeOf<
      z.ZodType<string>
    >();
    expectTypeOf<Tool<string, number>["sensitivity"]>().toEqualTypeOf<
      "none" | "network" | "write" | "approval"
    >();
  });
});
