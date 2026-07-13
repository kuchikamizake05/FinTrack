import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { buildTradeReviewDispatch } from "@/lib/trade-review";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: RouteContext<"/api/trades/[tradeId]/review">) {
  const { tradeId } = await context.params;
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return Response.json({ error: "Sesi atau konfigurasi aplikasi tidak valid." }, { status: 401 });
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Sesi login tidak valid." }, { status: 401 });
  }

  const { data: trade, error: tradeError } = await client
    .from("forex_trades")
    .select("id")
    .eq("id", tradeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (tradeError || !trade) {
    return Response.json({ error: "Trade tidak ditemukan." }, { status: 404 });
  }

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
    });
    if (!workflowResponse.ok) {
      return Response.json({ error: "Workflow AI belum dapat menerima permintaan." }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error && error.message.includes("not configured")
      ? "AI review belum dikonfigurasi di server."
      : "Gagal meneruskan permintaan review AI.";
    return Response.json({ error: message }, { status: 503 });
  }

  return Response.json({ queued: true }, { status: 202 });
}
