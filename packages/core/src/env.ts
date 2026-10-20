import { z } from "zod";
import { EnvValidationError } from "./errors.js";

export type EnvSource = Readonly<Record<string, string | undefined>>;
export type SecretResolver = (envName: string) => string | undefined;

const optionalString = z.string().min(1).optional();
const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const postgresUrl = () => z.url({ protocol: /^postgres(ql)?$/ });
const httpUrl = () => z.url({ protocol: /^https?$/ });

export const EnvSchema = z.object({
  DATABASE_URL: postgresUrl(),
  DATABASE_URL_TEST: postgresUrl().optional(),
  WORKER_CONCURRENCY: positiveInt(1),
  WORKER_HEARTBEAT_MS: positiveInt(15000),
  WORKER_STALE_MS: positiveInt(60000),
  SHUTDOWN_GRACE_MS: positiveInt(30000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  LANGCHAIN_TRACING_V2: z.enum(["true", "false"]).default("false"),
  OLLAMA_BASE_URL: httpUrl().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: httpUrl().optional(),
  AGENTLAB_PROVIDER: z.enum(["fake", "openai-compatible", "gemini"]).optional(),
  OPENROUTER_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
});
export type Env = z.infer<typeof EnvSchema>;

function definedEntries(source: EnvSource): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(EnvSchema.shape)) {
    const value = Object.hasOwn(source, key) ? source[key] : undefined;
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export function loadEnv(source: EnvSource = process.env): Env {
  const result = EnvSchema.safeParse(definedEntries(source));
  if (!result.success) {
    throw new EnvValidationError(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }
  return result.data;
}

const SECRET_NAME = /^[A-Z][A-Z0-9_]*_API_KEY$/;
const DECLARED_NAMES: ReadonlySet<string> = new Set(
  Object.keys(EnvSchema.shape),
);

export function createSecretResolver(
  source: EnvSource = process.env,
): SecretResolver {
  return (envName) => {
    if (!SECRET_NAME.test(envName) || !DECLARED_NAMES.has(envName))
      return undefined;
    if (!Object.hasOwn(source, envName)) return undefined;
    const value = source[envName];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
}
