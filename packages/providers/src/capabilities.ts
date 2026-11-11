import {
  ProviderCapabilityError,
  type GenerateRequest,
  type ProviderCapabilities,
} from "@agentlab/core";

// Fails fast, before any network call. Besides `requires`, the presence of `tools` or
// `responseSchema` also counts: sending them to a provider that cannot honour them would
// degrade silently (SPEC §2.1, OD-060).
export function assertCapabilities(
  providerId: string,
  capabilities: ProviderCapabilities,
  req: GenerateRequest,
): void {
  const needsTools =
    req.requires.tools === true ||
    (req.tools !== undefined && req.tools.length > 0);
  if (needsTools && !capabilities.tools) {
    throw new ProviderCapabilityError(
      `Provider "${providerId}" does not support tool calling`,
    );
  }
  const needsStructured =
    req.requires.structuredOutput === true || req.responseSchema !== undefined;
  if (needsStructured && !capabilities.structuredOutput) {
    throw new ProviderCapabilityError(
      `Provider "${providerId}" does not support structured output`,
    );
  }
}
