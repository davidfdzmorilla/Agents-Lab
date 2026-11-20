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
import { HttpResponse } from "msw";
import {
  ProviderAuthError,
  ProviderCapabilityError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderTimeoutError,
} from "@agentlab/core";
import { GeminiProvider } from "./provider.js";
import {
  CANARY,
  GENERATE_PATH,
  LIST_PATH,
  buildProvider,
  generateOk,
  received,
  request,
  route,
  server,
} from "./test-server.js";

const live = new AbortController().signal;
// msw intercepts at socket level and undici leaves one connect-timeout timer behind; the
// adapter's own 60 s timer would make it two (clearTimeout missing, TASK-010 precedent).
const UNDICI_TIMERS = 1;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
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

function failed(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((e: unknown) => e);
}

describe("construction", () => {
  it("asks the resolver once, with the configured name, and only at construction", async () => {
    server.use(route("post", GENERATE_PATH, () => generateOk()));
    const resolver = vi.fn(() => CANARY);
    const provider = new GeminiProvider({
      id: "gemini",
      apiKeyEnv: "GEMINI_API_KEY",
      secretResolver: resolver,
    });
    expect(resolver).toHaveBeenCalledExactlyOnceWith("GEMINI_API_KEY");
    await provider.generate(request(), live);
    await provider.generate(request(), live);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, ""])(
    "throws ProviderAuthError for a key that is %j, without any request",
    (value) => {
      expect(() => buildProvider(value ?? null)).toThrow(ProviderAuthError);
      expect(received).toHaveLength(0);
    },
  );

  it("quotes a valid variable name and never a pasted key used as the name", () => {
    const quoted = (() => {
      try {
        buildProvider(null);
      } catch (e) {
        return String(e);
      }
      return "";
    })();
    expect(quoted).toContain("GEMINI_API_KEY");
    const pasted = (() => {
      try {
        new GeminiProvider({
          id: "gemini",
          apiKeyEnv: `sk-${CANARY}`,
          secretResolver: () => undefined,
        });
      } catch (e) {
        return String(e);
      }
      return "";
    })();
    expect(pasted).not.toContain(CANARY);
    expect(pasted).toContain("not a valid or allowed variable name");
  });

  it("declares the fixed capabilities of OD-078, frozen", () => {
    const { capabilities } = buildProvider();
    expect(capabilities).toEqual({
      tools: true,
      structuredOutput: true,
      streaming: false,
      maxContextTokens: null,
      reportsUsage: true,
      reportsCost: false,
    });
    expect(Object.isFrozen(capabilities)).toBe(true);
  });
});

describe("generate request", () => {
  it("sends one POST to the v1beta path with the key in x-goog-api-key and never in the URL", async () => {
    server.use(route("post", GENERATE_PATH, () => generateOk()));
    const res = await buildProvider().generate(request(), live);
    expect(received).toHaveLength(1);
    const [call] = received;
    expect(call?.method).toBe("POST");
    expect(call?.path).toBe("/v1beta/models/gemini-2.5-flash:generateContent");
    expect(call?.headers.get("x-goog-api-key")).toBe(CANARY);
    expect(call?.url).not.toContain(CANARY);
    expect(call?.headers.get("authorization")).toBeNull();
    expect(res).toEqual({
      content: "hello",
      toolCalls: [],
      usage: { inputTokens: 3, outputTokens: 2 },
      costReported: null,
    });
  });

  it("sends the mapped body without SDK-only keys", async () => {
    server.use(route("post", GENERATE_PATH, () => generateOk()));
    await buildProvider().generate(
      request({
        messages: [
          { role: "system", content: "be brief" },
          { role: "user", content: "hi" },
        ],
        temperature: 0.2,
      }),
      live,
    );
    expect(received[0]?.body).toEqual({
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      systemInstruction: { role: "user", parts: [{ text: "be brief" }] },
      generationConfig: { maxOutputTokens: 16, temperature: 0.2 },
    });
  });

  it.each([
    ["429", 429],
    ["500", 500],
    ["503", 503],
  ])(
    "makes a single HTTP request on a %s (no SDK retries)",
    async (_n, status) => {
      server.use(
        route("post", GENERATE_PATH, () => HttpResponse.json({}, { status })),
      );
      await failed(buildProvider().generate(request(), live));
      expect(received).toHaveLength(1);
    },
  );

  it("makes a single HTTP request when the answer carries a continuationToken", async () => {
    server.use(
      // Only the first call carries a token, so a regression ends with 2 requests, not a loop.
      route("post", GENERATE_PATH, () =>
        received.length > 1
          ? generateOk()
          : HttpResponse.json({
              candidates: [
                {
                  content: { role: "model", parts: [{ text: "part" }] },
                  continuationToken: "next",
                },
              ],
            }),
      ),
    );
    const res = await buildProvider().generate(request(), live);
    expect(received).toHaveLength(1);
    expect(res.content).toBe("part");
  });

  it("maps tool calls from the response", async () => {
    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ functionCall: { name: "search", args: { q: "x" } } }],
              },
            },
          ],
        }),
      ),
    );
    const res = await buildProvider().generate(
      request({
        tools: [
          {
            name: "search",
            description: "d",
            parameters: { type: "object", properties: {} },
          },
        ],
      }),
      live,
    );
    expect(res.toolCalls).toEqual([
      { id: "call_0", name: "search", arguments: { q: "x" } },
    ]);
  });
});

describe("capabilities and representability fail before the network", () => {
  it.each([
    [
      "an unrepresentable system message",
      {
        messages: [
          { role: "user" as const, content: "u" },
          { role: "system" as const, content: "s" },
        ],
      },
    ],
    ["no turns", { messages: [] }],
  ])("rejects %s with zero requests", async (_n, extra) => {
    const err = await failed(buildProvider().generate(request(extra), live));
    expect(err).toBeInstanceOf(ProviderCapabilityError);
    expect(received).toHaveLength(0);
  });
});

describe("errors", () => {
  it("maps 429 with RetryInfo to a rate limit error with retryAfterMs", async () => {
    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json(
          {
            error: {
              code: 429,
              status: "RESOURCE_EXHAUSTED",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.RetryInfo",
                  retryDelay: "37s",
                },
              ],
            },
          },
          { status: 429 },
        ),
      ),
    );
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderRateLimitError);
    expect(err).toHaveProperty("retryAfterMs", 37000);
    expect(err).toHaveProperty("retryable", true);
  });

  it("maps 400 API_KEY_INVALID to a non-retryable auth error", async () => {
    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json(
          {
            error: {
              code: 400,
              status: "INVALID_ARGUMENT",
              details: [{ reason: "API_KEY_INVALID" }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderAuthError);
    expect(err).toHaveProperty("retryable", false);
  });

  it("maps a 503 to a retryable response error", async () => {
    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json(
          { error: { status: "UNAVAILABLE" } },
          { status: 503 },
        ),
      ),
    );
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("retryable", true);
  });

  it("maps a connection failure without a code to a non-retryable response error", async () => {
    server.use(route("post", GENERATE_PATH, () => HttpResponse.error()));
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty(
      "message",
      'Provider "gemini" connection failed',
    );
    expect(err).toHaveProperty("retryable", false);
    expect(received).toHaveLength(1);
  });

  it("maps a 200 with a null body to a non-retryable response error", async () => {
    server.use(route("post", GENERATE_PATH, () => HttpResponse.json(null)));
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("retryable", false);
  });

  it("maps a 200 with a null part to a non-retryable response error", async () => {
    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json({ candidates: [{ content: { parts: [null] } }] }),
      ),
    );
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("retryable", false);
  });

  it("maps a response without candidates to a non-retryable response error", async () => {
    server.use(route("post", GENERATE_PATH, () => HttpResponse.json({})));
    const err = await failed(buildProvider().generate(request(), live));
    expect(err).toBeInstanceOf(ProviderResponseError);
    expect(err).toHaveProperty("retryable", false);
  });
});

describe("deadline and cancellation", () => {
  const hang = () =>
    route("post", GENERATE_PATH, () => new Promise<Response>(() => undefined));

  it("raises a retryable ProviderTimeoutError when the own deadline passes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(hang());
    const pending = failed(
      buildProvider().generate(request({ timeoutMs: 500 }), live),
    );
    await vi.advanceTimersByTimeAsync(500);
    const err = await pending;
    expect(err).toBeInstanceOf(ProviderTimeoutError);
    expect(err).toHaveProperty("retryable", true);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(UNDICI_TIMERS);
  });

  it("rethrows signal.reason and makes no request when aborted beforehand", async () => {
    const reason = new Error("stop");
    const controller = new AbortController();
    controller.abort(reason);
    const err = await failed(
      buildProvider().generate(request(), controller.signal),
    );
    expect(err).toBe(reason);
    expect(received).toHaveLength(0);
  });

  it("rethrows signal.reason, not a timeout, when aborted during the request", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(hang());
    const reason = new Error("cancelled by user");
    const controller = new AbortController();
    const pending = failed(
      buildProvider().generate(
        request({ timeoutMs: 60_000 }),
        controller.signal,
      ),
    );
    await vi.advanceTimersByTimeAsync(0);
    controller.abort(reason);
    expect(await pending).toBe(reason);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(UNDICI_TIMERS);
  });

  it("leaves no pending timer after a success or a failure", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(route("post", GENERATE_PATH, () => generateOk()));
    const ok = buildProvider().generate(request({ timeoutMs: 60_000 }), live);
    await vi.advanceTimersByTimeAsync(0);
    await ok;
    expect(vi.getTimerCount()).toBeLessThanOrEqual(UNDICI_TIMERS);

    server.use(
      route("post", GENERATE_PATH, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );
    const bad = failed(
      buildProvider().generate(request({ timeoutMs: 60_000 }), live),
    );
    await vi.advanceTimersByTimeAsync(0);
    await bad;
    expect(vi.getTimerCount()).toBeLessThanOrEqual(UNDICI_TIMERS);
  });
});

describe("listModels", () => {
  function page(names: [string, string[]][], nextPageToken?: string) {
    return HttpResponse.json({
      models: names.map(([name, supportedActions]) => ({
        name,
        supportedGenerationMethods: supportedActions,
      })),
      ...(nextPageToken === undefined ? {} : { nextPageToken }),
    });
  }

  it("follows pages, keeps generateContent models and strips the models/ prefix", async () => {
    server.use(
      route("get", LIST_PATH, (req) => {
        const token = new URL(req.url).searchParams.get("pageToken");
        return token === null
          ? page(
              [
                ["models/gemini-2.5-flash", ["generateContent"]],
                ["models/text-embedding-004", ["embedContent"]],
              ],
              "p2",
            )
          : page([
              ["models/gemini-2.5-pro", ["generateContent", "countTokens"]],
              ["raw-name", ["generateContent"]],
            ]);
      }),
    );
    const models = await buildProvider().listModels();
    expect(models).toEqual([
      { id: "gemini-2.5-flash" },
      { id: "gemini-2.5-pro" },
      { id: "raw-name" },
    ]);
    expect(received).toHaveLength(2);
    expect(received[0]?.headers.get("x-goog-api-key")).toBe(CANARY);
    expect(received[0]?.url).not.toContain(CANARY);
  });

  it("skips models without a name or supportedActions", async () => {
    server.use(
      route("get", LIST_PATH, () =>
        HttpResponse.json({
          models: [
            { supportedGenerationMethods: ["generateContent"] },
            { name: "models/x" },
          ],
        }),
      ),
    );
    expect(await buildProvider().listModels()).toEqual([]);
  });

  it("raises ProviderTimeoutError after 10 000 ms", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(
      route("get", LIST_PATH, () => new Promise<Response>(() => undefined)),
    );
    const pending = failed(buildProvider().listModels());
    await vi.advanceTimersByTimeAsync(9999);
    expect(received).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBeInstanceOf(ProviderTimeoutError);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(UNDICI_TIMERS);
  });

  it("clears its own deadline timer after a successful listing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    server.use(
      route("get", LIST_PATH, () => HttpResponse.json({ models: [] })),
    );
    const pending = buildProvider().listModels();
    await vi.advanceTimersByTimeAsync(0);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("maps HTTP errors through the same table", async () => {
    server.use(
      route("get", LIST_PATH, () => HttpResponse.json({}, { status: 403 })),
    );
    expect(await failed(buildProvider().listModels())).toBeInstanceOf(
      ProviderAuthError,
    );
  });
});
