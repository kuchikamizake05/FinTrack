export type AuthAction = "login" | "signup" | "reset" | "update-password" | "oauth";
export type AuthMode = "login" | "signup" | "reset" | "update-password";

export const AUTH_SUCCESS_MESSAGES = {
  signUp: "Periksa email untuk konfirmasi. Jika akun sudah ada, silakan masuk.",
  reset: "Jika email terdaftar, tautan pemulihan akan dikirim.",
  passwordUpdated: "Kata sandi berhasil diperbarui.",
} as const;

export function getAuthErrorMessage(action: AuthAction, error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
  }
  if (action === "login" && (message.includes("invalid login") || message.includes("invalid credentials"))) {
    return "Email atau kata sandi tidak cocok.";
  }
  if (action === "signup" && (message.includes("already registered") || message.includes("already exists"))) {
    return AUTH_SUCCESS_MESSAGES.signUp;
  }
  if (action === "oauth") return "Login dengan Google belum berhasil. Coba lagi.";
  if (action === "signup") return "Pendaftaran belum berhasil. Coba lagi beberapa saat lagi.";
  if (action === "reset") return "Tautan pemulihan belum berhasil dikirim. Coba lagi.";
  if (action === "update-password") return "Kata sandi belum berhasil diperbarui. Coba lagi.";
  return "Login belum berhasil. Coba lagi beberapa saat lagi.";
}

export function validatePassword(password: string, confirmation?: string) {
  if (password.length < 8) return "Kata sandi minimal 8 karakter.";
  if (confirmation !== undefined && password !== confirmation) {
    return "Konfirmasi kata sandi tidak cocok.";
  }
  return null;
}

export function buildAuthRedirectUrl(
  origin: string,
  destination: string,
  mode?: "update-password",
) {
  const url = new URL("/login", new URL(origin).origin);
  url.searchParams.set("next", destination);
  if (mode) url.searchParams.set("mode", mode);
  return url.toString();
}
