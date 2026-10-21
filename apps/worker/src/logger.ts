import {
  AgentLabError,
  EnvSchema,
  isApiKeyEnvName,
  type Env,
} from "@agentlab/core";
import pino from "pino";

export type Logger = pino.Logger;

const SECRET_NAMES = Object.keys(EnvSchema.shape).filter(
  (name) => isApiKeyEnvName(name) || name.startsWith("DATABASE_URL"),
);

// Root and one level deep: that is all pino's redact can express without wildcards over values.
export const REDACT_PATHS: readonly string[] = SECRET_NAMES.flatMap((name) => [
  name,
  `*.${name}`,
]);

// Driver errors (Drizzle, pg) embed query parameters in `message` (TD-011): only AgentLabError messages are ours.
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AgentLabError) {
    return { type: error.name, code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    const code = "code" in error ? error.code : undefined;
    return {
      type: error.name,
      ...(typeof code === "string" ? { code } : {}),
    };
  }
  return { type: typeof error };
}

export function createLogger(options: {
  readonly level: Env["LOG_LEVEL"];
  readonly destination?: pino.DestinationStream;
}): Logger {
  return pino(
    {
      name: "worker",
      level: options.level,
      redact: { paths: [...REDACT_PATHS], censor: "[REDACTED]" },
      serializers: { err: serializeError },
    },
    options.destination ?? pino.destination({ dest: 1, sync: true }),
  );
}
