import { z } from "zod";

const actionIds = [
  "review-pending",
  "review-top-category",
  "protect-positive-cashflow",
  "improve-negative-cashflow",
  "complete-account-reporting",
] as const;
const impactValues = ["high", "medium", "low"] as const;
const hrefValues = ["/transactions", "/categories", "/accounts", "/dashboard"] as const;
const finiteNumber = z.number().finite().min(-1_000_000_000_000_000).max(1_000_000_000_000_000);
const nullableRate = z.number().finite().min(-100_000).max(100_000).nullable();

const candidateActionSchema = z.object({
  id: z.enum(actionIds),
  title: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(180),
  impact: z.enum(impactValues),
  href: z.enum(hrefValues),
}).strict();

export const insightRequestSchema = z.object({
  version: z.literal(1),
  periodLabel: z.string().trim().min(1).max(40),
  previousPeriodLabel: z.string().trim().min(1).max(40),
  metrics: z.object({
    income: finiteNumber,
    expense: finiteNumber.nonnegative(),
    netCashFlow: finiteNumber,
    savingsRate: nullableRate,
    expenseChange: nullableRate,
    incomeChange: nullableRate,
    confirmedCount: z.number().int().min(0).max(100_000),
    pendingCount: z.number().int().min(0).max(100_000),
    averageExpense: finiteNumber.nonnegative(),
    activeAccountCount: z.number().int().min(0).max(10_000),
    uncoveredForeignAccountCount: z.number().int().min(0).max(10_000),
  }).strict(),
  topCategories: z.array(z.object({
    name: z.string().trim().min(1).max(40),
    amount: finiteNumber.nonnegative(),
    share: z.number().finite().min(0).max(100),
  }).strict()).max(5),
  largestCategoryMovement: z.object({
    category: z.string().trim().min(1).max(40),
    currentAmount: finiteNumber.nonnegative(),
    previousAmount: finiteNumber.nonnegative(),
    changeAmount: finiteNumber,
  }).strict().nullable(),
  candidateActions: z.array(candidateActionSchema).max(3),
}).strict();

const generatedActionSchema = z.object({
  candidateId: z.enum(actionIds),
  title: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(180),
  impact: z.enum(impactValues),
}).strict();

export const generatedInsightSchema = z.object({
  headline: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(420),
  tone: z.enum(["positive", "neutral", "attention"]),
  actions: z.array(generatedActionSchema).max(3),
  observations: z.array(z.string().trim().min(1).max(180)).max(3),
}).strict();

export const generatedInsightEnvelopeSchema = generatedInsightSchema.extend({
  generatedAt: z.string().datetime(),
  model: z.string().trim().min(1).max(100),
}).strict();

export type InsightApiRequest = z.infer<typeof insightRequestSchema>;
export type GeneratedInsight = z.infer<typeof generatedInsightSchema>;
export type GeneratedInsightEnvelope = z.infer<typeof generatedInsightEnvelopeSchema>;

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const maxRequestBytes = 20_000;

export function createInsightRateLimiter({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
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

export function validateInsightRequestSecurity({
  contentType,
  origin,
  requestOrigin,
  authorization,
  contentLength,
}: {
  contentType: string | null;
  origin: string | null;
  requestOrigin: string;
  authorization: string | null;
  contentLength: string | null;
}) {
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const declaredLength = contentLength ? Number(contentLength) : 0;
  if (
    !contentType?.toLowerCase().startsWith("application/json")
    || !origin
    || origin !== requestOrigin
    || !JWT_PATTERN.test(accessToken)
    || !Number.isFinite(declaredLength)
    || declaredLength < 0
    || declaredLength > maxRequestBytes
  ) return { ok: false } as const;
  return { ok: true, accessToken } as const;
}

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    tone: { type: "string", enum: ["positive", "neutral", "attention"] },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidateId: { type: "string", enum: actionIds },
          title: { type: "string" },
          reason: { type: "string" },
          impact: { type: "string", enum: impactValues },
        },
        required: ["candidateId", "title", "reason", "impact"],
      },
    },
    observations: { type: "array", maxItems: 3, items: { type: "string" } },
  },
  required: ["headline", "summary", "tone", "actions", "observations"],
} as const;

export function buildGroqInsightRequest(payload: InsightApiRequest, model: string) {
  return {
    model,
    temperature: 0.2,
    max_completion_tokens: 700,
    messages: [
      {
        role: "system",
        content: [
          "Kamu membantu menjelaskan snapshot keuangan pribadi dalam Bahasa Indonesia yang tenang dan ringkas.",
          "Gunakan hanya angka dan fakta yang diberikan. Jangan menghitung atau menciptakan nilai moneter baru.",
          "Jangan memberi saran investasi, pajak, hukum, pinjaman, atau prediksi masa depan.",
          "Pilih tindakan hanya dari candidateActions dan pertahankan candidateId yang sama.",
          "Hindari kepastian palsu, rasa takut, dan bahasa promosi.",
        ].join(" "),
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "fintrack_smart_insight",
        strict: true,
        schema: responseJsonSchema,
      },
    },
  };
}

export function parseGroqInsightResponse(value: unknown, allowedCandidateIds: readonly string[]): GeneratedInsight {
  try {
    const content = (value as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("missing content");
    const parsed = generatedInsightSchema.parse(JSON.parse(content));
    if (parsed.actions.some((action) => !allowedCandidateIds.includes(action.candidateId))) throw new Error("unknown action");
    return parsed;
  } catch {
    throw new Error("Invalid Groq response");
  }
}

export function mapGroqFailure(status: number) {
  if (status === 429) return { status: 429, message: "Batas AI sedang tercapai. Coba lagi nanti." } as const;
  if (status === 401 || status === 403) return { status: 503, message: "Smart Insights belum tersedia." } as const;
  return { status: 502, message: "AI belum bisa menyusun insight." } as const;
}
