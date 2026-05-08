import { BoardHeaderClient } from "@/components/board/BoardHeaderClient";
import { createClient } from "@/lib/supabase/server";

/**
 * BoardHeader — Server Component.
 *
 * Fetches board members (joined with profiles via a separate query) server-side,
 * then passes them to the client shell which owns all interactive controls.
 */
export async function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = await createClient();

  // Step 1: fetch board_member rows for this board (limit 50; pagination deferred to epic 06)
  const { data: boardMembers } = await supabase
    .from("board_member")
    .select("user_id, role")
    .eq("board_id", boardId)
    .limit(50);

  // Step 2: fetch board.created_by
  const { data: boardRow } = await supabase
    .from("board")
    .select("created_by")
    .eq("id", boardId)
    .single();

  // Step 3: collect all user ids to resolve in one profile query
  const userIds = (boardMembers ?? []).map((m) => m.user_id);
  const allIds = boardRow?.created_by
    ? Array.from(new Set([...userIds, boardRow.created_by]))
    : userIds;

  const profileMap: Map<
    string,
    { id: string; display_name: string | null; email: string | null; avatar_url: string | null }
  > = new Map();

  if (allIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profile")
      .select("id, display_name, email, avatar_url")
      .in("id", allIds);

    for (const p of profiles ?? []) {
      profileMap.set(p.id, p);
    }
  }

  // Build the members list
  type MemberRow = {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: string;
  };

  const members: MemberRow[] = (boardMembers ?? []).map((m) => {
    const p = profileMap.get(m.user_id);
    return {
      id: m.user_id,
      displayName: p?.display_name ?? null,
      email: p?.email ?? null,
      avatarUrl: p?.avatar_url ?? null,
      role: m.role,
    };
  });

  // Resolve creator display name
  let createdByName: string | null = null;
  if (boardRow?.created_by) {
    const p = profileMap.get(boardRow.created_by);
    createdByName = p?.display_name ?? p?.email ?? null;
  }

  return <BoardHeaderClient members={members} createdByName={createdByName} />;
}
