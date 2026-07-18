import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicConfiguration,
  SUPABASE_PLACEHOLDER_KEY,
  SUPABASE_PLACEHOLDER_URL,
} from "@/lib/configuration";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfiguration = getSupabasePublicConfiguration(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = supabaseConfiguration.configured;

// The inert client keeps static generation deterministic. AppBoundary prevents protected operations when config is invalid.
const url = supabaseConfiguration.configured ? supabaseConfiguration.url : SUPABASE_PLACEHOLDER_URL;
const key = supabaseConfiguration.configured ? supabaseConfiguration.anonKey : SUPABASE_PLACEHOLDER_KEY;

export const supabase = createClient(url, key);
