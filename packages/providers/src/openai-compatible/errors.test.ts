import { describe, expect, it } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";
import {
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@agentlab/core";
import { parseRetryAfterMs, toProviderError } from "./errors.js";

const NOW = Date.parse("2026-01-01T00:00:00Z");

function h(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("parseRetryAfterMs", () => {
  it.each([
    ["retry-after-ms", "1500", 1500],
    ["retry-after", "2", 2000],
    ["retry-after", "0.5", 500],
    ["retry-after", "Thu, 01 Jan 2026 00:00:10 GMT", 10_000],
    ["retry-after", "Wed, 31 Dec 2025 23:59:00 GMT", 0],
  ])("reads %s=%s as %d ms", (name, value, expected) => {
    expect(parseRetryAfterMs(h({ [name]: value }), NOW)).toBe(expected);
  });

  it("prefers retry-after-ms over retry-after", () => {
    expect(
      parseRetryAfterMs(h({ "retry-after-ms": "10", "retry-after": "5" }), NOW),
    ).toBe(10);
  });

  it("falls back to retry-after when retry-after-ms is invalid", () => {
    expect(
      parseRetryAfterMs(
        h({ "retry-after-ms": "abc", "retry-after": "3" }),
        NOW,
      ),
    ).toBe(3000);
  });

  it.each([
    ["no headers object", undefined],
    ["no relevant header", h({ "x-other": "1" })],
    ["negative seconds", h({ "retry-after": "-4" })],
    ["garbage", h({ "retry-after": "soon" })],
  ])("returns undefined for %s", (_label, headers) => {
    expect(parseRetryAfterMs(headers, NOW)).toBeUndefined();
  });
});

function apiError(status: number, headers?: Record<string, string>): APIError {
  return APIError.generate(
    status,
    { message: "Bearer sk-canary-body" },
    "sk-canary-message",
    headers === undefined ? new Headers() : h(headers),
  );
}

describe("toProviderError", () => {
  it("maps 401 and 403 to ProviderAuthError (not retryable)", () => {
    for (const status of [401, 403]) {
      const e = toProviderError(apiError(status), "p", NOW);
      expect(e).toBeInstanceOf(ProviderAuthError);
      expect(e.retryable).toBe(false);
    }
  });

  it("maps 429 to ProviderRateLimitError with retryAfterMs from the header", () => {
    const e = toProviderError(apiError(429, { "retry-after": "2" }), "p", NOW);
    expect(e).toBeInstanceOf(ProviderRateLimitError);
    expect(e.retryable).toBe(true);
    expect((e as ProviderRateLimitError).retryAfterMs).toBe(2000);
  });

  it("leaves retryAfterMs undefined when the header is absent", () => {
    const e = toProviderError(apiError(429), "p", NOW);
    expect(e).toBeInstanceOf(ProviderRateLimitError);
    expect((e as ProviderRateLimitError).retryAfterMs).toBeUndefined();
  });

  it("maps 408 and the SDK timeout to a retryable ProviderTimeoutError", () => {
    for (const err of [apiError(408), new APIConnectionTimeoutError()]) {
      const e = toProviderError(err, "p", NOW);
      expect(e).toBeInstanceOf(ProviderTimeoutError);
      expect(e.retryable).toBe(true);
    }
  });

  it.each([
    [409, true],
    [500, true],
    [503, true],
    [400, false],
    [404, false],
    [422, false],
  ])(
    "maps HTTP %d to ProviderResponseError retryable=%s",
    (status, retryable) => {
      const e = toProviderError(apiError(status), "p", NOW);
      expect(e).toBeInstanceOf(ProviderResponseError);
      expect(e.retryable).toBe(retryable);
    },
  );

  it("maps connection errors to a retryable ProviderResponseError", () => {
    const e = toProviderError(new APIConnectionError({}), "p", NOW);
    expect(e).toBeInstanceOf(ProviderResponseError);
    expect(e.retryable).toBe(true);
  });

  it("maps an APIError without status and unknown values to a non-retryable ProviderResponseError", () => {
    for (const err of [
      new APIError(undefined, undefined, "x", undefined),
      new Error("boom"),
      "string",
      null,
    ]) {
      const e = toProviderError(err, "p", NOW);
      expect(e).toBeInstanceOf(ProviderResponseError);
      expect(e.retryable).toBe(false);
    }
  });

  it("passes AgentLabError instances through untouched", () => {
    const original = new ProviderCapabilityError("x");
    expect(toProviderError(original, "p", NOW)).toBe(original);
  });

  it("never copies the SDK message, never attaches a cause", () => {
    for (const status of [400, 401, 429, 500]) {
      const e = toProviderError(apiError(status), "p", NOW);
      expect(e.message).not.toContain("canary");
      expect(e.cause).toBeUndefined();
      expect(e.message).toContain(`"p"`);
    }
  });
});
