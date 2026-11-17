import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { inspect } from "node:util";
import { HttpResponse } from "msw";
import { GeminiProvider } from "./provider.js";
import {
  CANARY,
  GENERATE_PATH,
  LIST_PATH,
  buildProvider,
  received,
  request,
  route,
  server,
} from "./test-server.js";

const live = new AbortController().signal;
let provider: GeminiProvider;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  provider = buildProvider();
});
beforeEach(() => {
  received.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

function surfaces(err: unknown): string[] {
  if (!(err instanceof Error)) return [String(err)];
  return [
    err.message,
    String(err.cause),
    err.stack ?? "",
    JSON.stringify(err),
    inspect(err, { showHidden: true, depth: Infinity }),
  ];
}

// The server echoes the key header it received in the body and in a response header, the
// worst case for a proxy or a misbehaving upstream.
function echoing(path: string, status: number) {
  return route(path === LIST_PATH ? "get" : "post", path, (req) => {
    const key = req.headers.get("x-goog-api-key") ?? "";
    return HttpResponse.json(
      {
        error: {
          code: status,
          message: `bad request, header was ${key}`,
          details: [{ reason: "X", metadata: { key } }],
        },
      },
      { status, headers: { "x-echo-key": key } },
    );
  });
}

describe("canary key never leaves through errors", () => {
  it.each([400, 401, 403, 429, 500])("HTTP %d", async (status) => {
    server.use(echoing(GENERATE_PATH, status));
    const err = await provider
      .generate(request(), live)
      .catch((e: unknown) => e);
    // positive control: the key really was sent, so the absence below is meaningful
    expect(received[0]?.headers.get("x-goog-api-key")).toBe(CANARY);
    expect(err).toBeInstanceOf(Error);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
    expect((err as Error).cause).toBeUndefined();
  });

  it("network error", async () => {
    server.use(route("post", GENERATE_PATH, () => HttpResponse.error()));
    const err = await provider
      .generate(request(), live)
      .catch((e: unknown) => e);
    expect(received).toHaveLength(1);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
    expect((err as Error).cause).toBeUndefined();
  });

  it("timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(
      route(
        "post",
        GENERATE_PATH,
        () => new Promise<Response>(() => undefined),
      ),
    );
    const pending = provider
      .generate(request({ timeoutMs: 500 }), live)
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(500);
    const err = await pending;
    expect(err).toBeInstanceOf(Error);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
    expect((err as Error).cause).toBeUndefined();
  });

  it("listModels errors", async () => {
    server.use(echoing(LIST_PATH, 401));
    const err = await provider.listModels().catch((e: unknown) => e);
    expect(received[0]?.headers.get("x-goog-api-key")).toBe(CANARY);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
  });

  it("an error body echoing the key does not reach the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    server.use(echoing(GENERATE_PATH, 500));
    await provider.generate(request(), live).catch(() => undefined);
    for (const call of spies.flatMap((spy) => spy.mock.calls).flat()) {
      expect(String(call)).not.toContain(CANARY);
    }
  });

  // The candidate text is model content and is returned as is; what must not happen is
  // the key reaching the console or any field other than that text.
  it("a 200 whose candidate echoes the key returns it only as content, not to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    server.use(
      route("post", GENERATE_PATH, (req) => {
        const key = req.headers.get("x-goog-api-key") ?? "";
        return HttpResponse.json({
          candidates: [
            { content: { role: "model", parts: [{ text: `key ${key}` }] } },
          ],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
        });
      }),
    );
    const res = await provider.generate(request(), live);
    expect(res.content).toBe(`key ${CANARY}`);
    expect(JSON.stringify({ ...res, content: null })).not.toContain(CANARY);
    for (const call of spies.flatMap((spy) => spy.mock.calls).flat()) {
      expect(String(call)).not.toContain(CANARY);
    }
  });

  it.each([
    ["a null body", () => HttpResponse.json(null)],
    [
      "a null part",
      () => HttpResponse.json({ candidates: [{ content: { parts: [null] } }] }),
    ],
  ])("a malformed 200 with %s leaks nothing", async (_name, body) => {
    server.use(
      route("post", GENERATE_PATH, (req) => {
        const res = body();
        res.headers.set("x-echo-key", req.headers.get("x-goog-api-key") ?? "");
        return res;
      }),
    );
    const err = await provider
      .generate(request(), live)
      .catch((e: unknown) => e);
    expect(received[0]?.headers.get("x-goog-api-key")).toBe(CANARY);
    expect(err).toBeInstanceOf(Error);
    expect(err).toHaveProperty("retryable", false);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
    expect((err as Error).cause).toBeUndefined();
  });
});

describe("canary key never appears on the instance", () => {
  it("is absent from every serialisation and introspection channel", () => {
    const channels = [
      JSON.stringify(provider),
      Object.keys(provider).join(","),
      Object.getOwnPropertyNames(provider).join(","),
      Object.getOwnPropertySymbols(provider).map(String).join(","),
      inspect(provider, { showHidden: true, depth: Infinity }),
      String(provider),
    ];
    for (const text of channels) expect(text).not.toContain(CANARY);
  });

  it("does not leak through the failure of a construction with a pasted key as the name", () => {
    let caught: unknown;
    try {
      new GeminiProvider({
        id: "x",
        apiKeyEnv: CANARY,
        secretResolver: () => undefined,
      });
    } catch (err) {
      caught = err;
    }
    for (const text of surfaces(caught)) expect(text).not.toContain(CANARY);
  });
});
