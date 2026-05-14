import { notFound } from "next/navigation";
import { SidebarShell } from "@/components/shared/sidebar/SidebarShell";
import { requireUser } from "@/lib/auth/current-user";
import { getWorkspaceRole } from "@/lib/authorization";
import { loadSidebarBoards } from "@/lib/sidebar-data";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/lib/workspace-context";

/**
 * Workspace layout — mounts SidebarShell with WorkspaceProvider so that
 * WorkspaceSidebar / WorkspaceSwitcher can read the active workspace via
 * useWorkspaceMaybe(). The fix for "Select workspace" showing when a workspace
 * is active (epic 16 Slice D).
 */
export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const user = await requireUser();

  const [workspaceRes, workspacesRes] = await Promise.all([
    supabase
      .from("workspace")
      .select("id, name, slug")
      .eq("slug", workspaceSlug)
      .is("deleted_at", null)
      .single(),
    // All workspaces the user belongs to (for WorkspaceSwitcher dropdown).
    supabase
      .from("workspace_member")
      .select("workspace:workspace_id(id, slug, name)")
      .eq("user_id", user.id)
      .is("workspace.deleted_at", null),
  ]);

  const workspace = workspaceRes.data;
  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id);
  if (!role) notFound();

  const sidebarBoards = await loadSidebarBoards(workspace.id);

  return (
    <WorkspaceProvider workspace={workspace} role={role} sidebarBoards={sidebarBoards}>
      {/*
       * Pass the raw workspace_member rows to SidebarShell. SidebarShell already
       * handles the WorkspaceMemberRow → Workspace[] flattening internally.
       * WorkspaceProvider above provides the active workspace context so that
       * useWorkspaceMaybe() returns the current workspace inside WorkspaceSidebar.
       */}
      <SidebarShell user={user} workspaces={workspacesRes.data ?? []}>
        {children}
      </SidebarShell>
    </WorkspaceProvider>
  );
}
