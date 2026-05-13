/**
 * app/api/health/route.ts
 *
 * Healthcheck endpoint. Returns 200 when Supabase is reachable, 503 otherwise.
 * Intended for use with uptime monitors (BetterStack, etc.).
 *
 * The query against `workspace` is unauthenticated by default; RLS returns
 * an empty result set (not an error). That's fine — round-trip to Postgres
 * is what we're verifying.
 *
 * Response shape:
 *   200 — { ok: true, sha: string, ts: number }
 *   503 — { ok: false, error: string }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("workspace").select("id").limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown",
      ts: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
