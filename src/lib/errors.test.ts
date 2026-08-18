import { describe, expect, it, vi } from "vitest";
import { normalizeClientError, reportHandledError } from "./errors";

describe("normalizeClientError", () => {
  const fallback = "Data belum bisa dimuat.";

  it("always returns safe fallback text for provider errors", () => {
    expect(normalizeClientError(new Error("private database detail"), fallback)).toEqual({
      message: fallback,
    });
    expect(normalizeClientError({
      message: "relation does not exist",
      code: "42P01",
      details: "private table detail",
      hint: "private hint",
    }, fallback)).toEqual({
      message: fallback,
    });
  });

  it("uses the fallback for empty or unknown values", () => {
    expect(normalizeClientError({}, fallback)).toEqual({ message: fallback });
    expect(normalizeClientError(null, fallback)).toEqual({ message: fallback });
  });
});

describe("reportHandledError", () => {
  it("logs fixed context without provider error payload", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = reportHandledError("Transactions unavailable", { message: "private detail", code: "secret" }, "Data belum bisa dimuat.");

    expect(result).toEqual({ message: "Data belum bisa dimuat." });
    expect(warning).toHaveBeenCalledWith("FinTrack: Transactions unavailable");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("private detail");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("secret");
    warning.mockRestore();
  });
});
