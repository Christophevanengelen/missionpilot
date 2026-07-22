import "server-only";

import { env } from "@/lib/env";
import type { AiProvider } from "@/lib/ai/types";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { AiConfigurationError } from "@/lib/security/errors";

/**
 * Explicit provider allowlist. Phase 0 ships the mock only — real adapters
 * are added here when a first use case needs them (user decision, J1/J5).
 * Any name outside the allowlist fails cleanly with a typed, sanitized
 * error; no model or provider name lives outside configuration.
 */
const PROVIDER_ALLOWLIST: Record<string, () => AiProvider> = {
  mock: () => new MockAiProvider(),
};

export function getAiProvider(
  name: string = env.AI_DEFAULT_PROVIDER,
): AiProvider {
  const factory = Object.prototype.hasOwnProperty.call(PROVIDER_ALLOWLIST, name)
    ? PROVIDER_ALLOWLIST[name]
    : undefined;
  if (!factory) {
    throw new AiConfigurationError(`AI provider not in allowlist: ${name}`);
  }
  return factory();
}
