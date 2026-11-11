import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
} from "openai";
import {
  AgentLabError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@agentlab/core";

const DECIMAL = /^\d+(\.\d+)?$/;

function nonNegativeNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!DECIMAL.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function parseRetryAfterMs(
  headers: Headers | undefined,
  nowMs: number,
): number | undefined {
  if (headers === undefined) return undefined;

  const ms = headers.get("retry-after-ms");
  if (ms !== null) {
    const n = nonNegativeNumber(ms);
    if (n !== undefined) return n;
  }

  const retryAfter = headers.get("retry-after");
  if (retryAfter === null) return undefined;
  const seconds = nonNegativeNumber(retryAfter);
  if (seconds !== undefined) return seconds * 1000;
  // Numeric-looking leftovers (negative, signed) are invalid, not dates.
  if (/^[\s\d.+-]*$/.test(retryAfter)) return undefined;
  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - nowMs);
}

// Messages are fixed templates on purpose. The SDK message embeds the server error body and
// the SDK error carries response headers and the request: none of it is copied, and no
// `cause` is attached, so no secret can travel through an error (TASK-004 security note).
export function toProviderError(
  err: unknown,
  providerId: string,
  nowMs: number,
): AgentLabError {
  if (err instanceof AgentLabError) return err;
  const who = `Provider "${providerId}"`;

  if (err instanceof APIConnectionTimeoutError) {
    return new ProviderTimeoutError(`${who} request timed out`);
  }
  if (err instanceof APIConnectionError) {
    return new ProviderResponseError(`${who} connection failed`, {
      retryable: true,
    });
  }
  if (err instanceof APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ProviderAuthError(
        `${who} rejected the credentials (HTTP ${status})`,
      );
    }
    if (status === 429) {
      const retryAfterMs = parseRetryAfterMs(err.headers, nowMs);
      return new ProviderRateLimitError(
        `${who} rate limited the request (HTTP 429)`,
        retryAfterMs === undefined ? {} : { retryAfterMs },
      );
    }
    if (status === 408) {
      return new ProviderTimeoutError(
        `${who} reported a request timeout (HTTP 408)`,
      );
    }
    if (status !== undefined) {
      return new ProviderResponseError(
        `${who} returned an error (HTTP ${status})`,
        { retryable: status === 409 || status >= 500 },
      );
    }
  }
  return new ProviderResponseError(`${who} failed with an unexpected error`);
}
