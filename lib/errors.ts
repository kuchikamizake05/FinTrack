export type NormalizedClientError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function normalizeClientError(error: unknown, fallbackMessage: string): NormalizedClientError {
  if (error instanceof Error) return { message: error.message || fallbackMessage };
  if (typeof error === "string" && error.trim()) return { message: error };

  if (error && typeof error === "object") {
    const candidate = error as Record<string, unknown>;
    const message = nonEmptyString(candidate.message) ?? fallbackMessage;
    const code = nonEmptyString(candidate.code);
    const details = nonEmptyString(candidate.details);
    const hint = nonEmptyString(candidate.hint);

    return {
      message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(hint ? { hint } : {}),
    };
  }

  return { message: fallbackMessage };
}

export function reportHandledError(context: string, error: unknown, fallbackMessage: string) {
  const normalized = normalizeClientError(error, fallbackMessage);
  console.warn(context, normalized);
  return normalized;
}
