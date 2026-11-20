import { describe, expect, it } from "vitest";
import { isTransientNetworkFailure } from "./network-failure.js";

function coded(code: string): Error {
  return Object.assign(new Error("x"), { code });
}

describe("isTransientNetworkFailure", () => {
  it.each([
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
  ])("accepts the whitelisted code %s", (code) => {
    expect(isTransientNetworkFailure(coded(code))).toBe(true);
  });

  it("finds the code on the cause of a fetch failed TypeError", () => {
    const err = new TypeError("fetch failed", { cause: coded("ECONNREFUSED") });
    expect(isTransientNetworkFailure(err)).toBe(true);
  });

  it("finds UND_ERR_SOCKET behind a terminated TypeError", () => {
    const err = new TypeError("terminated", { cause: coded("UND_ERR_SOCKET") });
    expect(isTransientNetworkFailure(err)).toBe(true);
  });

  it("follows a chain of three links", () => {
    const err = new Error("a", {
      cause: new Error("b", {
        cause: new Error("c", { cause: coded("EPIPE") }),
      }),
    });
    expect(isTransientNetworkFailure(err)).toBe(true);
  });

  it("reads the code of an AggregateError", () => {
    const err = new TypeError("fetch failed", {
      cause: Object.assign(new AggregateError([new Error("a")]), {
        code: "ECONNREFUSED",
      }),
    });
    expect(isTransientNetworkFailure(err)).toBe(true);
  });

  it.each([
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "ENOTFOUND",
    "EFOO",
  ])("rejects the non-whitelisted code %s", (code) => {
    const err = new TypeError("fetch failed", { cause: coded(code) });
    expect(isTransientNetworkFailure(err)).toBe(false);
  });

  it("rejects an error without any code", () => {
    expect(isTransientNetworkFailure(new TypeError("fetch failed"))).toBe(
      false,
    );
  });

  it("ignores a non-string code", () => {
    expect(isTransientNetworkFailure({ code: 104 })).toBe(false);
  });

  it.each([undefined, null, "ECONNRESET", 42])(
    "rejects the non-object value %s",
    (value) => {
      expect(isTransientNetworkFailure(value)).toBe(false);
    },
  );

  it("terminates on a cause cycle", () => {
    const a: { cause?: unknown } = {};
    const b: { cause?: unknown } = { cause: a };
    a.cause = b;
    expect(isTransientNetworkFailure(a)).toBe(false);
  });

  it("does not look further than five links", () => {
    let err: unknown = coded("ECONNRESET");
    for (let i = 0; i < 5; i++) err = new Error("wrap", { cause: err });
    expect(isTransientNetworkFailure(err)).toBe(false);
  });
});
