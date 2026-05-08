import { notFound } from "next/navigation";
import { getWorkspaceRole } from "@/lib/authorization";
import { loadSidebarBoards } from "@/lib/sidebar-data";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/lib/workspace-context";

export default async function WorkspaceLayout({
  params,
  children,
}: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspace")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!workspace) notFound();
  const role = await getWorkspaceRole(workspace.id);
  if (!role) notFound();

  const sidebarBoards = await loadSidebarBoards(workspace.id);

  return (
    <WorkspaceProvider workspace={workspace} role={role} sidebarBoards={sidebarBoards}>
      {children}
    </WorkspaceProvider>
  );
}
