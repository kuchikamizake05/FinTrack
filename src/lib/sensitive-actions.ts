export const SENSITIVE_ACTION_STEP_UP_WINDOW_SECONDS = 15 * 60;

type AuthenticationMethod = string | { method?: unknown; timestamp?: unknown };

export function hasRecentAal2StepUp({
  aal,
  authenticationMethods,
  nowSeconds,
}: {
  aal: string | null | undefined;
  authenticationMethods: readonly AuthenticationMethod[];
  nowSeconds: number;
}) {
  if (aal !== "aal2" || !Number.isFinite(nowSeconds)) return false;
  return authenticationMethods.some((entry) => {
    if (!entry || typeof entry === "string" || typeof entry.timestamp !== "number") return false;
    return ["totp", "webauthn", "phone", "otp"].includes(String(entry.method).toLowerCase())
      && Number.isFinite(entry.timestamp)
      && entry.timestamp >= nowSeconds - SENSITIVE_ACTION_STEP_UP_WINDOW_SECONDS;
  });
}

export function getSensitiveActionErrorMessage(status: number) {
  if (status === 401) return "Sesi login tidak valid.";
  if (status === 403) return "Verifikasi keamanan terbaru diperlukan.";
  if (status === 404) return "Akun tidak ditemukan.";
  return "Akun belum berhasil dihapus. Coba lagi.";
}
