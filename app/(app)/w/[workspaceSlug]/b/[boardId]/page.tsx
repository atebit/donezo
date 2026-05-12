import { BoardTable } from "@/components/board/table/BoardTable";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Cell = Database["public"]["Tables"]["cell"]["Row"];
type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();

  // Round 1 — load groups, tasks, and columns in parallel.
  // Note: `column` has no `deleted_at` column in the schema; omit that filter.
  const [groupsResult, tasksResult, columnsResult] = await Promise.all([
    supabase
      .from("group")
      .select("*")
      .eq("board_id", boardId)
      .is("deleted_at", null)
      .order("position", { ascending: true }),

    supabase
      .from("task")
      .select("*")
      .eq("board_id", boardId)
      .is("deleted_at", null)
      .order("position", { ascending: true }),

    supabase
      .from("column")
      .select("*")
      .eq("board_id", boardId)
      .order("position", { ascending: true }),
  ]);

  if (groupsResult.error) throw groupsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (columnsResult.error) throw columnsResult.error;

  const groups = groupsResult.data;
  const tasks = tasksResult.data;
  const columns = columnsResult.data;

  // Round 2 — load cells and uploaded attachments in parallel,
  // both filtered by the board_id just resolved.
  // Note: `cell` has no `deleted_at` column in the schema; omit that filter.
  const taskIds = tasks.map((t) => t.id);
  let cells: Cell[] = [];
  let attachments: AttachmentRow[] = [];

  if (taskIds.length > 0) {
    const [cellsResult, attachmentsResult] = await Promise.all([
      supabase.from("cell").select("*").in("task_id", taskIds),
      supabase.from("attachment").select("*").eq("board_id", boardId).eq("is_uploaded", true),
    ]);

    if (cellsResult.error) throw cellsResult.error;
    if (attachmentsResult.error) throw attachmentsResult.error;
    cells = cellsResult.data;
    attachments = attachmentsResult.data;
  }

  return <BoardTable boardId={boardId} initial={{ groups, tasks, cells, columns, attachments }} />;
}
