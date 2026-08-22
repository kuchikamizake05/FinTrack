import { z } from "zod";

const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const receiptExtractionSchema = z.object({
  date: z.string().regex(datePattern, "Format tanggal harus YYYY-MM-DD").nullable(),
  merchant: z.string().trim().min(1).max(120).nullable(),
  amount: z.number().finite().positive().max(1_000_000_000_000).nullable(),
  categoryHint: z.string().trim().min(1).max(80).nullable(),
  type: z.enum(["income", "expense"]).nullable(),
  proofKind: z.enum(["receipt", "transfer"]).nullable(),
  note: z.string().trim().min(1).max(300).nullable(),
  rawText: z.string().trim().min(1).max(2_000).nullable(),
  confidence: z.number().finite().min(0).max(1).nullable(),
}).strict().refine((data) => (
  data.date !== null
  || data.merchant !== null
  || data.amount !== null
  || data.categoryHint !== null
  || data.note !== null
  || data.type !== null
), { message: "AI tidak menemukan data transaksi yang valid." });

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export const receiptGenerationResponseSchema = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description: "Tanggal transaksi dalam format YYYY-MM-DD atau null jika tidak terbaca.",
      nullable: true,
    },
    merchant: {
      type: "string",
      description: "Nama toko/merchant/tujuan pembayaran atau null jika tidak jelas.",
      nullable: true,
    },
    amount: {
      type: "number",
      description: "Total nominal pembayaran final angka positif tanpa simbol/titik atau null jika tidak jelas.",
      nullable: true,
    },
    categoryHint: {
      type: "string",
      description: "Perkiraan kategori transaksi dalam bahasa Indonesia atau null.",
      nullable: true,
    },
    type: {
      type: "string",
      enum: ["income", "expense"],
      description: "income untuk dana masuk, expense untuk pembayaran atau dana keluar, atau null jika tidak jelas.",
      nullable: true,
    },
    proofKind: {
      type: "string",
      enum: ["receipt", "transfer"],
      description: "transfer untuk bukti transfer bank/e-wallet, receipt untuk struk pembayaran, atau null jika tidak jelas.",
      nullable: true,
    },
    note: {
      type: "string",
      description: "Catatan ringkas nama item penting atau keterangan transaksi atau null.",
      nullable: true,
    },
    rawText: {
      type: "string",
      description: "Teks penting yang terbaca pada struk atau null.",
      nullable: true,
    },
    confidence: {
      type: "number",
      description: "Skor keyakinan ekstraksi dari 0.0 sampai 1.0.",
      nullable: true,
    },
  },
  required: ["date", "merchant", "amount", "categoryHint", "type", "proofKind", "note", "rawText", "confidence"],
} as const;

export function buildGeminiReceiptRequest({
  mimeType,
  base64Data,
}: {
  mimeType: string;
  base64Data: string;
}) {
  return {
    contents: [
      {
        parts: [
          {
            text: [
              "Kamu adalah asisten pembaca struk/bukti transaksi untuk FinTrack.",
              "Ekstrak data bukti transaksi dalam format JSON terstruktur.",
              "Panduan:",
              "- date: Format YYYY-MM-DD. Jika hanya tanggal dan bulan, gunakan tahun saat ini jika masuk akal.",
              "- merchant: Nama merchant atau penerima transfer.",
              "- amount: Nominal total transaksi (angka murni positif).",
              "- type: expense untuk pembayaran/dana keluar, income untuk dana masuk, atau null jika tidak jelas.",
              "- proofKind: transfer untuk bukti transfer bank/e-wallet, receipt untuk struk pembayaran, atau null jika tidak jelas.",
              "- categoryHint: Rekomendasi kategori transaksi dalam bahasa Indonesia atau null.",
              "- note: Rangkuman ringkas transaksi atau tujuan transfer.",
              "- rawText: Teks utama yang terbaca di struk.",
              "- confidence: Angka keyakinan 0.0 sampai 1.0.",
              "Jika ada informasi yang tidak terbaca, gunakan nilai null.",
            ].join("\n"),
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: receiptGenerationResponseSchema,
    },
  };
}

export function parseGeminiReceiptResponse(value: unknown): ReceiptExtraction {
  try {
    const rawContent = (
      value as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: unknown;
            }>;
          };
        }>;
      }
    ).candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawContent !== "string") {
      throw new Error("missing text content");
    }

    const parsedJson = JSON.parse(rawContent);
    return receiptExtractionSchema.parse(parsedJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Format data struk tidak valid.");
    }
    throw new Error("Gagal membaca hasil analisis bukti pembayaran.");
  }
}

export function createReceiptRateLimiter({
  maxRequests,
  windowMs,
}: {
  maxRequests: number;
  windowMs: number;
}) {
  const buckets = new Map<string, number[]>();
  return {
    consume(key: string, now = Date.now()) {
      const active = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
      if (active.length >= maxRequests) {
        const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1_000));
        buckets.set(key, active);
        return { allowed: false, retryAfterSeconds } as const;
      }
      active.push(now);
      buckets.set(key, active);
      return { allowed: true, retryAfterSeconds: 0 } as const;
    },
  };
}

export function validateReceiptParseSecurity({
  origin,
  requestOrigin,
  authorization,
}: {
  origin: string | null;
  requestOrigin: string;
  authorization: string | null;
}) {
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!origin || origin !== requestOrigin || !jwtPattern.test(accessToken)) {
    return { ok: false } as const;
  }
  return { ok: true, accessToken } as const;
}

export function mapGeminiFailure(status: number) {
  if (status === 429) {
    return {
      status: 429,
      message: "Batas pemrosesan AI harian/menit tercapai. Silakan isi form secara manual.",
    } as const;
  }
  if (status === 401 || status === 403) {
    return {
      status: 503,
      message: "Layanan pembacaan struk otomatis belum dikonfigurasi.",
    } as const;
  }
  return {
    status: 502,
    message: "AI belum berhasil menganalisis struk. Silakan periksa atau isi manual.",
  } as const;
}
