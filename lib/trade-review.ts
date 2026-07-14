export type TradeReviewDispatchInput = {
  webhookUrl: string;
  sharedSecret: string;
  userId: string;
  tradeId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function parseTradeReviewRequest({ tradeId, authorization }: {
  tradeId: string;
  authorization: string | null;
}) {
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!UUID_PATTERN.test(tradeId) || !JWT_PATTERN.test(accessToken)) return { ok: false } as const;
  return { ok: true, tradeId, accessToken } as const;
}

export function buildTradeReviewDispatch({ webhookUrl, sharedSecret, userId, tradeId }: TradeReviewDispatchInput) {
  if (!webhookUrl || !sharedSecret || !userId || !tradeId) {
    throw new Error("AI trade review is not configured");
  }

  return {
    url: webhookUrl,
    headers: {
      "Content-Type": "application/json",
      "x-fintrack-review-secret": sharedSecret,
    },
    body: JSON.stringify({ userId, tradeId }),
  };
}
