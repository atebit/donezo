// biome-ignore lint/style/noRestrictedImports: server-only helper — not a client component or "use client" file
import { adminClient } from "@/lib/supabase/admin";

export async function updateProfileRow(
  userId: string,
  patch: { display_name?: string; avatar_url?: string },
): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from("profile")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
}
