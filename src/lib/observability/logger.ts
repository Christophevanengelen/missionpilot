import { env } from "@/lib/env";

/**
 * Minimal structured JSON logger — deliberately dependency-free; an OTel SDK
 * is deferred until a telemetry backend actually exists. Log only explicit,
 * non-sensitive fields: correlationId, runId, stepName, attempt, codes and
 * measurements. Never log secrets, tokens, raw payloads or personal data.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LEVELS)[number];

export type LogContext = Record<
  string,
  string | number | boolean | null | undefined
>;

function levelEnabled(level: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(env.LOG_LEVEL);
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  if (!levelEnabled(level)) {
    return;
  }
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export type Logger = {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (context: LogContext) => Logger;
};

export function createLogger(base: LogContext = {}): Logger {
  const make =
    (level: LogLevel) =>
    (message: string, context: LogContext = {}) =>
      emit(level, message, { ...base, ...context });
  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
    child: (context: LogContext) => createLogger({ ...base, ...context }),
  };
}
