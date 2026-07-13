import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  supabaseUrl !== "https://placeholder-project.supabase.co";

// Fallback values prevent build-time crashes during static page generation when env variables are not present.
const url = supabaseUrl || "https://placeholder-project.supabase.co";
const key = supabaseAnonKey || "placeholder-anon-key";

export const supabase = createClient(url, key);
