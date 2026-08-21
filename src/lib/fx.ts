export const FRANKFURTER_ORIGIN = "https://api.frankfurter.dev";
export const FX_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

export type FxRateState = "fresh" | "cached" | "stale" | "missing";

export type FxRate = {
  base: string;
  quote: "IDR";
  rate: number;
  providerDate: string | null;
  retrievedAt: string;
  state: Exclude<FxRateState, "missing">;
};

export type FxRateResult = FxRate | {
  base: string;
  quote: "IDR";
  rate: null;
  providerDate: null;
  retrievedAt: null;
  state: "missing";
};

type StoredFxRate = Omit<FxRate, "state">;
type FxFetch = typeof fetch;

const CACHE_PREFIX = "fintrack-fx-v1:";
const memoryCache = new Map<string, StoredFxRate>();
const inFlight = new Map<string, Promise<FxRateResult>>();

export function isCurrencyCode(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

function emptyRate(base: string): FxRateResult {
  return { base, quote: "IDR", rate: null, providerDate: null, retrievedAt: null, state: "missing" };
}

function cacheKey(base: string) {
  return `${CACHE_PREFIX}${base}-IDR`;
}

function isFresh(rate: StoredFxRate, now: number) {
  const timestamp = Date.parse(rate.retrievedAt);
  return Number.isFinite(timestamp) && now - timestamp <= FX_CACHE_TTL_MS;
}

function readStoredRate(base: string): StoredFxRate | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(base));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rate = parsed as Partial<StoredFxRate>;
    if (
      rate.base !== base
      || rate.quote !== "IDR"
      || !Number.isFinite(rate.rate)
      || Number(rate.rate) <= 0
      || typeof rate.retrievedAt !== "string"
      || (rate.providerDate !== null && typeof rate.providerDate !== "string")
    ) return null;
    return { base, quote: "IDR", rate: Number(rate.rate), providerDate: rate.providerDate ?? null, retrievedAt: rate.retrievedAt };
  } catch {
    return null;
  }
}

function storeRate(rate: StoredFxRate) {
  memoryCache.set(rate.base, rate);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(rate.base), JSON.stringify(rate));
  } catch {
    // ponytail: cache failure only loses convenience; live rate result remains usable.
  }
}

function withState(rate: StoredFxRate, state: Exclude<FxRateState, "missing">): FxRate {
  return { ...rate, state };
}

function getCachedRate(base: string) {
  return memoryCache.get(base) ?? readStoredRate(base);
}

function parseProviderRate(body: unknown, base: string): { rate: number; providerDate: string | null } | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return null;
  const value = row as { base?: unknown; quote?: unknown; rate?: unknown; date?: unknown };
  if (value.base !== base || value.quote !== "IDR" || !Number.isFinite(value.rate) || Number(value.rate) <= 0) return null;
  return { rate: Number(value.rate), providerDate: typeof value.date === "string" ? value.date : null };
}

export async function fetchIdrRate(base: string, {
  fetcher = fetch,
  now = () => new Date(),
  timeoutMs = 7_000,
}: {
  fetcher?: FxFetch;
  now?: () => Date;
  timeoutMs?: number;
} = {}): Promise<FxRateResult> {
  if (!isCurrencyCode(base)) return emptyRate(base);
  if (base === "IDR") {
    return { base, quote: "IDR", rate: 1, providerDate: null, retrievedAt: now().toISOString(), state: "fresh" };
  }

  const existing = inFlight.get(base);
  if (existing) return existing;

  const request = (async (): Promise<FxRateResult> => {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL("/v2/rates", FRANKFURTER_ORIGIN);
      url.searchParams.set("base", base);
      url.searchParams.set("quotes", "IDR");
      const response = await fetcher(url.toString(), { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return emptyRate(base);
      const parsed = parseProviderRate(await response.json() as unknown, base);
      if (!parsed) return emptyRate(base);
      const rate: StoredFxRate = {
        base,
        quote: "IDR",
        rate: parsed.rate,
        providerDate: parsed.providerDate,
        retrievedAt: now().toISOString(),
      };
      storeRate(rate);
      return withState(rate, "fresh");
    } catch {
      return emptyRate(base);
    } finally {
      globalThis.clearTimeout(timeout);
    }
  })();

  inFlight.set(base, request);
  try {
    return await request;
  } finally {
    inFlight.delete(base);
  }
}

export function getCachedIdrRate(base: string, now = new Date()): FxRateResult {
  if (!isCurrencyCode(base)) return emptyRate(base);
  if (base === "IDR") return { base, quote: "IDR", rate: 1, providerDate: null, retrievedAt: now.toISOString(), state: "fresh" };
  const cached = getCachedRate(base);
  if (!cached) return emptyRate(base);
  return withState(cached, isFresh(cached, now.getTime()) ? "cached" : "stale");
}

export async function getIdrRate(base: string, {
  allowStale = true,
  forceRefresh = false,
  fetcher,
  now = () => new Date(),
  timeoutMs,
}: {
  allowStale?: boolean;
  forceRefresh?: boolean;
  fetcher?: FxFetch;
  now?: () => Date;
  timeoutMs?: number;
} = {}): Promise<FxRateResult> {
  if (!isCurrencyCode(base)) return emptyRate(base);
  if (base === "IDR") return { base, quote: "IDR", rate: 1, providerDate: null, retrievedAt: now().toISOString(), state: "fresh" };

  const cached = getCachedRate(base);
  if (!forceRefresh && cached && isFresh(cached, now().getTime())) return withState(cached, "cached");

  const live = await fetchIdrRate(base, { fetcher, now, timeoutMs });
  if (live.state !== "missing") return live;
  if (allowStale && cached) return withState(cached, "stale");
  return live;
}

export async function getIdrRates(currencies: Iterable<string>, options?: Parameters<typeof getIdrRate>[1]) {
  const unique = [...new Set([...currencies].filter(isCurrencyCode))];
  const rates = await Promise.all(unique.map(async (currency) => [currency, await getIdrRate(currency, options)] as const));
  return new Map(rates);
}

export function clearFxCachesForTest() {
  memoryCache.clear();
  inFlight.clear();
}
