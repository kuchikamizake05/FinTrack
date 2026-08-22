import { NextRequest } from "next/server";
import { createTimeoutSignal } from "@/lib/async";
import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { noStoreJson as json } from "@/server/http";
import { consumeRouteRateLimit } from "@/lib/rate-limit";
import { validateSharedReceiptFile } from "@/lib/shared-receipt";
import {
  buildGeminiReceiptRequest,
  createReceiptRateLimiter,
  mapGeminiFailure,
  parseGeminiReceiptResponse,
  validateReceiptParseSecurity,
} from "@/lib/receipt-vision";

export const dynamic = "force-dynamic";

const limiter = createReceiptRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const security = validateReceiptParseSecurity({
    origin: request.headers.get("origin"),
    requestOrigin: requestUrl.origin,
    authorization: request.headers.get("authorization"),
  });

  if (!security.ok) {
    return json({ error: "Permintaan atau sesi tidak valid." }, 403);
  }

  const authentication = await authenticateSupabaseAccessToken(security.accessToken);
  if (!authentication.ok) {
    const unavailable = authentication.reason === "configuration";
    return json(
      { error: unavailable ? "Layanan belum dikonfigurasi." : "Sesi login tidak valid." },
      unavailable ? 503 : 401,
    );
  }
  const { user } = authentication;

  const rateLimit = await consumeRouteRateLimit({ route: "receipts:parse", userId: user.id, maxRequests: 5, windowMs: 60_000, fallback: limiter });
  if (!rateLimit.allowed) {
    return json(
      { error: "Terlalu banyak permintaan pembacaan struk. Coba lagi sebentar." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Format data tidak valid." }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "File bukti pembayaran tidak ditemukan." }, 400);
  }

  const validationError = validateSharedReceiptFile(file);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  if (!supportedImageTypes.has(file.type)) {
    return json(
      { error: "Format file ini belum didukung untuk ekstraksi otomatis. Silakan isi form secara manual." },
      422,
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return json({ error: "Layanan pembacaan struk otomatis belum dikonfigurasi." }, 503);
  }

  const model = process.env.GEMINI_RECEIPT_MODEL?.trim() || "gemini-1.5-flash";
  const timeout = createTimeoutSignal(15_000);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const geminiPayload = buildGeminiReceiptRequest({
      mimeType: file.type,
      base64Data,
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let providerResponse: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      providerResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
        cache: "no-store",
        signal: timeout.signal,
      });

      if (providerResponse.ok || providerResponse.status < 500 || attempt === 1) {
        break;
      }
      await wait(100 + Math.floor(Math.random() * 100));
    }

    if (!providerResponse?.ok) {
      const failure = mapGeminiFailure(providerResponse?.status ?? 500);
      const retryAfter = providerResponse?.headers.get("retry-after");
      return json({ error: failure.message }, failure.status, retryAfter ? { "Retry-After": retryAfter } : {});
    }

    const providerBody: unknown = await providerResponse.json();
    const extraction = parseGeminiReceiptResponse(providerBody);

    return json(
      {
        extraction,
        model,
      },
      200,
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json({ error: "AI tidak merespons tepat waktu. Silakan isi form manual." }, 504);
    }
    if (error instanceof Error && error.message) {
      return json({ error: error.message }, 422);
    }
    return json({ error: "AI belum bisa menganalisis struk. Silakan isi form manual." }, 502);
  } finally {
    timeout.cleanup();
  }
}
