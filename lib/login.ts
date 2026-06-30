export const MAGIC_LINK_SUCCESS_MESSAGE =
  "Tautan masuk sudah dikirim. Periksa inbox atau folder spam kamu.";

export function getMagicLinkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
  }

  return "Tautan masuk belum berhasil dikirim. Coba lagi beberapa saat lagi.";
}
