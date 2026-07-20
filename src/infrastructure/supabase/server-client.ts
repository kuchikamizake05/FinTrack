import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getSupabasePublicConfiguration } from "@/config/supabase";

export type SupabaseAuthenticationResult =
  | { ok: true; client: SupabaseClient; user: User }
  | { ok: false; reason: "configuration" | "authentication" };

export async function authenticateSupabaseAccessToken(
  accessToken: string,
): Promise<SupabaseAuthenticationResult> {
  const configuration = getSupabasePublicConfiguration(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (!configuration.configured) return { ok: false, reason: "configuration" };

  const client = createClient(configuration.url, configuration.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { ok: false, reason: "authentication" };

  return { ok: true, client, user };
}
