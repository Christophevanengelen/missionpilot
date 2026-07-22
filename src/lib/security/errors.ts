/**
 * Sanitized error surface. Everything stored in error columns or shown to a
 * user goes through sanitizeError(): a stable code plus a safe, generic
 * message — never stack traces, provider internals or payload contents.
 */

export class AiValidationError extends Error {
  readonly code = "AI_VALIDATION_FAILED";
  constructor(message = "AI output failed schema validation") {
    super(message);
    this.name = "AiValidationError";
  }
}

export class OwnershipError extends Error {
  readonly code = "OWNERSHIP_VIOLATION";
  constructor(message = "Entity does not belong to the requesting user") {
    super(message);
    this.name = "OwnershipError";
  }
}

export class AiProviderError extends Error {
  readonly code = "AI_PROVIDER_ERROR";
  constructor(message = "AI provider call failed") {
    super(message);
    this.name = "AiProviderError";
  }
}

export class AiConfigurationError extends Error {
  readonly code = "AI_CONFIGURATION_ERROR";
  constructor(message = "AI provider configuration is invalid") {
    super(message);
    this.name = "AiConfigurationError";
  }
}

export type SanitizedError = {
  code: string;
  message: string;
};

const SAFE_ERROR_NAMES = new Set([
  "AiValidationError",
  "AiProviderError",
  "AiConfigurationError",
  "OwnershipError",
  "IllegalTransitionError",
]);

export function sanitizeError(error: unknown): SanitizedError {
  if (error instanceof Error && SAFE_ERROR_NAMES.has(error.name)) {
    const code =
      "code" in error && typeof error.code === "string"
        ? error.code
        : error.name;
    return { code, message: error.message };
  }
  return { code: "INTERNAL", message: "An internal error occurred." };
}
