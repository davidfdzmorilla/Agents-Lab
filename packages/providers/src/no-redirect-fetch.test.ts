import { afterEach, describe, expect, it, vi } from "vitest";
import { noRedirectFetch } from "./no-redirect-fetch.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("noRedirectFetch", () => {
  it("calls the current global fetch with redirect forced to error and the rest of init kept", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    await noRedirectFetch("https://example.test/x", {
      method: "POST",
      redirect: "follow",
      headers: { a: "b" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("https://example.test/x", {
      method: "POST",
      redirect: "error",
      headers: { a: "b" },
    });
  });

  it("forces redirect error when no init is given", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    await noRedirectFetch(new URL("https://example.test/y"));
    expect(spy.mock.calls[0]?.[1]).toEqual({ redirect: "error" });
  });
});
