export type TradeReviewDispatchInput = {
  webhookUrl: string;
  sharedSecret: string;
  userId: string;
  tradeId: string;
};

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
