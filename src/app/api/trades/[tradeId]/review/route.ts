import { NextRequest } from "next/server";
import { createTimeoutSignal } from "@/lib/async";
import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { buildTradeReviewDispatch, parseTradeReviewRequest } from "@/lib/trade-review";
import { noStoreJson as json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tradeId: string }> },
) {
  const { tradeId } = await context.params;
  const parsedRequest = parseTradeReviewRequest({
    tradeId,
    authorization: request.headers.get("authorization"),
  });
  if (!parsedRequest.ok) return json({ error: "Permintaan atau sesi tidak valid." }, 401);

  const authentication = await authenticateSupabaseAccessToken(parsedRequest.accessToken);
  if (!authentication.ok) {
    const unavailable = authentication.reason === "configuration";
    return json(
      { error: unavailable ? "Layanan belum dikonfigurasi." : "Sesi login tidak valid." },
      unavailable ? 503 : 401,
    );
  }
  const { client, user } = authentication;

  const { data: trade, error: tradeError } = await client
    .from("forex_trades")
    .select("id")
    .eq("id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (tradeError || !trade) {
    return json({ error: "Trade tidak ditemukan." }, 404);
  }

  const timeout = createTimeoutSignal(10_000);
  try {
    const dispatch = buildTradeReviewDispatch({
      webhookUrl: process.env.N8N_TRADE_REVIEW_WEBHOOK_URL ?? "",
      sharedSecret: process.env.N8N_TRADE_REVIEW_SHARED_SECRET ?? "",
      userId: user.id,
      tradeId: trade.id,
    });
    const workflowResponse = await fetch(dispatch.url, {
      method: "POST",
      headers: dispatch.headers,
      body: dispatch.body,
      cache: "no-store",
      signal: timeout.signal,
    });
    if (!workflowResponse.ok) {
      return json({ error: "Workflow AI belum dapat menerima permintaan." }, 502);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json({ error: "Workflow AI tidak merespons tepat waktu." }, 504);
    }
    const message = error instanceof Error && error.message.includes("not configured")
      ? "AI review belum dikonfigurasi di server."
      : "Gagal meneruskan permintaan review AI.";
    return json({ error: message }, 503);
  } finally {
    timeout.cleanup();
  }

  return json({ queued: true }, 202);
}
