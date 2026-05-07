import { createClient } from "@/lib/supabase/server";

export async function updateProfileRow(
  userId: string,
  patch: { display_name?: string; avatar_url?: string },
): Promise<void> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("profile")
    .update({ ...patch, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
  if ((count ?? 0) === 0) throw { code: "FORBIDDEN", message: "Not allowed" };
}
