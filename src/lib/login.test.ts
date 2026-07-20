import { describe, expect, it } from "vitest";
import {
  AUTH_SUCCESS_MESSAGES,
  buildAuthRedirectUrl,
  getAuthErrorMessage,
  validatePassword,
} from "./login";

describe("password authentication feedback", () => {
  it("uses concise Indonesian success copy", () => {
    expect(AUTH_SUCCESS_MESSAGES.signUp).toContain("konfirmasi");
    expect(AUTH_SUCCESS_MESSAGES.reset).toContain("pemulihan");
    expect(AUTH_SUCCESS_MESSAGES.passwordUpdated).toContain("diperbarui");
  });

  it("turns known provider failures into actionable messages", () => {
    expect(getAuthErrorMessage("login", new Error("Invalid login credentials"))).toBe(
      "Email atau kata sandi tidak cocok.",
    );
    expect(getAuthErrorMessage("signup", new Error("User already registered"))).toBe(
      "Email ini sudah terdaftar. Silakan masuk.",
    );
    expect(getAuthErrorMessage("reset", new Error("email rate limit exceeded"))).toBe(
      "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.",
    );
  });

  it("does not expose unknown provider errors", () => {
    expect(getAuthErrorMessage("oauth", new Error("internal provider detail"))).toBe(
      "Login dengan Google belum berhasil. Coba lagi.",
    );
    expect(getAuthErrorMessage("login", null)).toBe(
      "Login belum berhasil. Coba lagi beberapa saat lagi.",
    );
  });
});

describe("password validation", () => {
  it("requires at least eight characters", () => {
    expect(validatePassword("short", "short")).toBe("Kata sandi minimal 8 karakter.");
  });

  it("requires matching confirmation when supplied", () => {
    expect(validatePassword("rahasia123", "berbeda123")).toBe("Konfirmasi kata sandi tidak cocok.");
    expect(validatePassword("rahasia123", "rahasia123")).toBeNull();
  });
});

describe("auth redirect URLs", () => {
  it("returns to the login page with a sanitized destination", () => {
    expect(buildAuthRedirectUrl("https://fintrack.example", "/transactions?month=2026-07")).toBe(
      "https://fintrack.example/login?next=%2Ftransactions%3Fmonth%3D2026-07",
    );
  });

  it("can request password-update mode", () => {
    expect(buildAuthRedirectUrl("https://fintrack.example/", "/dashboard", "update-password")).toBe(
      "https://fintrack.example/login?next=%2Fdashboard&mode=update-password",
    );
  });
});
