import "server-only";

import { env } from "@/lib/env";
import type { AiProvider } from "@/lib/ai/types";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { OpenAiProvider } from "@/lib/ai/openai-provider";
import { AiConfigurationError } from "@/lib/security/errors";

/**
 * Explicit provider allowlist. `openai` is the first real adapter (owner
 * decision — deep CV reading); it requires OPENAI_API_KEY and fails cleanly
 * with a typed configuration error when absent. Any name outside the
 * allowlist fails the same way; no model or provider name lives outside
 * configuration.
 */
const PROVIDER_ALLOWLIST: Record<string, () => AiProvider> = {
  mock: () => new MockAiProvider(),
  openai: () => new OpenAiProvider(),
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
