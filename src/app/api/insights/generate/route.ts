import { NextRequest } from "next/server";
import { createTimeoutSignal } from "@/lib/async";
import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { noStoreJson as json } from "@/server/http";
import {
  buildGroqInsightRequest,
  createInsightRateLimiter,
  insightRequestSchema,
  mapGroqFailure,
  parseGroqInsightResponse,
  validateInsightRequestSecurity,
} from "@/lib/insights-api";

export const dynamic = "force-dynamic";

const limiter = createInsightRateLimiter({ maxRequests: 6, windowMs: 60_000 });
const maxBodyBytes = 20_000;

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const security = validateInsightRequestSecurity({
    contentType: request.headers.get("content-type"),
    origin: request.headers.get("origin"),
    requestOrigin: requestUrl.origin,
    authorization: request.headers.get("authorization"),
    contentLength: request.headers.get("content-length"),
  });
  if (!security.ok) return json({ error: "Permintaan atau sesi tidak valid." }, 403);

  const authentication = await authenticateSupabaseAccessToken(security.accessToken);
  if (!authentication.ok) {
    const unavailable = authentication.reason === "configuration";
    return json(
      { error: unavailable ? "Layanan belum dikonfigurasi." : "Sesi login tidak valid." },
      unavailable ? 503 : 401,
    );
  }
  const { user } = authentication;

  const rateLimit = limiter.consume(user.id);
  if (!rateLimit.allowed) {
    return json(
      { error: "Terlalu banyak permintaan insight. Coba lagi sebentar." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "Payload insight tidak valid." }, 400);
  }
  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    return json({ error: "Payload insight terlalu besar." }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Payload insight tidak valid." }, 400);
  }
  const parsed = insightRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Agregat insight tidak valid." }, 400);

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return json({ error: "Smart Insights belum tersedia." }, 503);
  const model = process.env.GROQ_INSIGHTS_MODEL?.trim() || "openai/gpt-oss-20b";
  const timeout = createTimeoutSignal(12_000);

  try {
    let providerResponse: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      providerResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildGroqInsightRequest(parsed.data, model)),
        cache: "no-store",
        signal: timeout.signal,
      });
      if (providerResponse.ok || providerResponse.status < 500 || attempt === 1) break;
      await wait(80 + Math.floor(Math.random() * 80));
    }

    if (!providerResponse?.ok) {
      const failure = mapGroqFailure(providerResponse?.status ?? 500);
      const retryAfter = providerResponse?.headers.get("retry-after");
      return json({ error: failure.message }, failure.status, retryAfter ? { "Retry-After": retryAfter } : {});
    }

    const providerBody: unknown = await providerResponse.json();
    const insight = parseGroqInsightResponse(
      providerBody,
      parsed.data.candidateActions.map((action) => action.id),
    );
    return json({
      insight: {
        ...insight,
        generatedAt: new Date().toISOString(),
        model,
      },
    }, 200);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json({ error: "AI tidak merespons tepat waktu." }, 504);
    }
    return json({ error: "AI belum bisa menyusun insight." }, 502);
  } finally {
    timeout.cleanup();
  }
}
