const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const maxFileSize = 10 * 1024 * 1024;

export function buildSharedReceiptDraft({ title, text, url }: { title: string; text: string; url: string }) {
  return {
    merchant: title.trim() || null,
    note: text.trim() || url.trim() || null,
    status: "needs_review" as const,
    source: "manual" as const,
  };
}

export function validateSharedReceiptFile(file: Pick<File, "type" | "size" | "name">) {
  if (!acceptedTypes.has(file.type)) return "Pilih gambar JPG, PNG, WebP, atau PDF.";
  if (file.size > maxFileSize) return "Ukuran bukti maksimal 10 MB.";
  return null;
}

export function getPrivateReceiptObjectPath(receiptUrl: string | null | undefined, userId: string) {
  const prefix = `receipts/${userId}/`;
  if (!receiptUrl?.startsWith(prefix)) return null;

  const objectPath = receiptUrl.slice("receipts/".length);
  if (!objectPath || objectPath.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return objectPath;
}
