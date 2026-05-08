import { createClient } from "@/lib/supabase/server";

export async function loadSidebarBoards(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { boards: [], starred: [] };

  const { data: boards } = await supabase
    .from("board")
    .select("id, name, is_private, workspace_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("name");

  const { data: starred } = await supabase
    .from("user_starred_board")
    .select("board_id")
    .eq("user_id", user.id);

  const starredSet = new Set((starred ?? []).map((s) => s.board_id));
  return {
    starred: (boards ?? []).filter((b) => starredSet.has(b.id)),
    boards: (boards ?? []).filter((b) => !starredSet.has(b.id)),
  };
}
