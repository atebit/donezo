// Server-only. Bypasses RLS. Only import from server actions and route handlers.
// DO NOT import this file from any component, any "use client" file, or any
// path under components/** or app/**/_components/**. The Biome noRestrictedImports
// rule enforces this at lint time.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase/admin imported in client code; this client bypasses RLS");
}

let _admin: SupabaseClient<Database> | null = null;

export function adminClient(): SupabaseClient<Database> {
  if (_admin) return _admin;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE service-role config missing; admin client unavailable");
  }
  _admin = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
