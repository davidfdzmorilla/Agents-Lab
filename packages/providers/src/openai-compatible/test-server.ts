// Shared fixtures for the adapter tests. Not exported from the package.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { GenerateRequest, ProviderCapabilities } from "@agentlab/core";

export const BASE = "http://fake-provider.test/v1";
export const CANARY = "sk-canary-0123456789abcdef";

export const CAPS: ProviderCapabilities = {
  tools: true,
  structuredOutput: true,
  streaming: false,
  maxContextTokens: null,
  reportsUsage: true,
  reportsCost: false,
};

export interface Received {
  readonly method: string;
  readonly path: string;
  readonly headers: Headers;
}

export const received: Received[] = [];
export const server = setupServer();

export function route(
  method: "get" | "post",
  path: string,
  responder: (request: Request) => Response | Promise<Response>,
) {
  return http[method](`${BASE}${path}`, ({ request }) => {
    received.push({
      method: request.method,
      path: new URL(request.url).pathname,
      headers: new Headers(request.headers),
    });
    return responder(request);
  });
}

export function chatOk(extra: object = {}): Response {
  return HttpResponse.json({
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 0,
    model: "m",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: "hello" },
      },
    ],
    ...extra,
  });
}

export function request(extra: Partial<GenerateRequest> = {}): GenerateRequest {
  return {
    model: "m",
    messages: [{ role: "user", content: "hi" }],
    requires: {},
    maxOutputTokens: 16,
    timeoutMs: 5000,
    ...extra,
  };
}
