export type RateLimitResult =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; retryAfterSeconds: number };

type RateLimiter = ReturnType<typeof createRateLimiter>;
type FetchLike = (input: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export function createRateLimiter({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
  const buckets = new Map<string, number[]>();

  return {
    consume(key: string, now = Date.now()): RateLimitResult {
      const active = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
      if (active.length >= maxRequests) {
        buckets.set(key, active);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1_000)) };
      }
      active.push(now);
      buckets.set(key, active);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

function getUpstashConfig(environment: Record<string, string | undefined>) {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
    return { url, token };
  } catch {
    return null;
  }
}

async function hashKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRouteRateLimit({ route, userId, maxRequests, windowMs, fallback, environment = process.env, fetchImpl = fetch }: {
  route: string;
  userId: string;
  maxRequests: number;
  windowMs: number;
  fallback: RateLimiter;
  environment?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
}): Promise<RateLimitResult> {
  const config = getUpstashConfig(environment);
  if (!config) return fallback.consume(userId);

  try {
    const key = `fintrack:rate-limit:${await hashKey(`${route}:${userId}`)}`;
    const script = "local count=redis.call('INCR',KEYS[1]);if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;return {count,redis.call('PTTL',KEYS[1])}";
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", script, "1", key, String(windowMs)]),
      cache: "no-store",
    });
    if (!response.ok) return fallback.consume(userId);
    const payload = await response.json() as { result?: unknown };
    if (!Array.isArray(payload.result) || typeof payload.result[0] !== "number" || typeof payload.result[1] !== "number") return fallback.consume(userId);
    if (payload.result[0] <= maxRequests) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(payload.result[1] / 1_000)) };
  } catch {
    return fallback.consume(userId);
  }
}

// ponytail: process-local fallback cannot coordinate Vercel instances; configure Upstash before public launch.
