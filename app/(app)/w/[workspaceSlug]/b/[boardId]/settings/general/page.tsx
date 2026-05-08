import { notFound } from "next/navigation";
import { getBoardRole, getWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { BoardGeneralForm } from "./general-form";

export default async function BoardGeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { workspaceSlug, boardId } = await params;
  const supabase = await createClient();

  const { data: board } = await supabase
    .from("board")
    .select("id, name, description, is_private, workspace_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  const boardRole = await getBoardRole(board.id);
  if (!boardRole || boardRole === "viewer" || boardRole === "member") notFound();

  const workspaceRole = await getWorkspaceRole(board.workspace_id);

  return (
    <div className="max-w-[720px]">
      <BoardGeneralForm
        boardId={board.id}
        boardName={board.name}
        boardDescription={board.description ?? ""}
        boardIsPrivate={board.is_private}
        workspaceSlug={workspaceSlug}
        boardRole={boardRole}
        workspaceRole={workspaceRole}
      />
    </div>
  );
}
