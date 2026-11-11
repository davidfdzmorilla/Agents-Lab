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
import { OpenAICompatibleProvider } from "./provider.js";
import {
  BASE,
  CANARY,
  CAPS,
  received,
  request,
  route,
  server,
} from "./test-server.js";

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
});
afterAll(() => {
  server.close();
});

const live = new AbortController().signal;
function buildProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: "openrouter",
    baseUrl: BASE,
    apiKeyEnv: "OPENROUTER_API_KEY",
    capabilities: CAPS,
    secretResolver: () => CANARY,
  });
}
// Built after server.listen(): the SDK captures globalThis.fetch in its constructor.
let provider: OpenAICompatibleProvider;

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

// The server echoes the Authorization header it received in the body and in a response
// header, the worst case for a proxy or a misbehaving upstream.
function echoing(status: number) {
  return route("post", "/chat/completions", (req) => {
    const auth = req.headers.get("authorization") ?? "";
    return HttpResponse.json(
      {
        error: {
          message: `bad request, header was ${auth}`,
          authorization: auth,
        },
      },
      { status, headers: { "x-echo-authorization": auth } },
    );
  });
}

describe("canary key never leaves through errors", () => {
  it.each([400, 401, 403, 429, 500])("HTTP %d", async (status) => {
    server.use(echoing(status));
    const err = await provider
      .generate(request(), live)
      .catch((e: unknown) => e);
    // positive control: the key really was sent, so the absence below is meaningful
    expect(received[0]?.headers.get("authorization")).toBe(`Bearer ${CANARY}`);
    expect(err).toBeInstanceOf(Error);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
    expect((err as Error).cause).toBeUndefined();
  });

  it("network error", async () => {
    server.use(route("post", "/chat/completions", () => HttpResponse.error()));
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
        "/chat/completions",
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
    server.use(
      route("get", "/models", (req) =>
        HttpResponse.json(
          { error: { message: req.headers.get("authorization") ?? "" } },
          { status: 401 },
        ),
      ),
    );
    const err = await provider.listModels().catch((e: unknown) => e);
    expect(received[0]?.headers.get("authorization")).toBe(`Bearer ${CANARY}`);
    for (const text of surfaces(err)) expect(text).not.toContain(CANARY);
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
      new OpenAICompatibleProvider({
        id: "x",
        baseUrl: BASE,
        apiKeyEnv: CANARY,
        capabilities: CAPS,
        secretResolver: () => undefined,
      });
    } catch (err) {
      caught = err;
    }
    for (const text of surfaces(caught)) expect(text).not.toContain(CANARY);
  });
});
