import { notFound } from "next/navigation";
import { getWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import type { PendingInvitationRow, WorkspaceMemberRow } from "./members-table";
import { MembersTable } from "./members-table";

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Get workspace
  const { data: workspace } = await supabase
    .from("workspace")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();

  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id);
  if (!role) notFound();

  // Load members with their profiles
  const { data: membersData } = await supabase
    .from("workspace_member")
    .select(
      `
      user_id,
      role,
      created_at,
      profile:user_id ( id, display_name, email, avatar_url )
    `,
    )
    .eq("workspace_id", workspace.id);

  const members: WorkspaceMemberRow[] = (membersData ?? []).map((m) => {
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

  // Load pending invitations (workspace-level, not yet accepted/revoked, not expired)
  const now = new Date().toISOString();
  const { data: invitationsData } = await supabase
    .from("invitation")
    .select("id, email, role, expires_at")
    .eq("workspace_id", workspace.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .is("board_id", null)
    .gt("expires_at", now);

  const invitations: PendingInvitationRow[] = (invitationsData ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expiresAt: inv.expires_at,
  }));

  return (
    <div className="max-w-[720px]">
      <MembersTable
        workspaceId={workspace.id}
        currentUserId={user.id}
        currentUserRole={role}
        members={members}
        invitations={invitations}
      />
    </div>
  );
}
