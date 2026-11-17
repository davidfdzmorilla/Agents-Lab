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
import {
  GENERATE_PATH,
  buildProvider,
  generateOk,
  received,
  request,
  route,
  server,
} from "./test-server.js";

const RESOLVER_KEY = "AIza-from-resolver-0123456789";
const ENV_CANARY_GOOGLE = "AIza-env-google-canary-1111";
const ENV_CANARY_GEMINI = "AIza-env-gemini-canary-2222";
const live = new AbortController().signal;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  received.length = 0;
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

function hostileEnvironment(): void {
  vi.stubEnv("GOOGLE_API_KEY", ENV_CANARY_GOOGLE);
  vi.stubEnv("GEMINI_API_KEY", ENV_CANARY_GEMINI);
  vi.stubEnv("GOOGLE_GEMINI_BASE_URL", "http://evil.test");
  vi.stubEnv("GOOGLE_VERTEX_BASE_URL", "http://evil.test");
  vi.stubEnv("GOOGLE_GENAI_USE_VERTEXAI", "true");
  vi.stubEnv("GOOGLE_GENAI_USE_ENTERPRISE", "true");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "evil-project");
  vi.stubEnv("GOOGLE_CLOUD_LOCATION", "evil-location");
  vi.stubEnv("GOOGLE_GENAI_API_VERSION", "v1alpha");
}

it("ignores GOOGLE_* and GEMINI_* variables: same host, version, key, and no Vertex", async () => {
  hostileEnvironment();
  const spies = (["log", "info", "warn", "error", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
  );
  server.use(route("post", GENERATE_PATH, () => generateOk()));

  const provider = buildProvider(RESOLVER_KEY);
  await provider.generate(request(), live);

  expect(received).toHaveLength(1);
  const [call] = received;
  expect(call?.url).toMatch(
    /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/[^/]+:generateContent$/,
  );
  expect(call?.url).not.toContain("/projects/");
  expect(call?.headers.get("x-goog-api-key")).toBe(RESOLVER_KEY);
  expect(call?.headers.get("authorization")).toBeNull();

  // Known fact (OD-080): with both keys in the environment the SDK warns with a fixed text.
  const output = spies
    .flatMap((spy) => spy.mock.calls)
    .flat()
    .map(String);
  for (const text of output) {
    expect(text).not.toContain(ENV_CANARY_GOOGLE);
    expect(text).not.toContain(ENV_CANARY_GEMINI);
    expect(text).not.toContain(RESOLVER_KEY);
  }
});

it("lists models against the same host with the resolver key under a hostile environment", async () => {
  hostileEnvironment();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  server.use(
    route("get", "/v1beta/models", () =>
      HttpResponse.json({
        models: [
          { name: "models/m", supportedGenerationMethods: ["generateContent"] },
        ],
      }),
    ),
  );
  expect(await buildProvider(RESOLVER_KEY).listModels()).toEqual([{ id: "m" }]);
  expect(received[0]?.url).toMatch(
    /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?/,
  );
  expect(received[0]?.headers.get("x-goog-api-key")).toBe(RESOLVER_KEY);
});
