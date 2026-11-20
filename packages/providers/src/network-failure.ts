const MAX_CAUSE_DEPTH = 5;

// Transient transport failures only (OD-086 (a)). Anything else (TLS certificate errors,
// ENOTFOUND, no code at all, unknown codes) is treated as permanent: retrying cannot fix it.
const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Walks the `cause` chain (bounded, so a cycle cannot loop) reading only `code`. Nothing is
// copied out of the error.
export function isTransientNetworkFailure(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!isRecord(current)) return false;
    const code = current["code"];
    if (typeof code === "string" && TRANSIENT_CODES.has(code)) return true;
    current = current["cause"];
  }
  return false;
}
