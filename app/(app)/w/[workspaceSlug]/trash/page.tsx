import { notFound } from "next/navigation";
import { TrashEmpty } from "@/components/shared/empty-states/TrashEmpty";
import { requireWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { TrashList } from "./trash-list";

export default async function TrashPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  // 1. Resolve slug → workspace
  const { data: workspace } = await supabase
    .from("workspace")
    .select("id")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();
  if (!workspace) notFound();

  // 2. Require admin+ (throws { code: "FORBIDDEN" } for insufficient role)
  const role = await requireWorkspaceRole(workspace.id, "admin").catch(() => null);
  if (!role) notFound();

  // 3. Query archived boards (board_select_archived policy admits admin+)
  const { data: boards, error } = await supabase
    .from("board")
    .select("id, name, deleted_at, workspace_id, created_by")
    .eq("workspace_id", workspace.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    // Surface DB errors as 404 rather than leaking internals
    notFound();
  }

  const archivedBoards = boards ?? [];

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
      }}
    >
      {/* Page header */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "var(--color-fg-strong)",
          marginBottom: 8,
        }}
      >
        Trash
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-fg-muted)",
          marginBottom: 32,
        }}
      >
        Boards in the trash can be restored. Permanent deletion removes them and all their data
        forever.
      </p>

      {archivedBoards.length === 0 ? (
        <TrashEmpty />
      ) : (
        <TrashList boards={archivedBoards} workspaceId={workspace.id} role={role} />
      )}
    </div>
  );
}
