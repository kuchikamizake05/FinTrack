import { describe, expect, it, vi } from "vitest";
import { normalizeClientError, reportHandledError } from "./errors";

describe("normalizeClientError", () => {
  const fallback = "Data belum bisa dimuat.";

  it("preserves a regular Error message", () => {
    expect(normalizeClientError(new Error("Koneksi terlalu lama."), fallback)).toEqual({
      message: "Koneksi terlalu lama.",
    });
  });

  it("preserves useful Supabase error fields", () => {
    expect(normalizeClientError({
      message: "relation does not exist",
      code: "42P01",
      details: "Missing public.transactions",
      hint: null,
    }, fallback)).toEqual({
      message: "relation does not exist",
      code: "42P01",
      details: "Missing public.transactions",
    });
  });

  it("uses the fallback for empty or unknown values", () => {
    expect(normalizeClientError({}, fallback)).toEqual({ message: fallback });
    expect(normalizeClientError(null, fallback)).toEqual({ message: fallback });
  });
});

describe("reportHandledError", () => {
  it("logs a serializable warning and returns the normalized error", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = reportHandledError("Transactions unavailable", {}, "Data belum bisa dimuat.");

    expect(result).toEqual({ message: "Data belum bisa dimuat." });
    expect(warning).toHaveBeenCalledWith("Transactions unavailable", { message: "Data belum bisa dimuat." });
    warning.mockRestore();
  });
});
