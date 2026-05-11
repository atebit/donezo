import { notFound } from "next/navigation";
import { BoardHeader } from "@/components/board/BoardHeader";
import { BoardViewTabs } from "@/components/board/BoardViewTabs";
import { requireUser } from "@/lib/auth/current-user";
import { getBoardRole } from "@/lib/authorization";
import { BoardProvider } from "@/lib/board-context";
import { createClient } from "@/lib/supabase/server";

export default async function BoardLayout({
  params,
  children,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
  children: React.ReactNode;
}) {
  const { boardId } = await params;
  const supabase = await createClient();
  // requireUser is used by BoardHeader too; calling here ensures userId is available
  // for BoardProvider (consumed by useCursorBroadcast via useBoard — Epic 08 S6).
  const currentUser = await requireUser();

  const { data: board } = await supabase
    .from("board")
    .select("id, name, description, is_private, workspace_id, created_by, deleted_at")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  const role = await getBoardRole(board.id);
  if (!role) notFound();

  const { data: starred } = await supabase
    .from("user_starred_board")
    .select("board_id")
    .eq("board_id", board.id)
    .maybeSingle();

  const isStarred = Boolean(starred);

  return (
    <BoardProvider board={board} role={role} isStarred={isStarred} userId={currentUser.id}>
      <div className="flex flex-col h-full min-h-0">
        <BoardHeader boardId={board.id} />
        <BoardViewTabs />
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </BoardProvider>
  );
}
