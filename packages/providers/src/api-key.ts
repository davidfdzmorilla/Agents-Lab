import {
  ProviderAuthError,
  isApiKeyEnvName,
  type SecretResolver,
} from "@agentlab/core";

const MAX_ENV_NAME_LENGTH = 40;

export function resolveApiKey(
  id: string,
  apiKeyEnv: string,
  secretResolver: SecretResolver,
): string {
  const key = secretResolver(apiKeyEnv);
  if (key === undefined || key === "") {
    // A malformed api_key_env could be a pasted key, so it is only quoted when it is a
    // well-formed variable name (same rule as InvalidApiKeyEnvError).
    const named =
      isApiKeyEnvName(apiKeyEnv) && apiKeyEnv.length <= MAX_ENV_NAME_LENGTH
        ? `environment variable ${apiKeyEnv} is not set, empty or not allowed`
        : "the configured api_key_env is not a valid or allowed variable name";
    throw new ProviderAuthError(
      `Provider "${id}" has no usable API key: ${named}`,
    );
  }
  return key;
}
