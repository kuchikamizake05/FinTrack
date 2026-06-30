import { describe, expect, it } from "vitest";
import { getMagicLinkErrorMessage, MAGIC_LINK_SUCCESS_MESSAGE } from "./login";

describe("login feedback", () => {
  it("uses concise Indonesian success copy", () => {
    expect(MAGIC_LINK_SUCCESS_MESSAGE).toBe(
      "Tautan masuk sudah dikirim. Periksa inbox atau folder spam kamu.",
    );
  });

  it("turns rate-limit errors into an actionable message", () => {
    expect(getMagicLinkErrorMessage(new Error("email rate limit exceeded"))).toBe(
      "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
    );
  });

  it("does not expose unknown provider errors to the user", () => {
    expect(getMagicLinkErrorMessage(new Error("internal provider detail"))).toBe(
      "Tautan masuk belum berhasil dikirim. Coba lagi beberapa saat lagi.",
    );
    expect(getMagicLinkErrorMessage(null)).toBe(
      "Tautan masuk belum berhasil dikirim. Coba lagi beberapa saat lagi.",
    );
  });
});
