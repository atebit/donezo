import { notFound } from "next/navigation";
import { getBoardRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import type { BoardMemberRow, PendingBoardInvitationRow } from "./members-table";
import { BoardMembersTable } from "./members-table";

export default async function BoardMembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Load the board
  const { data: board } = await supabase
    .from("board")
    .select("id, name, is_private, workspace_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  const boardRole = await getBoardRole(board.id);
  if (!boardRole || boardRole === "viewer" || boardRole === "member") notFound();

  // If the board is public, render the notice — no need to load members
  if (!board.is_private) {
    return (
      <div className="max-w-[720px]">
        <BoardMembersTable
          workspaceId={board.workspace_id}
          boardId={board.id}
          currentUserId={user.id}
          currentBoardRole={boardRole}
          isPrivate={false}
          members={[]}
          invitations={[]}
        />
      </div>
    );
  }

  // Load board members with profiles
  const { data: membersData } = await supabase
    .from("board_member")
    .select(
      `
      user_id,
      role,
      created_at,
      profile:user_id ( id, display_name, email, avatar_url )
    `,
    )
    .eq("board_id", board.id);

  const members: BoardMemberRow[] = (membersData ?? []).map((m) => {
    const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    return {
      userId: m.user_id,
      displayName: profile?.display_name ?? null,
      email: profile?.email ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: m.role,
      joinedAt: m.created_at,
    };
  });

  // Load pending board-scoped invitations (not yet accepted/revoked, not expired)
  const now = new Date().toISOString();
  const { data: invitationsData } = await supabase
    .from("invitation")
    .select("id, email, role, expires_at")
    .eq("board_id", board.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now);

  const invitations: PendingBoardInvitationRow[] = (invitationsData ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expiresAt: inv.expires_at,
  }));

  return (
    <div className="max-w-[720px]">
      <BoardMembersTable
        workspaceId={board.workspace_id}
        boardId={board.id}
        currentUserId={user.id}
        currentBoardRole={boardRole}
        isPrivate={true}
        members={members}
        invitations={invitations}
      />
    </div>
  );
}
