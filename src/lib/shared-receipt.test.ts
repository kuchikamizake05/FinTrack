import { describe, expect, it } from "vitest";
import {
  buildSharedReceiptDraft,
  getPrivateReceiptObjectPath,
  validateSharedReceiptFile,
} from "./shared-receipt";

describe("shared receipt helpers", () => {
  it("builds a review-only transaction draft from shared text", () => {
    expect(buildSharedReceiptDraft({ title: "BCA", text: "Transfer berhasil Rp50.000 ke Kopi", url: "" })).toEqual({ merchant: "BCA", note: "Transfer berhasil Rp50.000 ke Kopi", status: "needs_review", source: "manual" });
  });

  it("keeps shared links as review context when no text is supplied", () => {
    expect(buildSharedReceiptDraft({ title: "", text: "", url: "https://wallet.example/receipt" }).note).toBe("https://wallet.example/receipt");
  });

  it("accepts images and PDFs under the size limit but rejects unsupported files", () => {
    expect(validateSharedReceiptFile({ type: "image/jpeg", size: 2_000_000, name: "receipt.jpg" })).toBeNull();
    expect(validateSharedReceiptFile({ type: "application/pdf", size: 2_000_000, name: "receipt.pdf" })).toBeNull();
    expect(validateSharedReceiptFile({ type: "video/mp4", size: 2_000_000, name: "video.mp4" })).toContain("gambar");
  });

  it("accepts only owned object paths from receipts bucket", () => {
    expect(getPrivateReceiptObjectPath("receipts/user-1/receipt.png", "user-1")).toBe("user-1/receipt.png");
    expect(getPrivateReceiptObjectPath("receipts/user-2/receipt.png", "user-1")).toBeNull();
    expect(getPrivateReceiptObjectPath("other/user-1/receipt.png", "user-1")).toBeNull();
    expect(getPrivateReceiptObjectPath("receipts/user-1/../receipt.png", "user-1")).toBeNull();
  });
});
