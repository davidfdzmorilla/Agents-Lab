import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { HttpResponse } from "msw";
import { OpenAICompatibleProvider } from "./provider.js";
import {
  BASE,
  CANARY,
  CAPS,
  chatOk,
  received,
  request,
  route,
  server,
} from "./test-server.js";

let provider: OpenAICompatibleProvider;
const live = new AbortController().signal;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  provider = new OpenAICompatibleProvider({
    id: "openrouter",
    baseUrl: BASE,
    apiKeyEnv: "OPENROUTER_API_KEY",
    capabilities: CAPS,
    secretResolver: () => CANARY,
  });
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

it("does not add its own pending timeout timer after a successful call", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  server.use(route("post", "/chat/completions", () => chatOk()));
  const pending = provider.generate(request({ timeoutMs: 60_000 }), live);
  await vi.advanceTimersByTimeAsync(0);
  await pending;
  // The SDK keeps one of its own timers alive after a successful response; the adapter's
  // timer must not add a second one.
  expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
});

it("leaves no pending timeout timer after a failed call", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  server.use(
    route("post", "/chat/completions", () =>
      HttpResponse.json({}, { status: 500 }),
    ),
  );
  const pending = provider
    .generate(request({ timeoutMs: 60_000 }), live)
    .catch((e: unknown) => e);
  await vi.advanceTimersByTimeAsync(0);
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});
