export type NormalizedClientError = {
  message: string;
};

export function normalizeClientError(_error: unknown, fallbackMessage: string): NormalizedClientError {
  return { message: fallbackMessage };
}

export function reportHandledError(context: string, _error: unknown, fallbackMessage: string) {
  console.warn(`FinTrack: ${context}`);
  return { message: fallbackMessage };
}
