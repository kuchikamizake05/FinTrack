export type SupabasePublicConfiguration =
  | { configured: true; url: string; anonKey: string }
  | { configured: false; reason: "missing" | "placeholder" | "invalid-url" };

const PLACEHOLDER_URL = "https://placeholder-project.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

export function getSupabasePublicConfiguration(url: string | undefined, anonKey: string | undefined): SupabasePublicConfiguration {
  if (!url || !anonKey) return { configured: false, reason: "missing" };
  if (url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_KEY) return { configured: false, reason: "placeholder" };

  try {
    const parsed = new URL(url);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return { configured: false, reason: "invalid-url" };
    return { configured: true, url: parsed.origin, anonKey };
  } catch {
    return { configured: false, reason: "invalid-url" };
  }
}

export const SUPABASE_PLACEHOLDER_URL = PLACEHOLDER_URL;
export const SUPABASE_PLACEHOLDER_KEY = PLACEHOLDER_KEY;
